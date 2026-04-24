import { logger, recordDiagnosticEvent } from '$lib/utils/logger';
import { splitNarrativeParagraphs } from '$lib/editor/narrativeGuardrails';
import type {
  BackgroundWorldEvent,
  BackgroundWorldGenerationResult,
  BackgroundWorldInput,
  ChatMessage,
  StoryMemoryUpdates,
  StoryProviderConfig,
  StoryTurnGenerationResult,
  StoryChapter
} from './types';
import {
  assertSupportedStoryProviderConfig,
  sanitizeStoryMessageHistory,
  validateBackgroundWorldGenerationResult,
  validateStoryTurnGenerationResult
} from './contracts';
import { cleanText, clamp, isObjectRecord, extractCanonicalPlayerAction } from './utils/shared';
import {
  callOpenAiCompatibleRaw,
  callTextModel,
  detectModelCapabilities,
  normalizeProviderId
} from './providers';
import {
  coerceMemoryUpdates,
  coerceStateUpdate,
  parseJsonSafely,
  parseStoryResponse,
  sanitizeNarrativeText
} from './parsing';
import {
  STORY_PIPELINE_BRAIN_SYSTEM_PROMPT,
  STORY_PIPELINE_DIRECTOR_SYSTEM_PROMPT,
  STORY_PIPELINE_SCRIBE_SYSTEM_PROMPT,
  STORY_PIPELINE_WRITER_SYSTEM_PROMPT,
  buildPipelineBrainUserPrompt,
  buildPipelineDirectorUserPrompt,
  buildPipelineScribeUserPrompt,
  buildPipelineWriterUserPromptWithDirector
} from './prompts';

type StoryPipelineStep = 'scribe' | 'director' | 'writer' | 'brain' | 'world-observer' | 'world-adjudicator';

type StoryDirectorBrief = {
  player_action: string;
  scene_goal: string;
  tension: string;
  must_include: string[];
  required_world_signals: string[];
  section_type?: string;
  atmosphere?: string;
};

export type StoryTurnPipelineConfigOverrides = {
  scribe?: StoryProviderConfig;
  director?: StoryProviderConfig;
  writer?: StoryProviderConfig;
  brain?: StoryProviderConfig;
};

const OPENAI_COMPATIBLE_PROVIDER_IDS = new Set<string>(['openrouter']);
const DEFAULT_SCENE_DESCRIPTION = 'Cinematic Star Wars scene with dramatic lighting and dynamic action';
function normalizeProviderConfig(config: StoryProviderConfig): StoryProviderConfig {
  const supported = assertSupportedStoryProviderConfig(config);
  const providerId = normalizeProviderId(supported.providerId);
  if (providerId === supported.providerId) return supported;
  return { ...supported, providerId };
}

function resolveStepConfig(baseConfig: StoryProviderConfig, override?: StoryProviderConfig): StoryProviderConfig {
  return normalizeProviderConfig(override ?? baseConfig);
}

function getStepTokenBudget(stepConfig: StoryProviderConfig, step: StoryPipelineStep): number {
  const caps = detectModelCapabilities(stepConfig);
  if (step === 'scribe') return clamp(Math.round(caps.maxOutputTokens * 0.2), 240, 560);
  if (step === 'director') return clamp(Math.round(caps.maxOutputTokens * 0.24), 320, 720);
  if (step === 'writer') return clamp(Math.round(caps.maxOutputTokens * 0.72), 900, 2600);
  if (step === 'world-observer') return clamp(Math.round(caps.maxOutputTokens * 0.18), 220, 520);
  if (step === 'world-adjudicator') return clamp(Math.round(caps.maxOutputTokens * 0.26), 320, 760);
  return clamp(Math.round(caps.maxOutputTokens * 0.58), 900, 2200);
}

function getStepTemperature(step: StoryPipelineStep): number {
  if (step === 'writer') return 0.95;
  if (step === 'director') return 0.45;
  if (step === 'world-observer') return 0.45;
  if (step === 'brain') return 0.2;
  if (step === 'world-adjudicator') return 0.2;
  return 0.35;
}

function defaultMemoryUpdates(): StoryMemoryUpdates {
  return {
    relations: [],
    places: [],
    injuries: [],
    resources: [],
    notes: []
  };
}

function getLatestUserAction(messages: ChatMessage[]): string {
  const latestUser = [...messages].reverse().find(message => message.role === 'user');
  return extractCanonicalPlayerAction(latestUser?.content || '');
}

