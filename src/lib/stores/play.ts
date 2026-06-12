/* ═══════════════════════════════════════════════
   Active play session — the runtime brain. Loads/saves
   a session, calls the engine, applies the hidden roll,
   and persists after every turn.
══════════════════════════════════════════════ */
import { writable } from 'svelte/store';
import {
  generateOpening,
  generateTurn,
  npcReply,
  resolveConversation,
  rebuildWorldState,
  resolveContextBudget,
  rollForChoice,
  type ChatTurn,
  type NpcRelation,
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
import { logger, recordDiag } from '$lib/logger';
import { toasts } from './ui';

export type PlayStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'error';

/** "Mode Direct" — live chat sub-state nested in a play session. */
export interface ChatState {
  active: boolean;
  npcName: string;
  sceneSummary: string;
  turns: ChatTurn[];
  partial: string;   // NPC reply currently streaming in
  busy: boolean;     // a reply is streaming or the exit debrief is running
  error: string | null;
}

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
  chat: ChatState;
}

const initialChat: ChatState = { active: false, npcName: '', sceneSummary: '', turns: [], partial: '', busy: false, error: null };

const initial: PlayState = {
  storyId: null, setup: null, status: 'idle', worldState: null, currentChapter: null,
  chapterHistory: [], memoryFacts: [], actionHistory: [], turnNumber: 0, error: null,
  chat: { ...initialChat }
};

const { subscribe, set, update } = writable<PlayState>({ ...initial });
let snap: PlayState = { ...initial };
subscribe((s) => (snap = s));

let chatAbort: AbortController | null = null;

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
    memoryFacts: snap.memoryFacts, trameId: null,
    // Persist an in-progress conversation so it can be resumed; cleared on exit.
    chat: snap.chat.active ? { npcName: snap.chat.npcName, sceneSummary: snap.chat.sceneSummary, turns: snap.chat.turns } : undefined
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
  logger.error('génération échouée', error);
  update((s) => ({ ...s, status: 'error', error: message }));
  toasts.show(message, 'error', 6000);
}

async function startOpening(): Promise<void> {
  const setup = snap.setup;
  if (!setup) return;
  update((s) => ({ ...s, status: 'generating', error: null }));
  try {
    const { config, mode, language } = await loadProvider();
    const result = await generateOpening({ ...setup, language }, config, { mode });
    recordDiag(`ouverture générée (${result.mode}, ${config.model})`, { rawResponse: result.rawResponse });
    applyResult(result, '');
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
    recordDiag(`tour ${result.chapter.chapter_number} (${result.mode}, ${config.model})`, { action, rawResponse: result.rawResponse });
    applyResult(result, action);
  } catch (error) {
    fail(error);
  }
}

// ── Mode Direct (live chat) ───────────────────────────
function currentNpc(): NpcRelation {
  const found = snap.worldState?.npcs.find((n) => n.name === snap.chat.npcName);
  return found ?? { name: snap.chat.npcName || 'Inconnu', affinity: 0, status: 'neutral', alive: true };
}

function chatEnter(npcName: string): void {
  const chapter = snap.currentChapter;
  if (!snap.worldState || !npcName.trim() || snap.chat.active) return;
  const sceneSummary = chapter ? `${chapter.chapter_title}. ${chapter.narrative.action}`.slice(0, 600) : '';
  update((s) => ({ ...s, chat: { active: true, npcName: npcName.trim(), sceneSummary, turns: [], partial: '', busy: false, error: null } }));
  void persist();
}

