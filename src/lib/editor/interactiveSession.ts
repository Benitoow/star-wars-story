import type { StorySetup } from '$lib/stores/editor';
import type {
  ChatMessage,
  StoryChapter,
  WorldState
} from '$lib/ai/storyEngine';
import {
  normalizeStoryGenerationMode,
  validateStoryChapter
} from '$lib/ai/storyEngine';
import { recordDiagnosticEvent } from '$lib/utils/logger';
import { db } from '$lib/db';

const INTERACTIVE_SESSION_PREFIX = 'sw_svelte_interactive_story_';
export const INTERACTIVE_SESSION_VERSION = 2;

export interface LoggedBackgroundEvent {
  id: string;
  turn: number;
  title: string;
  summary: string;
  promptHook?: string;
  privateSummary?: string;
  visibleNow?: boolean;
}

export interface InteractiveSessionPayload {
  version: 2;
  turnNumber: number;
  selectedTrame: string | null;
  storyRuntimeMode?: string | null;
  currentChapter: StoryChapter | null;
  chapterHistory: StoryChapter[];
  actionHistory: string[];
  aiMessages: ChatMessage[];
  memoryLog: string[];
  setupSnapshot: StorySetup;
  backgroundEvents?: LoggedBackgroundEvent[];
  worldState?: WorldState;
  campaignArchive?: string[];
}

function storySessionKey(id: string): string {
  return `${INTERACTIVE_SESSION_PREFIX}${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === 'string');
}

function sanitizeNumericRecord(values: unknown): Record<string, number> {
  if (!isRecord(values)) return {};

  const entries = Object.entries(values).filter(
    (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number' && Number.isFinite(entry[1])
  );

  return Object.fromEntries(entries);
}

function sanitizeClocks(values: unknown): NonNullable<WorldState['clocks']> {
  if (!isRecord(values)) return {};

  const entries = Object.entries(values).flatMap(([key, clock]) => {
    if (!isRecord(clock)) return [];
    const current = typeof clock.current === 'number' && Number.isFinite(clock.current) ? clock.current : null;
    const max = typeof clock.max === 'number' && Number.isFinite(clock.max) ? clock.max : null;
    if (current === null || max === null) return [];
    return [[key, { current, max }] as const];
  });

  return Object.fromEntries(entries);
}

function sanitizeChronology(values: unknown): WorldState['chronology'] {
  if (!Array.isArray(values)) return [];

  return values.flatMap(value => {
    if (!isRecord(value)) return [];
    const chapter = typeof value.chapter === 'number' && Number.isFinite(value.chapter) ? value.chapter : null;
    const date = typeof value.date === 'string' ? value.date : '';
    const location = typeof value.location === 'string' ? value.location : '';
    const summary = typeof value.summary === 'string' ? value.summary : '';

    if (chapter === null || !date || !location || !summary) return [];

    return [{ chapter, date, location, summary }];
  });
}

function sanitizeBackgroundEvents(values: unknown): LoggedBackgroundEvent[] {
  if (!Array.isArray(values)) return [];

  return values.flatMap(value => {
    if (!isRecord(value)) return [];

    const title = typeof value.title === 'string' ? value.title : '';
    const summary = typeof value.summary === 'string' ? value.summary : '';
    if (!title && !summary) return [];

    return [{
      id: typeof value.id === 'string' && value.id ? value.id : `legacy-bg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      turn: typeof value.turn === 'number' && Number.isFinite(value.turn) ? value.turn : 0,
      title,
      summary,
      promptHook: typeof value.promptHook === 'string' ? value.promptHook : undefined,
      privateSummary: typeof value.privateSummary === 'string' ? value.privateSummary : undefined,
      visibleNow: typeof value.visibleNow === 'boolean' ? value.visibleNow : true
    }];
  });
}