function toSubAgentHistoryLine(message: ChatMessage): string {
  if (message.role === 'assistant') {
    return `Narrateur: ${cleanText(message.content, 420)}`;
  }

  const action = extractCanonicalPlayerAction(message.content);
  return `Joueur: ${cleanText(action || message.content, 280)}`;
}

function fallbackScribeSummary(messages: ChatMessage[], turnNumber: number): string {
  const latestAction = getLatestUserAction(messages) || 'Le protagoniste doit improviser sous pression.';
  return cleanText(
    `Tour ${turnNumber}. Situation tendue en cours. Action immédiate du joueur: ${latestAction}. Les protagonistes proches et la menace active doivent rester cohérents avec l'état du monde actuel.`,
    420
  );
}

function fallbackWriterScene(scribeSummary: string, messages: ChatMessage[], turnNumber: number): string {
  const latestAction = getLatestUserAction(messages) || 'agir immédiatement';
  const seed = cleanText(scribeSummary, 420);
  return sanitizeNarrativeText(
    `Tour ${turnNumber}. ${seed}\n\nLa scène bascule sans avertissement quand le protagoniste décide de ${latestAction}. Les regards se figent, les moteurs grondent au loin, et chaque seconde ajoute du poids à la décision suivante.`,
    3200
  );
}

function fallbackBrainPayload(): Record<string, unknown> {
  return {
    state_update: {},
    memory_updates: defaultMemoryUpdates(),
    choices: []
  };
}

function fallbackDirectorBrief(messages: ChatMessage[], scribeSummary: string): StoryDirectorBrief {
  const latestAction = getLatestUserAction(messages) || 'agir immédiatement sous pression';
  return {
    player_action: latestAction,
    scene_goal: `Mettre en jeu immédiatement l'action suivante: ${latestAction}.`,
    tension: cleanText(scribeSummary, 180) || 'La pression monte et la situation se referme.',
    must_include: [
      'Une conséquence immédiate de l’action du joueur',
      'Un lieu concret exploitable',
      'Au moins un signal relationnel ou politique'
    ],
    required_world_signals: ['location', 'npc'],
    section_type: 'action',
    atmosphere: 'tense'
  };
}

