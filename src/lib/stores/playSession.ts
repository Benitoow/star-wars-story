/* ═══════════════
   Shared foundation of the play session: the state shape, the writable
   store and the primitives every action needs (provider config, persistence,
   applying a generated turn, error handling). Imported by both the turn
   actions (play.ts) and the Mode Direct actions (playChat.ts).
═══════════════ */
import { writable } from 'svelte/store';
import {
  memoryFactLines,
  mergeMemoryFacts,
  resolveContextBudget,
  applyChoiceInventoryCost,
  summarizeChapterForPrompt,
  type ChatTurn,
  type GeneratePartial,
  type MemoryFact,
  type StoryChapter,
  type StoryChoice,
  type StoryGenerationMode,
  type StoryProviderConfig,
  type StorySetup,
  type StoryTurnResult,
  type WorldState,
} from '$lib/engine';
import { SESSION_VERSION, getPreferences, saveSession, touchStory } from '$lib/persistence';
import { resolveUiLanguage } from '$lib/content/languages';
import { toasts } from './ui';
import { logger } from '$lib/logger';

export type PlayStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'error';

/** "Mode Direct" — live chat sub-state nested in a play session. */
export interface ChatReview {
  npcName: string;
  turns: ChatTurn[];
  result: StoryTurnResult;
}

export interface ChatState {
  active: boolean;
  npcName: string;
  sceneSummary: string;
  turns: ChatTurn[];
  partial: string;   // NPC reply currently streaming in
  busy: boolean;     // a reply is streaming or the exit debrief is running
  error: string | null;
  review: ChatReview | null;
}

export interface PendingAction {
  text: string;
  outcomeDirective: string;
  choice?: StoryChoice;
}

export interface PlayState {
  storyId: string | null;
  setup: StorySetup | null;
  status: PlayStatus;
  worldState: WorldState | null;
  currentChapter: StoryChapter | null;
  chapterHistory: StoryChapter[];
  memory: MemoryFact[];
  actionHistory: string[];
  turnNumber: number;
  error: string | null;
  pendingAction: PendingAction | null;
  partialChapter: GeneratePartial | null; // the scene streaming in while status === 'generating'
  chat: ChatState;
}

export const initialChat: ChatState = { active: false, npcName: '', sceneSummary: '', turns: [], partial: '', busy: false, error: null, review: null };

export const initial: PlayState = {
  storyId: null, setup: null, status: 'idle', worldState: null, currentChapter: null,
  chapterHistory: [], memory: [], actionHistory: [], turnNumber: 0, error: null,
  pendingAction: null,
  partialChapter: null,
  chat: { ...initialChat }
};

export const { subscribe, set, update } = writable<PlayState>({ ...initial });
export let snap: PlayState = { ...initial };
subscribe((s) => (snap = s));

let chatAbort: AbortController | null = null;

export async function loadProvider(): Promise<{ config: StoryProviderConfig; mode: StoryGenerationMode; language: string; contextBudget: number; memoryEmbeddings: boolean }> {
  const p = await getPreferences();
  const config: StoryProviderConfig = { providerId: p.textProvider, model: p.textModel, apiKey: p.textApiKey, reasoningEffort: p.reasoningEffort };
  return {
    config,
    mode: p.runtimeMode,
    language: resolveUiLanguage(p.uiLanguage),
    contextBudget: await resolveContextBudget(config), // auto-detected from the model's window
    memoryEmbeddings: p.memoryEmbeddings === true
  };
}

/** Condensed recaps of the last few chapters — shared context for NPC chats. */
export function recentEvents(): string[] {
  return snap.chapterHistory.slice(-3).map(summarizeChapterForPrompt);
}

export async function persist(): Promise<void> {
  if (!snap.storyId || !snap.worldState) return;
  await saveSession({
    storyId: snap.storyId, version: SESSION_VERSION, turnNumber: snap.turnNumber,
    worldState: snap.worldState, currentChapter: snap.currentChapter,
    chapterHistory: snap.chapterHistory, actionHistory: snap.actionHistory,
    // memoryFacts stays in sync as a flat rendition so v1 readers keep working.
    memory: snap.memory, memoryFacts: memoryFactLines(snap.memory, 58), trameId: null,
    // Persist an in-progress conversation so it can be resumed; cleared on exit.
    chat: snap.chat.active ? { npcName: snap.chat.npcName, sceneSummary: snap.chat.sceneSummary, turns: snap.chat.turns } : undefined
  });
  await touchStory(snap.storyId, snap.turnNumber);
}

export function applyResult(result: StoryTurnResult, actionText: string, choice?: StoryChoice, baseline?: WorldState): void {
  const chapter = result.chapter;
  const worldState = choice ? applyChoiceInventoryCost(result.worldState, choice, baseline) : result.worldState;
  update((s) => ({
    ...s,
    status: 'ready',
    worldState,
    currentChapter: chapter,
    chapterHistory: [...s.chapterHistory, chapter],
    memory: mergeMemoryFacts(s.memory, chapter),
    actionHistory: actionText ? [...s.actionHistory, actionText] : s.actionHistory,
    turnNumber: chapter.chapter_number,
    error: null,
    pendingAction: null,
    partialChapter: null
  }));
  void persist();
}

export function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('génération échouée', error);
  update((s) => ({ ...s, status: 'error', error: message, partialChapter: null }));
  toasts.show(message, 'error', 6000);
}

export function onPartial(partial: GeneratePartial): void {
  update((s) => ({ ...s, partialChapter: partial }));
}