function sanitizeChatMessages(values: unknown): ChatMessage[] {
  if (!Array.isArray(values)) return [];

  return values.flatMap(value => {
    if (!isRecord(value)) return [];
    if (value.role !== 'system' && value.role !== 'user' && value.role !== 'assistant') return [];
    if (typeof value.content !== 'string') return [];
    return [{ role: value.role, content: value.content }];
  });
}

function sanitizeSetupSnapshot(value: unknown, fallbackSetup: StorySetup): StorySetup {
  if (!isRecord(value)) return fallbackSetup;

  const setup = {
    ...fallbackSetup,
    era: typeof value.era === 'string' && value.era ? value.era : fallbackSetup.era,
    faction: typeof value.faction === 'string' && value.faction ? value.faction : fallbackSetup.faction,
    role: typeof value.role === 'string' && value.role ? value.role : fallbackSetup.role,
    premise: typeof value.premise === 'string' && value.premise ? value.premise : fallbackSetup.premise,
    protagonistFirstName: typeof value.protagonistFirstName === 'string' ? value.protagonistFirstName : fallbackSetup.protagonistFirstName,
    protagonistLastName: typeof value.protagonistLastName === 'string' ? value.protagonistLastName : fallbackSetup.protagonistLastName,
    protagonistAvatar: typeof value.protagonistAvatar === 'string' ? value.protagonistAvatar : fallbackSetup.protagonistAvatar,
    writingStyle: typeof value.writingStyle === 'string' ? value.writingStyle : fallbackSetup.writingStyle,
    writingTone: typeof value.writingTone === 'string' ? value.writingTone : fallbackSetup.writingTone,
    writingPov: typeof value.writingPov === 'string' ? value.writingPov : fallbackSetup.writingPov,
    writingLength: typeof value.writingLength === 'string' ? value.writingLength : fallbackSetup.writingLength,
    contentMode: typeof value.contentMode === 'string' ? value.contentMode : fallbackSetup.contentMode
  };

  return setup;
}

function sanitizeStoryChapterValue(value: unknown): StoryChapter | null {
  try {
    return validateStoryChapter(value as StoryChapter);
  } catch {
    return null;
  }
}

function sanitizeStoryChapterArray(values: unknown): StoryChapter[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap(value => {
    const chapter = sanitizeStoryChapterValue(value);
    return chapter ? [chapter] : [];
  });
}

function sanitizeWorldState(value: unknown): WorldState | undefined {
  if (!isRecord(value) || !isRecord(value.player)) return undefined;

  const playerCandidate = value.player;
  const hp = typeof playerCandidate.hp === 'number' && Number.isFinite(playerCandidate.hp) ? playerCandidate.hp : null;
  const credits = typeof playerCandidate.credits === 'number' && Number.isFinite(playerCandidate.credits) ? playerCandidate.credits : null;
  const location = typeof playerCandidate.location === 'string' ? playerCandidate.location.trim() : '';

  if (hp === null || credits === null || !location) return undefined;

  return {
    player: {
      hp,
      credits,
      location,
      date: typeof playerCandidate.date === 'string' ? playerCandidate.date : '',
      injuries: Array.isArray(playerCandidate.injuries)
        ? (playerCandidate.injuries as WorldState['player']['injuries'])
        : [],
      inventory: Array.isArray(playerCandidate.inventory)
        ? (playerCandidate.inventory as WorldState['player']['inventory'])
        : [],
      condition: playerCandidate.condition === 'critical' || playerCandidate.condition === 'active'
        ? playerCandidate.condition
        : undefined
    },
    npcs: Array.isArray(value.npcs) ? (value.npcs as WorldState['npcs']) : [],
    factions: sanitizeNumericRecord(value.factions) as WorldState['factions'],
    chronology: sanitizeChronology(value.chronology),
    clocks: sanitizeClocks(value.clocks),
    sector_influence: sanitizeNumericRecord(value.sector_influence) as WorldState['sector_influence'],
    rumors: sanitizeStringArray(value.rumors),
    environment_status: typeof value.environment_status === 'string' ? value.environment_status : undefined,
    director_instruction: typeof value.director_instruction === 'string' ? value.director_instruction : undefined
  };
}