function normalizeSearchText(value: unknown): string {
  return cleanText(value, 160)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericChapterTitle(value: unknown): boolean {
  const normalized = normalizeSearchText(value);
  if (!normalized) return true;
  return /^(?:tour|turn|chapitre|chapter|scene|sc[èe]ne)\s*(?:n[o°]\s*)?[\divxlcdm-]*$/i.test(normalized);
}

function deriveFallbackChapterTitleFromScene(scene: string, turnNumber: number): string {
  const normalized = normalizeSearchText(scene);

  if (/(hangar|spatioport|dock|quai d['’]arrimage|baie d['’]arrimage)/.test(normalized)) return 'Tension au spatioport';
  if (/(cantina|bar|taverne|club)/.test(normalized)) return 'Rumeurs de cantina';
  if (/(embuscade|attaque|assaut|chasseur|blaster|duel|fusillade)/.test(normalized)) return 'Sous le feu ennemi';
  if (/(negoci|dialog|parler|accord|tr[eê]ve)/.test(normalized)) return 'Négociation sous pression';

  const firstSentence = cleanText(scene, 320)
    .split(/[.!?\n]/)
    .map(chunk => chunk.trim())
    .find(chunk => chunk.length >= 16) || '';

  const words = firstSentence
    .replace(/["'«»“”():,;]+/g, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !/^(?:le|la|les|un|une|des|de|du|dans|sur|a|au|aux|et|mais|ou|donc)$/i.test(item))
    .slice(0, 6);

  if (words.length >= 2) {
    return cleanText(
      words
        .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
        .join(' '),
      90
    );
  }

  return turnNumber <= 1 ? 'Prologue' : 'Nœud de tension';
}

function hasPlayableChapterContent(chapter: StoryChapter): boolean {
  return Boolean(cleanText(chapter.narrative.action, 260) || cleanText(chapter.narrative.dialogue, 260));
}

function splitWriterScene(writerScene: string): { action: string; dialogue: string } {
  const paragraphs = splitNarrativeParagraphs(sanitizeNarrativeText(writerScene, 5500));
  const action = paragraphs
    .filter(paragraph => paragraph.kind === 'prose')
    .map(paragraph => paragraph.text)
    .join('\n\n')
    .trim();
  const dialogue = paragraphs
    .filter(paragraph => paragraph.kind === 'dialogue')
    .map(paragraph => paragraph.text)
    .join('\n')
    .trim();

  return { action, dialogue };
}

function enforceDirectorSceneGoal(sceneGoal: unknown, canonicalPlayerAction: string, fallbackSceneGoal: string): string {
  const candidate = cleanText(sceneGoal, 220);
  if (!candidate) return fallbackSceneGoal;

  const normalizedGoal = candidate
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const normalizedAction = canonicalPlayerAction
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalizedAction && normalizedGoal.includes(normalizedAction)) {
    return candidate;
  }

  return cleanText(`${candidate} Conséquence directe à traiter: ${canonicalPlayerAction}.`, 220);
}

function coerceDirectorBrief(source: unknown, fallback: StoryDirectorBrief): StoryDirectorBrief {
  if (!isObjectRecord(source)) return fallback;

  const mustInclude = Array.isArray(source.must_include)
    ? source.must_include.map(item => cleanText(item, 120)).filter(Boolean).slice(0, 4)
    : [];
  const requiredWorldSignals = Array.isArray(source.required_world_signals)
    ? source.required_world_signals.map(item => cleanText(item, 40)).filter(Boolean).slice(0, 4)
    : [];
  const canonicalPlayerAction = cleanText(fallback.player_action, 220) || 'agir immédiatement sous pression';

  return {
    player_action: canonicalPlayerAction,
    scene_goal: enforceDirectorSceneGoal(source.scene_goal, canonicalPlayerAction, fallback.scene_goal),
    tension: cleanText(source.tension, 220) || fallback.tension,
    must_include: mustInclude.length ? mustInclude : fallback.must_include,
    required_world_signals: requiredWorldSignals.length ? requiredWorldSignals : fallback.required_world_signals,
    section_type: cleanText(source.section_type, 40) || fallback.section_type,
    atmosphere: cleanText(source.atmosphere, 40) || fallback.atmosphere
  };
}

function formatPipelineRawResponse(
  scribeSummary: string,
  directorBrief: StoryDirectorBrief,
  writerScene: string,
  brainPayload: Record<string, unknown>
): string {
  return [
    '[AGENT:SCRIBE]',
    cleanText(scribeSummary, 4000),
    '',
    '[AGENT:DIRECTOR]',
    JSON.stringify(directorBrief, null, 2),
    '',
    '[AGENT:WRITER]',
    cleanText(writerScene, 12000),
    '',
    '[AGENT:BRAIN]',
    JSON.stringify(brainPayload, null, 2)
  ].join('\n');
}

function buildPipelineStoryPayload(
  turnNumber: number,
  writerScene: string,
  directorBrief: StoryDirectorBrief,
  brainPayload: Record<string, unknown>
): Record<string, unknown> {
  const rawChapterTitle = cleanText(brainPayload.chapter_title, 90);
  const chapterTitle = rawChapterTitle && !isGenericChapterTitle(rawChapterTitle)
    ? rawChapterTitle
    : deriveFallbackChapterTitleFromScene(writerScene, turnNumber);
  const sectionType = cleanText(brainPayload.section_type, 40) || cleanText(directorBrief.section_type, 40) || 'action';
  const atmosphere = cleanText(brainPayload.atmosphere, 80) || cleanText(directorBrief.atmosphere, 80) || 'tense';
  const userEditsApplied = cleanText(brainPayload.user_edits_applied, 180) || null;
  const sceneDescription = cleanText(brainPayload.scene_description, 180) || DEFAULT_SCENE_DESCRIPTION;

  const memoryUpdates = coerceMemoryUpdates(
    isObjectRecord(brainPayload.memory_updates)
      ? brainPayload.memory_updates
      : {}
  );

  const stateUpdate = coerceStateUpdate(
    isObjectRecord(brainPayload.state_update)
      ? brainPayload.state_update
      : {}
  );

  const safeChoices = Array.isArray(brainPayload.choices) ? brainPayload.choices : [];
  const scene = sanitizeNarrativeText(writerScene, 5500) || 'Le récit reprend en mode de secours.';
  const splitScene = splitWriterScene(scene);
  const action = splitScene.action || (splitScene.dialogue ? '' : scene);
  const dialogue = splitScene.dialogue;

  return {
    chapter_title: chapterTitle,
    chapter_number: turnNumber,
    section_type: sectionType,
    narrative: {
      context: '',
      action,
      dialogue,
      reflection: '',
      atmosphere
    },
    choices: safeChoices,
    memory_updates: memoryUpdates,
    state_update: stateUpdate,
    scene_description: sceneDescription,
    user_edits_applied: userEditsApplied
  };
}

async function callPipelineStep(
  step: StoryPipelineStep,
  systemPrompt: string,
  userPrompt: string,
  config: StoryProviderConfig,
  requireJsonObject = false
): Promise<string> {
  const normalizedConfig = normalizeProviderConfig(config);
  const providerId = normalizedConfig.providerId;
  const maxTokens = getStepTokenBudget(normalizedConfig, step);
  const temperature = getStepTemperature(step);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  if (OPENAI_COMPATIBLE_PROVIDER_IDS.has(providerId)) {
    if (requireJsonObject) {
      try {
        const response = await callOpenAiCompatibleRaw(messages as any, normalizedConfig, {
          maxTokens,
          temperature,
          skipReasoning: true,
          responseFormat: { type: 'json_object' }
        });

        const content = cleanText(response.content, 16000);
        if (content) return content;
      } catch (error) {
        logger.warn('storyEngine: response_format json_object indisponible, fallback prompt strict.', error);
      }
    }

    const retryResponse = await callOpenAiCompatibleRaw(messages as any, normalizedConfig, {
      maxTokens,
      temperature,
      skipReasoning: step !== 'writer'
    });

    return cleanText(retryResponse.content, 16000);
  }

  const strictUserPrompt = requireJsonObject
    ? `${userPrompt}\n\nRAPPEL FINAL: réponds uniquement en JSON valide, sans markdown.`
    : userPrompt;

  const raw = await callTextModel(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: strictUserPrompt }],
    normalizedConfig,
    {
      maxTokens,
      temperature,
      skipReasoning: step !== 'writer'
    }
  );

  return cleanText(raw, 16000);
}

