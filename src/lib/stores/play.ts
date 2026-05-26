/* ═══════════════════════════════════════════════
   Active play session — the runtime brain. Loads/saves
   a session, calls the engine, applies the hidden roll,
   and persists after every turn.
══════════════════════════════════════════════ */
import { writable } from 'svelte/store';
import {
  generateOpening,
  generateTurn,
  rebuildWorldState,
  resolveContextBudget,
  rollForChoice,
  type StoryChapter,
  type StoryChoice,
  type StoryGenerationMode,
  type StoryProviderConfig,
  type StorySetup,
  type StoryTurnResult,
  type WorldState
} from '$lib/engine';
import { SESSION_VERSION, getPreferences, getStory, loadSession, saveSession, touchStory } from '$lib/persistence';
import { resolveUiLanguage } from '$lib/content/languages';
import { toasts } from './ui';

export type PlayStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'error';

export interface PlayState {
  storyId: string | null;
  setup: StorySetup | null;
  status: PlayStatus;
  worldState: WorldState | null;
  currentChapter: StoryChapter | null;
  chapterHistory: StoryChapter[];
  memoryFacts: string[];
  actionHistory: string[];
  turnNumber: number;
  error: string | null;
}

const initial: PlayState = {
  storyId: null, setup: null, status: 'idle', worldState: null, currentChapter: null,
  chapterHistory: [], memoryFacts: [], actionHistory: [], turnNumber: 0, error: null
};

const { subscribe, set, update } = writable<PlayState>({ ...initial });
let snap: PlayState = { ...initial };
subscribe((s) => (snap = s));

async function loadProvider(): Promise<{ config: StoryProviderConfig; mode: StoryGenerationMode; language: string; contextBudget: number }> {
  const p = await getPreferences();
  const config: StoryProviderConfig = { providerId: p.textProvider, model: p.textModel, apiKey: p.textApiKey, reasoningEffort: p.reasoningEffort };
  return {
    config,
    mode: p.runtimeMode,
    language: resolveUiLanguage(p.uiLanguage),
    contextBudget: await resolveContextBudget(config) // auto-detected from the model's window
  };
}

function mergeMemory(existing: string[], chapter: StoryChapter): string[] {
  const m = chapter.memory_updates;
  const additions = [...m.relations, ...m.places, ...m.injuries, ...m.resources, ...m.notes];
  return Array.from(new Set([...existing, ...additions])).slice(-40);
}

async function persist(): Promise<void> {
  if (!snap.storyId || !snap.worldState) return;
  await saveSession({
    storyId: snap.storyId, version: SESSION_VERSION, turnNumber: snap.turnNumber,
    worldState: snap.worldState, currentChapter: snap.currentChapter,
    chapterHistory: snap.chapterHistory, actionHistory: snap.actionHistory,
    memoryFacts: snap.memoryFacts, trameId: null
  });
  await touchStory(snap.storyId, snap.turnNumber);
}

function applyResult(result: StoryTurnResult, actionText: string): void {
  const chapter = result.chapter;
  update((s) => ({
    ...s,
    status: 'ready',
    worldState: result.worldState,
    currentChapter: chapter,
    chapterHistory: [...s.chapterHistory, chapter],
    memoryFacts: mergeMemory(s.memoryFacts, chapter),
    actionHistory: actionText ? [...s.actionHistory, actionText] : s.actionHistory,
    turnNumber: chapter.chapter_number,
    error: null
  }));
  void persist();
}

function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  update((s) => ({ ...s, status: 'error', error: message }));
  toasts.show(message, 'error', 6000);
}

async function startOpening(): Promise<void> {
  const setup = snap.setup;
  if (!setup) return;
  update((s) => ({ ...s, status: 'generating', error: null }));
  try {
    const { config, mode, language } = await loadProvider();
    applyResult(await generateOpening({ ...setup, language }, config, { mode }), '');
  } catch (error) {
    fail(error);
  }
}

async function submit(actionText: string, outcomeDirective = ''): Promise<void> {
  const setup = snap.setup;
  const worldState = snap.worldState;
  const action = actionText.trim();
  if (!setup || !worldState || !action || snap.status === 'generating') return;

  update((s) => ({ ...s, status: 'generating', error: null }));
  try {
    const { config, mode, language, contextBudget } = await loadProvider();
    const result = await generateTurn(
      {
        setup: { ...setup, language },
        worldState,
        turnNumber: snap.turnNumber + 1,
        actionText: action,
        memoryFacts: snap.memoryFacts,
        chapterHistory: snap.chapterHistory,
        actionHistory: snap.actionHistory,
        contextBudget,
        playerDirectives: snap.actionHistory.slice(-6),
        outcomeDirective
      },
      config,
      { mode }
    );
    applyResult(result, action);
  } catch (error) {
    fail(error);
  }
}

export const play = {
  subscribe,
  reset(): void {
    set({ ...initial });
  },
  /** Load a story + its session; auto-generates the opening for a fresh story. */
  async open(storyId: string): Promise<void> {
    if (snap.storyId === storyId && snap.status === 'ready') return;
    set({ ...initial, storyId, status: 'loading' });
    const story = await getStory(storyId);
    if (!story) {
      update((s) => ({ ...s, status: 'error', error: 'Histoire introuvable.' }));
      return;
    }
    const session = await loadSession(storyId);
    if (session && session.chapterHistory.length) {
      const worldState = session.worldState?.player
        ? session.worldState
        : rebuildWorldState(story.setup, session.chapterHistory);
      set({
        storyId, setup: story.setup, status: 'ready', worldState,
        currentChapter: session.currentChapter ?? session.chapterHistory[session.chapterHistory.length - 1] ?? null,
        chapterHistory: session.chapterHistory, memoryFacts: session.memoryFacts,
        actionHistory: session.actionHistory, turnNumber: session.turnNumber, error: null
      });
    } else {
      set({ ...initial, storyId, setup: story.setup, status: 'idle' });
      await startOpening();
    }
  },
  retry(): Promise<void> {
    return snap.turnNumber === 0 || !snap.currentChapter ? startOpening() : Promise.resolve();
  },
  chooseChoice(choice: StoryChoice): Promise<void> {
    return submit(choice.text, rollForChoice(choice).directive);
  },
  freeAction(text: string): Promise<void> {
    return submit(text, '');
  }
};