export interface SessionStore {
  get(id: string): Promise<unknown>;
  put(id: string, payload: InteractiveSessionPayload): Promise<void>;
  delete(id: string): Promise<void>;
}

// Default backend: IndexedDB via Dexie. Injectable so logic can be unit-tested without IndexedDB.
const dexieSessionStore: SessionStore = {
  async get(id) {
    return (await db.sessions.get(id))?.payload;
  },
  async put(id, payload) {
    await db.sessions.put({ id, payload });
  },
  async delete(id) {
    await db.sessions.delete(id);
  }
};

// Shared validation/normalization for a parsed session object (from IndexedDB or legacy localStorage).
function sanitizeSessionObject(
  parsed: Partial<InteractiveSessionPayload>,
  id: string,
  fallbackSetup: StorySetup
): InteractiveSessionPayload | null {
  const parsedVersion = typeof parsed.version === 'number' ? parsed.version : 1;
  if (parsedVersion > INTERACTIVE_SESSION_VERSION) {
    recordDiagnosticEvent({
      level: 'warn',
      category: 'interactive-session',
      stage: 'load',
      message: 'Version de session trop récente, chargement refusé.',
      sessionId: id,
      validation: 'failed',
      meta: { version: parsedVersion }
    });
    return null;
  }

  const chapterHistory = sanitizeStoryChapterArray(parsed.chapterHistory);
  const currentChapter = sanitizeStoryChapterValue(parsed.currentChapter) ?? chapterHistory[chapterHistory.length - 1] ?? null;
  const backgroundEvents = sanitizeBackgroundEvents(parsed.backgroundEvents);
  const storedTurnNumber = typeof parsed.turnNumber === 'number' && Number.isFinite(parsed.turnNumber) && parsed.turnNumber >= 0
    ? parsed.turnNumber
    : chapterHistory.length;
  const worldState = sanitizeWorldState(parsed.worldState);
  const runtimeMode = parsed.storyRuntimeMode
    ? normalizeStoryGenerationMode(parsed.storyRuntimeMode)
    : null;

  if (parsed.worldState && !worldState) {
    recordDiagnosticEvent({
      level: 'warn',
      category: 'interactive-session',
      stage: 'load',
      message: 'World state de session rejeté car invalide.',
      sessionId: id,
      runtimeMode: runtimeMode || undefined,
      validation: 'repaired',
      meta: parsed.worldState
    });
  }

  const payload: InteractiveSessionPayload = {
    version: INTERACTIVE_SESSION_VERSION,
    turnNumber: storedTurnNumber,
    selectedTrame: typeof parsed.selectedTrame === 'string' ? parsed.selectedTrame : null,
    storyRuntimeMode: runtimeMode,
    currentChapter,
    chapterHistory,
    actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory : [],
    aiMessages: sanitizeChatMessages(parsed.aiMessages),
    memoryLog: sanitizeStringArray(parsed.memoryLog),
    backgroundEvents,
    setupSnapshot: sanitizeSetupSnapshot(parsed.setupSnapshot, fallbackSetup),
    worldState,
    campaignArchive: sanitizeStringArray(parsed.campaignArchive)
  };
  recordDiagnosticEvent({
    level: 'info',
    category: 'interactive-session',
    stage: 'load',
    message: 'Session interactive restaurée.',
    sessionId: id,
    runtimeMode: runtimeMode || undefined,
    validation: 'passed',
    meta: {
      version: parsedVersion,
      turnNumber: payload.turnNumber,
      chapterHistory: payload.chapterHistory.length,
      hasWorldState: Boolean(payload.worldState)
    }
  });
  return payload;
}