async function runScribeStep(messages: ChatMessage[], config: StoryProviderConfig, turnNumber: number): Promise<string> {
  const normalizedMessages = messages.map(message => (
    message.role === 'user'
      ? { ...message, content: toSubAgentHistoryLine(message).replace(/^Joueur:\s*/, '') }
      : { ...message, content: cleanText(message.content, 5000) }
  ));
  const userPrompt = buildPipelineScribeUserPrompt(normalizedMessages, turnNumber);
  const raw = await callPipelineStep('scribe', STORY_PIPELINE_SCRIBE_SYSTEM_PROMPT, userPrompt, config, false);
  return cleanText(raw, 650);
}

async function runDirectorStep(
  messages: ChatMessage[],
  scribeSummary: string,
  config: StoryProviderConfig,
  turnNumber: number
): Promise<StoryDirectorBrief> {
  const fallback = fallbackDirectorBrief(messages, scribeSummary);
  const userPrompt = buildPipelineDirectorUserPrompt(scribeSummary, fallback.player_action, turnNumber);
  const raw = await callPipelineStep('director', STORY_PIPELINE_DIRECTOR_SYSTEM_PROMPT, userPrompt, config, true);
  return coerceDirectorBrief(parseJsonSafely(raw), fallback);
}

async function runWriterStep(
  scribeSummary: string,
  directorBrief: StoryDirectorBrief,
  config: StoryProviderConfig
): Promise<string> {
  const userPrompt = buildPipelineWriterUserPromptWithDirector(scribeSummary, directorBrief);
  const raw = await callPipelineStep('writer', STORY_PIPELINE_WRITER_SYSTEM_PROMPT, userPrompt, config, false);
  return sanitizeNarrativeText(raw, 5500);
}

async function runBrainStep(
  writerScene: string,
  directorBrief: StoryDirectorBrief,
  config: StoryProviderConfig
): Promise<Record<string, unknown>> {
  const userPrompt = buildPipelineBrainUserPrompt(writerScene, directorBrief);
  const raw = await callPipelineStep('brain', STORY_PIPELINE_BRAIN_SYSTEM_PROMPT, userPrompt, config, true);
  const parsed = parseJsonSafely(raw);
  if (parsed) return parsed;
  throw new Error('Extraction mécanique invalide: JSON introuvable.');
}

