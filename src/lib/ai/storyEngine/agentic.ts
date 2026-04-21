import { logger } from '$lib/utils/logger';
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
  STORY_PIPELINE_SCRIBE_SYSTEM_PROMPT,
  STORY_PIPELINE_WRITER_SYSTEM_PROMPT,
  buildPipelineBrainUserPrompt,
  buildPipelineScribeUserPrompt,
  buildPipelineWriterUserPrompt
} from './prompts';

type StoryPipelineStep = 'scribe' | 'writer' | 'brain';

export type StoryTurnPipelineConfigOverrides = {
  scribe?: StoryProviderConfig;
  writer?: StoryProviderConfig;
  brain?: StoryProviderConfig;
};

const OPENAI_COMPATIBLE_PROVIDER_IDS = new Set<string>(['openrouter', 'openai', 'mistral', 'grok']);
const DEFAULT_SCENE_DESCRIPTION = 'Cinematic Star Wars scene with dramatic lighting and dynamic action';

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProviderConfig(config: StoryProviderConfig): StoryProviderConfig {
  const providerId = normalizeProviderId(config.providerId);
  if (providerId === config.providerId) return config;
  return { ...config, providerId };
}

function resolveStepConfig(baseConfig: StoryProviderConfig, override?: StoryProviderConfig): StoryProviderConfig {
  return normalizeProviderConfig(override ?? baseConfig);
}

function getStepTokenBudget(stepConfig: StoryProviderConfig, step: StoryPipelineStep): number {
  const caps = detectModelCapabilities(stepConfig);
  if (step === 'scribe') return clamp(Math.round(caps.maxOutputTokens * 0.2), 240, 560);
  if (step === 'writer') return clamp(Math.round(caps.maxOutputTokens * 0.72), 900, 2600);
  return clamp(Math.round(caps.maxOutputTokens * 0.58), 900, 2200);
}

function getStepTemperature(step: StoryPipelineStep): number {
  if (step === 'writer') return 0.95;
  if (step === 'brain') return 0.2;
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
  return cleanText(latestUser?.content, 360);
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
  return Boolean(cleanText(chapter.narrative.action, 260));
}