export async function saveInteractiveSessionPayload(
  storyId: string | null,
  payload: InteractiveSessionPayload,
  store: SessionStore = dexieSessionStore
): Promise<void> {
  if (!storyId) return;
  const normalizedPayload: InteractiveSessionPayload = {
    ...payload,
    version: INTERACTIVE_SESSION_VERSION,
    storyRuntimeMode: payload.storyRuntimeMode ? normalizeStoryGenerationMode(payload.storyRuntimeMode) : null,
    chapterHistory: sanitizeStoryChapterArray(payload.chapterHistory),
    currentChapter: payload.currentChapter ? sanitizeStoryChapterValue(payload.currentChapter) : null
  };

  try {
    await store.put(storyId, normalizedPayload);
    recordDiagnosticEvent({
      level: 'info',
      category: 'interactive-session',
      stage: 'save',
      message: 'Session interactive sauvegardée.',
      sessionId: storyId,
      runtimeMode: normalizedPayload.storyRuntimeMode || undefined,
      validation: 'passed',
      meta: {
        turnNumber: normalizedPayload.turnNumber,
        chapterHistory: normalizedPayload.chapterHistory.length,
        hasWorldState: Boolean(normalizedPayload.worldState)
      }
    });
  } catch (error) {
    recordDiagnosticEvent({
      level: 'error',
      category: 'interactive-session',
      stage: 'save',
      message: 'Sauvegarde de session échouée.',
      sessionId: storyId,
      validation: 'failed',
      meta: error
    });
  }
}

export async function loadInteractiveSessionPayload(
  id: string,
  fallbackSetup: StorySetup,
  store: SessionStore = dexieSessionStore
): Promise<InteractiveSessionPayload | null> {
  // 1. Primary backend: IndexedDB.
  try {
    const dbRecord = await store.get(id);
    if (dbRecord && typeof dbRecord === 'object') {
      const sanitized = sanitizeSessionObject(dbRecord as Partial<InteractiveSessionPayload>, id, fallbackSetup);
      if (sanitized) return sanitized;
    }
  } catch (error) {
    recordDiagnosticEvent({
      level: 'warn',
      category: 'interactive-session',
      stage: 'load',
      message: 'Lecture IndexedDB de session échouée, tentative de migration localStorage.',
      sessionId: id,
      validation: 'repaired',
      meta: error
    });
  }

  // 2. Legacy fallback + migration: localStorage.
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(storySessionKey(id));
  if (!raw) return null;

  let parsed: Partial<InteractiveSessionPayload>;
  try {
    parsed = JSON.parse(raw) as Partial<InteractiveSessionPayload>;
  } catch {
    recordDiagnosticEvent({
      level: 'error',
      category: 'interactive-session',
      stage: 'load',
      message: 'Session interactive illisible.',
      sessionId: id,
      validation: 'failed'
    });
    return null;
  }

  const sanitized = sanitizeSessionObject(parsed, id, fallbackSetup);
  if (!sanitized) return null;

  // Migrate to IndexedDB then drop the legacy key (best-effort).
  try {
    await store.put(id, sanitized);
    localStorage.removeItem(storySessionKey(id));
    recordDiagnosticEvent({
      level: 'info',
      category: 'interactive-session',
      stage: 'migrate',
      message: 'Session migrée de localStorage vers IndexedDB.',
      sessionId: id,
      runtimeMode: sanitized.storyRuntimeMode || undefined,
      validation: 'passed'
    });
  } catch (error) {
    recordDiagnosticEvent({
      level: 'warn',
      category: 'interactive-session',
      stage: 'migrate',
      message: 'Migration de session vers IndexedDB échouée (non bloquant).',
      sessionId: id,
      validation: 'repaired',
      meta: error
    });
  }

  return sanitized;
}

export async function clearInteractiveSessionPayload(
  id: string,
  store: SessionStore = dexieSessionStore
): Promise<void> {
  try {
    await store.delete(id);
  } catch (error) {
    recordDiagnosticEvent({
      level: 'warn',
      category: 'interactive-session',
      stage: 'save',
      message: 'Suppression de session échouée.',
      sessionId: id,
      validation: 'repaired',
      meta: error
    });
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(storySessionKey(id));
  }
}