export async function generateStoryTurn(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  turnNumber: number,
  providerOverrides: StoryTurnPipelineConfigOverrides = {}
): Promise<StoryTurnGenerationResult> {
  const safeMessages = sanitizeStoryMessageHistory(messages);
  const baseConfig = normalizeProviderConfig(config);
  const scribeConfig = resolveStepConfig(baseConfig, providerOverrides.scribe);
  const directorConfig = resolveStepConfig(baseConfig, providerOverrides.director);
  const writerConfig = resolveStepConfig(baseConfig, providerOverrides.writer);
  const brainConfig = resolveStepConfig(baseConfig, providerOverrides.brain);

  let completedSteps = 0;

  let scribeSummary = fallbackScribeSummary(safeMessages, turnNumber);
  try {
    const result = await runScribeStep(safeMessages, scribeConfig, turnNumber);
    if (result) {
      scribeSummary = result;
      completedSteps = 1;
    }
  } catch (error) {
    logger.warn('storyEngine: étape 1 (scribe) indisponible, fallback local.', error);
    recordDiagnosticEvent({
      level: 'warn',
      category: 'story-turn-step',
      stage: 'scribe',
      message: 'Fallback local sur le scribe.',
      providerId: scribeConfig.providerId,
      model: scribeConfig.model,
      runtimeMode: 'agentic-subagents',
      validation: 'repaired',
      meta: error
    });
  }

  let directorBrief = fallbackDirectorBrief(safeMessages, scribeSummary);
  try {
    directorBrief = await runDirectorStep(safeMessages, scribeSummary, directorConfig, turnNumber);
    completedSteps = Math.max(completedSteps, 2);
  } catch (error) {
    logger.warn('storyEngine: étape 2 (directeur) indisponible, fallback local.', error);
    recordDiagnosticEvent({
      level: 'warn',
      category: 'story-turn-step',
      stage: 'director',
      message: 'Fallback local sur le directeur.',
      providerId: directorConfig.providerId,
      model: directorConfig.model,
      runtimeMode: 'agentic-subagents',
      validation: 'repaired',
      meta: error
    });
  }

  let writerScene = fallbackWriterScene(scribeSummary, safeMessages, turnNumber);
  try {
    const result = await runWriterStep(scribeSummary, directorBrief, writerConfig);
    if (result) {
      writerScene = result;
      completedSteps = Math.max(completedSteps, 3);
    }
  } catch (error) {
    logger.warn('storyEngine: étape 3 (écrivain) indisponible, fallback local.', error);
    recordDiagnosticEvent({
      level: 'warn',
      category: 'story-turn-step',
      stage: 'writer',
      message: 'Fallback local sur l’écrivain.',
      providerId: writerConfig.providerId,
      model: writerConfig.model,
      runtimeMode: 'agentic-subagents',
      validation: 'repaired',
      meta: error
    });
  }

  let brainPayload = fallbackBrainPayload();
  try {
    brainPayload = await runBrainStep(writerScene, directorBrief, brainConfig);
    completedSteps = 4;
  } catch (error) {
    logger.warn('storyEngine: étape 4 (cerveau) indisponible, fallback mécanique local.', error);
    recordDiagnosticEvent({
      level: 'warn',
      category: 'story-turn-step',
      stage: 'brain',
      message: 'Fallback mécanique sur le cerveau.',
      providerId: brainConfig.providerId,
      model: brainConfig.model,
      runtimeMode: 'agentic-subagents',
      validation: 'repaired',
      meta: error
    });
  }

  const payload = buildPipelineStoryPayload(turnNumber, writerScene, directorBrief, brainPayload);
  const payloadRaw = JSON.stringify(payload);
  const rawResponse = formatPipelineRawResponse(scribeSummary, directorBrief, writerScene, brainPayload);
  const chapter = parseStoryResponse(payloadRaw, turnNumber);

  if (!hasPlayableChapterContent(chapter)) {
    const emergencyWriterScene = fallbackWriterScene(scribeSummary, safeMessages, turnNumber);
    const emergencyBrainPayload = fallbackBrainPayload();
    const emergencyPayload = buildPipelineStoryPayload(turnNumber, emergencyWriterScene, directorBrief, emergencyBrainPayload);
    const emergencyRaw = formatPipelineRawResponse(
      scribeSummary,
      directorBrief,
      emergencyWriterScene,
      emergencyBrainPayload
    );
    recordDiagnosticEvent({
      level: 'warn',
      category: 'story-turn-validation',
      stage: 'story-turn',
      message: 'Le chapitre généré était inexploitable, fallback d’urgence appliqué.',
      providerId: baseConfig.providerId,
      model: baseConfig.model,
      runtimeMode: 'agentic-subagents',
      validation: 'repaired',
      meta: {
        turnNumber,
        completedSteps
      }
    });
    return validateStoryTurnGenerationResult({
      chapter: parseStoryResponse(JSON.stringify(emergencyPayload), turnNumber),
      rawResponse: emergencyRaw,
      mode: 'agentic-subagents',
      steps: Math.max(1, completedSteps),
      toolCalls: 0
    }, turnNumber);
  }

  return validateStoryTurnGenerationResult({
    chapter,
    rawResponse,
    mode: 'agentic-subagents',
    steps: Math.max(1, completedSteps),
    toolCalls: 0
  }, turnNumber);
}

