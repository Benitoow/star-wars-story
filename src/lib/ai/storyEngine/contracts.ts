import {
  DEFAULT_TEXT_MODEL_ID,
  DEFAULT_TEXT_PROVIDER_ID,
  SUPPORTED_TEXT_PROVIDER_IDS,
  normalizeTextProviderId
} from '$lib/config/providers';
import type {
  BackgroundWorldEvent,
  BackgroundWorldGenerationResult,
  ChatMessage,
  StoryChapter,
  StoryGenerationMode,
  StoryProviderConfig,
  StoryTurnGenerationResult
} from './types';
import { cleanText, isObjectRecord } from './utils/shared';

export const PUBLIC_STORY_GENERATION_MODES = ['structured-json', 'agentic-subagents'] as const;

export function normalizeStoryGenerationMode(mode: unknown): StoryGenerationMode {
  const normalized = cleanText(mode, 60).toLowerCase();
  if (normalized === 'structured-json') return 'structured-json';
  return 'agentic-subagents';
}

export function isPlayableStoryChapter(chapter: StoryChapter): boolean {
  return Boolean(cleanText(chapter.narrative.action, 220) || cleanText(chapter.narrative.dialogue, 220));
}

export function assertSupportedStoryProviderConfig(
  config: StoryProviderConfig,
  options: { allowNone?: boolean } = {}
): StoryProviderConfig {
  const providerId = normalizeTextProviderId(config.providerId);
  const allowNone = options.allowNone === true;

  if (!SUPPORTED_TEXT_PROVIDER_IDS.has(providerId)) {
    throw new Error(`Provider texte non supporté: ${config.providerId || 'inconnu'}.`);
  }

  if (providerId === 'none' && !allowNone) {
    throw new Error('Aucun provider texte sélectionné.');
  }

  return {
    providerId,
    model: cleanText(config.model, 160) || DEFAULT_TEXT_MODEL_ID,
    apiKey: cleanText(config.apiKey, 500),
    ollamaUrl: cleanText(config.ollamaUrl, 240) || undefined,
    reasoningEffortOverride: cleanText(config.reasoningEffortOverride, 16) || undefined
  };
}

export function sanitizeStoryMessageHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.flatMap(message => {
    if (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant') return [];
    const content = cleanText(message.content, 24000);
    if (!content) return [];
    return [{ role: message.role, content }];
  });
}

export function validateStoryChapter(chapter: StoryChapter, expectedTurnNumber?: number): StoryChapter {
  if (!isObjectRecord(chapter)) {
    throw new Error('Chapitre invalide: structure absente.');
  }

  if (!isObjectRecord(chapter.narrative)) {
    throw new Error('Chapitre invalide: narration absente.');
  }

  const chapterNumber = typeof chapter.chapter_number === 'number' && Number.isFinite(chapter.chapter_number)
    ? chapter.chapter_number
    : expectedTurnNumber;

  if (!chapterNumber || chapterNumber < 0) {
    throw new Error('Chapitre invalide: numéro de tour absent.');
  }

  if (expectedTurnNumber !== undefined && chapterNumber !== expectedTurnNumber) {
    throw new Error(`Chapitre invalide: tour ${chapterNumber} inattendu (attendu: ${expectedTurnNumber}).`);
  }

  const normalized: StoryChapter = {
    ...chapter,
    chapter_title: cleanText(chapter.chapter_title, 120) || `Tour ${chapterNumber}`,
    chapter_number: chapterNumber,
    section_type: cleanText(chapter.section_type, 40) || 'action',
    narrative: {
      context: cleanText(chapter.narrative.context, 4000),
      action: cleanText(chapter.narrative.action, 12000),
      dialogue: cleanText(chapter.narrative.dialogue, 8000),
      reflection: cleanText(chapter.narrative.reflection, 4000),
      atmosphere: cleanText(chapter.narrative.atmosphere, 120) || 'tense'
    },
    choices: Array.isArray(chapter.choices) ? chapter.choices : [],
    memory_updates: chapter.memory_updates,
    scene_description: cleanText(chapter.scene_description, 240),
    user_edits_applied: chapter.user_edits_applied ? cleanText(chapter.user_edits_applied, 240) : null,
    state_update: chapter.state_update
  };

  if (!isPlayableStoryChapter(normalized)) {
    throw new Error('Chapitre invalide: aucune action ni dialogue exploitable.');
  }

  return normalized;
}

export function validateStoryTurnGenerationResult(
  result: StoryTurnGenerationResult,
  expectedTurnNumber?: number
): StoryTurnGenerationResult {
  return {
    chapter: validateStoryChapter(result.chapter, expectedTurnNumber),
    rawResponse: cleanText(result.rawResponse, 32000),
    mode: normalizeStoryGenerationMode(result.mode),
    steps: typeof result.steps === 'number' && Number.isFinite(result.steps) && result.steps >= 0 ? result.steps : 0,
    toolCalls: typeof result.toolCalls === 'number' && Number.isFinite(result.toolCalls) && result.toolCalls >= 0 ? result.toolCalls : 0
  };
}

export function validateBackgroundWorldEvent(event: BackgroundWorldEvent | null): BackgroundWorldEvent | null {
  if (!event) return null;

  const title = cleanText(event.title, 120);
  const summaryPublic = cleanText(event.summary_public, 400);
  const summaryPrivate = cleanText(event.summary_private, 600);
  const promptHook = cleanText(event.prompt_hook, 240);
  const hasSignal = Boolean(
    title ||
    summaryPublic ||
    summaryPrivate ||
    promptHook ||
    event.state_update ||
    event.memory_updates?.relations?.length ||
    event.memory_updates?.places?.length ||
    event.memory_updates?.injuries?.length ||
    event.memory_updates?.resources?.length ||
    event.memory_updates?.notes?.length
  );

  if (!hasSignal) return null;

  return {
    ...event,
    title: title || 'Mouvement de la galaxie',
    summary_public: summaryPublic,
    summary_private: summaryPrivate || undefined,
    prompt_hook: promptHook || undefined,
    inject_now: event.inject_now === true
  };
}

export function validateBackgroundWorldGenerationResult(
  result: BackgroundWorldGenerationResult
): BackgroundWorldGenerationResult {
  return {
    event: validateBackgroundWorldEvent(result.event),
    rawResponse: cleanText(result.rawResponse, 20000),
    mode: normalizeStoryGenerationMode(result.mode),
    steps: typeof result.steps === 'number' && Number.isFinite(result.steps) && result.steps >= 0 ? result.steps : 0,
    toolCalls: typeof result.toolCalls === 'number' && Number.isFinite(result.toolCalls) && result.toolCalls >= 0 ? result.toolCalls : 0
  };
}

export function getFrozenStoryEngineSummary(): string {
  return `Story engine gelé: ${DEFAULT_TEXT_PROVIDER_ID} uniquement, orchestration à sous-agents, modes publics ${PUBLIC_STORY_GENERATION_MODES.join(' + ')}.`;
}