async function chatSend(text: string): Promise<void> {
  const setup = snap.setup;
  const world = snap.worldState;
  const content = text.trim();
  if (!setup || !world || !content || !snap.chat.active || snap.chat.busy) return;

  const turns: ChatTurn[] = [...snap.chat.turns, { speaker: 'player', content }];
  update((s) => ({ ...s, chat: { ...s.chat, turns, partial: '', busy: true, error: null } }));
  chatAbort = new AbortController();
  try {
    const { config, language } = await loadProvider();
    const reply = await npcReply(
      { setup: { ...setup, language }, worldState: world, npc: currentNpc(), sceneSummary: snap.chat.sceneSummary, turns, playerDirectives: snap.actionHistory.slice(-6) },
      config,
      (delta) => update((s) => ({ ...s, chat: { ...s.chat, partial: s.chat.partial + delta } })),
      chatAbort.signal
    );
    update((s) => {
      const content = (reply || s.chat.partial).trim();
      // An empty reply (model returned nothing, or instant cancel) must not push a blank bubble.
      if (!content) return { ...s, chat: { ...s.chat, partial: '', busy: false, error: 'Réponse vide du modèle.' } };
      return { ...s, chat: { ...s.chat, turns: [...s.chat.turns, { speaker: 'npc', content }], partial: '', busy: false, error: null } };
    });
    void persist();
  } catch (error) {
    // A reply that died mid-stream is still a reply the player read — keep it.
    update((s) => {
      const partial = s.chat.partial.trim();
      const turns = partial ? [...s.chat.turns, { speaker: 'npc' as const, content: partial }] : s.chat.turns;
      return { ...s, chat: { ...s.chat, turns, partial: '', busy: false, error: error instanceof Error ? error.message : String(error) } };
    });
    void persist();
  }
}

async function chatEnd(): Promise<void> {
  const setup = snap.setup;
  const world = snap.worldState;
  if (!setup || !world || !snap.chat.active) return;
  if (!snap.chat.turns.length) {
    update((s) => ({ ...s, chat: { ...initialChat } })); // nothing said → just close
    void persist();
    return;
  }
  const npc = currentNpc();
  const turns = snap.chat.turns;
  const sceneSummary = snap.chat.sceneSummary;
  update((s) => ({ ...s, chat: { ...s.chat, busy: true, error: null } }));
  chatAbort = new AbortController();
  const signal = chatAbort.signal;
  try {
    const { config, language } = await loadProvider();
    const result = await resolveConversation(
      { setup: { ...setup, language }, worldState: world, npc, sceneSummary, turns, turnNumber: snap.turnNumber + 1 },
      config,
      signal
    );
    recordDiag(`conversation avec ${npc.name} résolue`, { messages: turns.length, rawResponse: result.rawResponse });
    update((s) => ({ ...s, chat: { ...initialChat } })); // close before applyResult so the saved session drops the chat
    applyResult(result, `[Conversation avec ${npc.name}]`);
  } catch (error) {
    // User-cancelled debrief → simply stay in the conversation, no error banner.
    const aborted = signal.aborted;
    update((s) => ({ ...s, chat: { ...s.chat, busy: false, error: aborted ? null : error instanceof Error ? error.message : String(error) } }));
  }
}

export const play = {
  subscribe,
  reset(): void {
    chatAbort?.abort();
    set({ ...initial });
  },
  /** Load a story + its session; auto-generates the opening for a fresh story. */
  async open(storyId: string): Promise<void> {
    // `$page` updates re-fire the caller's reactive statement: never reset an
    // already-open story (especially mid-generation). 'error' may re-open.
    if (snap.storyId === storyId && snap.status !== 'error') return;
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
        actionHistory: session.actionHistory, turnNumber: session.turnNumber, error: null,
        chat: session.chat
          ? { active: true, npcName: session.chat.npcName, sceneSummary: session.chat.sceneSummary, turns: session.chat.turns, partial: '', busy: false, error: null }
          : { ...initialChat }
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
    const roll = rollForChoice(choice);
    recordDiag(`jet caché : ${roll.outcome} (d20=${roll.roll} vs DC ${roll.dc}, difficulté ${choice.difficulty})`, { choix: choice.text });
    return submit(choice.text, roll.directive);
  },
  freeAction(text: string): Promise<void> {
    return submit(text, '');
  },
  // Mode Direct
  enterChat(npcName: string): void {
    chatEnter(npcName);
  },
  sendChatMessage(text: string): Promise<void> {
    return chatSend(text);
  },
  endChat(): Promise<void> {
    return chatEnd();
  },
  cancelChatReply(): void {
    chatAbort?.abort();
  }
};