function coerceBackgroundWorldEvent(source: unknown): BackgroundWorldEvent | null {
  if (!isObjectRecord(source)) return null;

  const title = cleanText(source.title ?? source.event_title, 90);
  const summaryPublic = cleanText(source.summary_public ?? source.summary ?? source.event_summary_public, 260);
  const summaryPrivate = cleanText(source.summary_private ?? source.event_summary_private, 420);
  const promptHook = cleanText(source.prompt_hook, 220);

  const injectNow = typeof source.inject_now === 'boolean'
    ? source.inject_now
    : typeof source.inject_now === 'string'
      ? /^(true|yes|1)$/i.test(source.inject_now.trim())
      : false;

  const memoryUpdates = coerceMemoryUpdates(source.memory_updates ?? source);
  const stateUpdate = coerceStateUpdate(source.state_update ?? source);

  const hasSignal = Boolean(
    title ||
    summaryPublic ||
    summaryPrivate ||
    promptHook ||
    stateUpdate ||
    memoryUpdates.notes.length ||
    memoryUpdates.relations.length ||
    memoryUpdates.places.length ||
    memoryUpdates.injuries.length ||
    memoryUpdates.resources.length
  );

  if (!hasSignal) return null;

  return {
    title: title || 'Mouvement de la galaxie',
    summary_public: summaryPublic,
    summary_private: summaryPrivate || undefined,
    inject_now: injectNow,
    memory_updates: memoryUpdates,
    state_update: stateUpdate,
    prompt_hook: promptHook || undefined
  };
}

function hasBackgroundEventImpact(event: BackgroundWorldEvent | null): boolean {
  return Boolean(
    event && (
      event.inject_now ||
      event.summary_public ||
      event.summary_private ||
      event.prompt_hook ||
      event.state_update ||
      event.memory_updates.notes.length ||
      event.memory_updates.relations.length ||
      event.memory_updates.places.length ||
      event.memory_updates.injuries.length ||
      event.memory_updates.resources.length
    )
  );
}

const BACKGROUND_WORLD_OBSERVER_SYSTEM_PROMPT = `Tu es l'OBSERVATEUR hors-écran d'une campagne Star Wars.
Tu détectes le mouvement invisible de la galaxie entre deux tours.
Règles absolues:
- Résume en 120 mots maximum.
- Donne seulement ce qui change réellement hors champ.
- Pas de JSON, pas de markdown, pas de listes.`;

const BACKGROUND_WORLD_ADJUDICATOR_SYSTEM_PROMPT = `Tu es l'ADJUDICATEUR hors-écran d'une campagne Star Wars.
Tu convertis un mouvement galactique en conséquences mécaniques propres.
Règles absolues:
- Réponds uniquement en JSON valide.
- Pas de prose hors JSON.
- Si rien d'utile ne bouge, renvoie un JSON quasiment vide mais valide.`;

