/* ═══════════════════════════════════════════════
   Local-first persistence — Dexie / IndexedDB.
   Lean schema: stories, play sessions, preferences.
══════════════════════════════════════════════ */
import Dexie, { type Table } from 'dexie';
import type { UiLanguageCode } from '$lib/content/languages';
import { DEFAULT_TEXT_MODEL_ID, DEFAULT_TEXT_PROVIDER_ID } from '$lib/content/providers';
import type { ChatSession, StoryChapter, StoryGenerationMode, StorySetup, WorldState } from '$lib/engine/types';

export interface StoredStory {
  id: string;
  title: string;
  setup: StorySetup;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
  turnCount: number;
  deletedAt?: number; // soft delete (undo-able)
}

export const SESSION_VERSION = 1;

export interface StoredSession {
  storyId: string;
  version: number;
  turnNumber: number;
  worldState: WorldState;
  currentChapter: StoryChapter | null;
  chapterHistory: StoryChapter[];
  actionHistory: string[];
  memoryFacts: string[];
  trameId?: string | null;
  chat?: ChatSession; // an in-progress live conversation, if any
}

export interface Preferences {
  id: 'preferences';
  // AI
  textProvider: string;
  textModel: string;
  textApiKey: string;
  reasoningEffort: string;
  runtimeMode: StoryGenerationMode;
  // appearance
  uiLanguage: UiLanguageCode;
  theme: 'dark' | 'light';
  // narrative defaults applied to new stories
  writingStyle: string;
  writingTone: string;
  writingPov: string;
  writingLength: string;
  contentMode: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  id: 'preferences',
  textProvider: DEFAULT_TEXT_PROVIDER_ID,
  textModel: DEFAULT_TEXT_MODEL_ID,
  textApiKey: '',
  reasoningEffort: 'auto',
  runtimeMode: 'agentic-subagents', // richer multi-agent pipeline by default
  uiLanguage: 'auto',
  theme: 'dark',
  writingStyle: 'cinematique',
  writingTone: 'aventure',
  writingPov: 'troisieme',
  writingLength: 'moyen',
  contentMode: 'cinematic'
};

class StarWarsStoryDB extends Dexie {
  stories!: Table<StoredStory, string>;
  sessions!: Table<StoredSession, string>;
  preferences!: Table<Preferences, string>;

  constructor() {
    super('StarWarsStory');
    this.version(1).stores({
      stories: 'id, updatedAt, deletedAt',
      sessions: 'storyId',
      preferences: 'id'
    });
  }
}

export const db = new StarWarsStoryDB();

/** Ensure the singleton preferences row exists. Call once on app boot (browser only). */
export async function initDB(): Promise<void> {
  const prefs = await db.preferences.get('preferences');
  if (!prefs) await db.preferences.put({ ...DEFAULT_PREFERENCES });
}