function buildPipelineStoryPayload(
  turnNumber: number,
  writerScene: string,
  brainPayload: Record<string, unknown>
): Record<string, unknown> {
  const rawChapterTitle = cleanText(brainPayload.chapter_title, 90);
  const chapterTitle = rawChapterTitle && !isGenericChapterTitle(rawChapterTitle)
    ? rawChapterTitle
    : deriveFallbackChapterTitleFromScene(writerScene, turnNumber);
  const sectionType = cleanText(brainPayload.section_type, 40) || 'action';
  const atmosphere = cleanText(brainPayload.atmosphere, 80) || 'tense';
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
  const action = sanitizeNarrativeText(writerScene, 5500) || 'Le récit reprend en mode de secours.';

  return {
    chapter_title: chapterTitle,
    chapter_number: turnNumber,
    section_type: sectionType,
    narrative: {
      context: '',
      action,
      dialogue: '',
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
    normalizedConfig
  );

  return cleanText(raw, 16000);
}

async function runScribeStep(messages: ChatMessage[], config: StoryProviderConfig, turnNumber: number): Promise<string> {
  const userPrompt = buildPipelineScribeUserPrompt(messages, turnNumber);
  const raw = await callPipelineStep('scribe', STORY_PIPELINE_SCRIBE_SYSTEM_PROMPT, userPrompt, config, false);
  return cleanText(raw, 650);
}

async function runWriterStep(scribeSummary: string, config: StoryProviderConfig): Promise<string> {
  const userPrompt = buildPipelineWriterUserPrompt(scribeSummary);
  const raw = await callPipelineStep('writer', STORY_PIPELINE_WRITER_SYSTEM_PROMPT, userPrompt, config, false);
  return sanitizeNarrativeText(raw, 5500);
}

async function runBrainStep(writerScene: string, config: StoryProviderConfig): Promise<Record<string, unknown>> {
  const userPrompt = buildPipelineBrainUserPrompt(writerScene);
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
  const baseConfig = normalizeProviderConfig(config);
  const scribeConfig = resolveStepConfig(baseConfig, providerOverrides.scribe);
  const writerConfig = resolveStepConfig(baseConfig, providerOverrides.writer);
  const brainConfig = resolveStepConfig(baseConfig, providerOverrides.brain);

  let completedSteps = 0;

  let scribeSummary = fallbackScribeSummary(messages, turnNumber);
  try {
    const result = await runScribeStep(messages, scribeConfig, turnNumber);
    if (result) {
      scribeSummary = result;
      completedSteps = 1;
    }
  } catch (error) {
    logger.warn('storyEngine: étape 1 (scribe) indisponible, fallback local.', error);
  }

  let writerScene = fallbackWriterScene(scribeSummary, messages, turnNumber);
  try {
    const result = await runWriterStep(scribeSummary, writerConfig);
    if (result) {
      writerScene = result;
      completedSteps = Math.max(completedSteps, 2);
    }
  } catch (error) {
    logger.warn('storyEngine: étape 2 (écrivain) indisponible, fallback local.', error);
  }

  let brainPayload = fallbackBrainPayload();
  try {
    brainPayload = await runBrainStep(writerScene, brainConfig);
    completedSteps = 3;
  } catch (error) {
    logger.warn('storyEngine: étape 3 (cerveau) indisponible, fallback mécanique local.', error);
  }

  const payload = buildPipelineStoryPayload(turnNumber, writerScene, brainPayload);
  const rawResponse = JSON.stringify(payload);
  const chapter = parseStoryResponse(rawResponse, turnNumber);

  if (!hasPlayableChapterContent(chapter)) {
    const emergencyPayload = buildPipelineStoryPayload(turnNumber, fallbackWriterScene(scribeSummary, messages, turnNumber), fallbackBrainPayload());
    const emergencyRaw = JSON.stringify(emergencyPayload);
    return {
      chapter: parseStoryResponse(emergencyRaw, turnNumber),
      rawResponse: emergencyRaw,
      mode: 'structured-json',
      steps: Math.max(1, completedSteps),
      toolCalls: 0
    };
  }

  return {
    chapter,
    rawResponse,
    mode: 'structured-json',
    steps: Math.max(1, completedSteps),
    toolCalls: 0
  };
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
- Prémisse: ${setup.premise || 'Libre'}${worldBlock}${recentBlock}${memoryBlock}

Réponds UNIQUEMENT en JSON valide:
{
  "title": "Titre court",
  "summary_public": "Message bref",
  "summary_private": "Contexte MJ optionnel",
  "inject_now": false,
  "prompt_hook": "Consigne courte",
  "memory_updates": { "relations": [], "places": [], "injuries": [], "resources": [], "notes": [] },
  "state_update": {}
}`;
}

function buildBackgroundWorldTickPrompt(turnNumber: number): string {
  return `Résous le tick hors-écran après le tour ${turnNumber}.`;
}

export async function generateBackgroundWorldEvent(
  input: BackgroundWorldInput,
  config: StoryProviderConfig
): Promise<BackgroundWorldGenerationResult> {
  const normalizedConfig = normalizeProviderConfig(config);
  const messages: ChatMessage[] = [
    { role: 'system', content: buildBackgroundWorldSystemPrompt(input) },
    { role: 'user', content: buildBackgroundWorldTickPrompt(input.turnNumber) }
  ];

  try {
    const rawResponse = await callTextModel(messages, normalizedConfig);
    const parsed = parseJsonSafely(rawResponse);
    const event = coerceBackgroundWorldEvent(parsed);

    return {
      event: hasBackgroundEventImpact(event) ? event : null,
      rawResponse,
      mode: 'structured-json',
      steps: 1,
      toolCalls: 0
    };
  } catch (error) {
    logger.warn('storyEngine: génération hors-écran indisponible.', error);
    return {
      event: null,
      rawResponse: '',
      mode: 'structured-json',
      steps: 0,
      toolCalls: 0
    };
  }
}