function buildBackgroundWorldSystemPrompt(input: BackgroundWorldInput): string {
  const setup = input.setup;
  const protagonist = [setup.protagonistFirstName || '', setup.protagonistLastName || ''].join(' ').trim() || 'Le protagoniste';

  const recentBlock = input.recentSummary.length
    ? `\nRÉSUMÉ RÉCENT:\n${input.recentSummary.map(item => `- ${cleanText(item, 220)}`).join('\n')}`
    : '';

  const memoryBlock = input.memoryFacts.length
    ? `\nMÉMOIRE LONG TERME:\n${input.memoryFacts.slice(-20).map(item => `- ${cleanText(item, 200)}`).join('\n')}`
    : '';

  let worldBlock = '\nÉTAT MONDE: indisponible';
  if (input.worldState) {
    const p = input.worldState.player;
    const topFactions = Object.entries(input.worldState.factions)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 5)
      .map(([id, score]) => `${id}=${score > 0 ? '+' : ''}${score}`)
      .join(', ');

    const npcs = input.worldState.npcs
      .filter(npc => npc.alive !== false)
      .slice(0, 8)
      .map(npc => `${npc.name}(${npc.status}, aff=${npc.affinity})`)
      .join(', ');

    worldBlock = `\nÉTAT MONDE:\n- HP=${p.hp}/100 | Crédits=${p.credits}\n- Lieu=${p.location} | Date=${p.date}\n- PNJs=${npcs || 'aucun'}\n- Factions=${topFactions || 'neutre'}`;
  }

  return `Tu es le Simulateur Galactique hors-écran d'une campagne Star Wars.
Tu résous uniquement les dynamiques de fond entre les tours du joueur.

SETUP:
- Protagoniste: ${protagonist}
- Ère: ${setup.era} | Faction: ${setup.faction} | Rôle: ${setup.role}
- Prémisse: ${setup.premise || 'Libre'}${worldBlock}${recentBlock}${memoryBlock}`;
}

function buildBackgroundWorldObserverPrompt(turnNumber: number): string {
  return `Tour ${turnNumber}. Décris le mouvement galactique hors-écran le plus pertinent pour la continuité immédiate du joueur.`;
}

function buildBackgroundWorldAdjudicatorPrompt(observerSummary: string, turnNumber: number): string {
  return `Tour ${turnNumber}. Mouvement hors-écran observé:
${cleanText(observerSummary, 1200)}

Réponds UNIQUEMENT en JSON valide avec ce contrat:
{
  "title": "Titre court",
  "summary_public": "Message bref éventuellement montrable au joueur",
  "summary_private": "Contexte MJ optionnel",
  "inject_now": false,
  "prompt_hook": "Consigne courte pour le prochain tour",
  "memory_updates": { "relations": [], "places": [], "injuries": [], "resources": [], "notes": [] },
  "state_update": {}
}`;
}

export async function generateBackgroundWorldEvent(
  input: BackgroundWorldInput,
  config: StoryProviderConfig
): Promise<BackgroundWorldGenerationResult> {
  const normalizedConfig = normalizeProviderConfig(config);
  const contextPrompt = buildBackgroundWorldSystemPrompt(input);

  try {
    const observerSummary = cleanText(
      await callPipelineStep(
        'world-observer',
        `${BACKGROUND_WORLD_OBSERVER_SYSTEM_PROMPT}\n\n${contextPrompt}`,
        buildBackgroundWorldObserverPrompt(input.turnNumber),
        normalizedConfig,
        false
      ),
      1200
    );

    const rawResponse = await callPipelineStep(
      'world-adjudicator',
      `${BACKGROUND_WORLD_ADJUDICATOR_SYSTEM_PROMPT}\n\n${contextPrompt}`,
      buildBackgroundWorldAdjudicatorPrompt(observerSummary, input.turnNumber),
      normalizedConfig,
      true
    );
    const parsed = parseJsonSafely(rawResponse);
    const event = coerceBackgroundWorldEvent(parsed);

    return validateBackgroundWorldGenerationResult({
      event: hasBackgroundEventImpact(event) ? event : null,
      rawResponse: [
        '[AGENT:WORLD-OBSERVER]',
        observerSummary,
        '',
        '[AGENT:WORLD-ADJUDICATOR]',
        rawResponse
      ].join('\n'),
      mode: 'agentic-subagents',
      steps: observerSummary ? 2 : 1,
      toolCalls: 0
    });
  } catch (error) {
    logger.warn('storyEngine: génération hors-écran indisponible.', error);
    recordDiagnosticEvent({
      level: 'warn',
      category: 'background-world',
      stage: 'world-observer/world-adjudicator',
      message: 'La génération hors-écran a échoué.',
      providerId: normalizedConfig.providerId,
      model: normalizedConfig.model,
      runtimeMode: 'agentic-subagents',
      validation: 'failed',
      meta: error
    });
    return validateBackgroundWorldGenerationResult({
      event: null,
      rawResponse: '',
      mode: 'agentic-subagents',
      steps: 0,
      toolCalls: 0
    });
  }
}
