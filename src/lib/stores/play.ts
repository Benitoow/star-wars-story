/* ═══════════════════════════════════════════════
   Active play session — the runtime brain. Loads/saves
   a session, calls the engine, applies the hidden roll,
   and persists after every turn.
══════════════════════════════════════════════ */
import { writable } from 'svelte/store';
import {
  fromLegacyFacts,
  generateOpening,
  generateTurn,
  memoryFactLines,
  mergeMemoryFacts,
  npcReply,
  resolveConversation,
  rebuildWorldState,
  cloneWorldState,
  resolveContextBudget,
  rollForChoice,
  hasRequiredItems,
  applyChoiceInventoryCost,
  summarizeChapterForPrompt,
  buildMemoryQuery,
  retrieveMemory,
  runConsolidation,
  retrieveCodex,
  generateCampaignDossier,
  CODEX_DOSSIER_TOP,
  type ChatTurn,
  type GeneratePartial,
  type MemoryFact,
  type NpcRelation,
  type StoryChapter,
  type StoryChoice,
  type StoryGenerationMode,
  type StoryProviderConfig,
  type StorySetup,
  type StoryTurnResult,
  type WorldState
} from '$lib/engine';
import { SESSION_VERSION, getPreferences, getStory, loadSession, saveSession, touchStory, embeddingCache } from '$lib/persistence';
import { resolveUiLanguage } from '$lib/content/languages';
import { logger, recordDiag } from '$lib/logger';
import { toasts } from './ui';

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

const initialChat: ChatState = { active: false, npcName: '', sceneSummary: '', turns: [], partial: '', busy: false, error: null, review: null };

const initial: PlayState = {
  storyId: null, setup: null, status: 'idle', worldState: null, currentChapter: null,
  chapterHistory: [], memory: [], actionHistory: [], turnNumber: 0, error: null,
  pendingAction: null,
  partialChapter: null,
  chat: { ...initialChat }
};

const { subscribe, set, update } = writable<PlayState>({ ...initial });
let snap: PlayState = { ...initial };
subscribe((s) => (snap = s));

let chatAbort: AbortController | null = null;

async function loadProvider(): Promise<{ config: StoryProviderConfig; mode: StoryGenerationMode; language: string; contextBudget: number; memoryEmbeddings: boolean }> {
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
function recentEvents(): string[] {
  return snap.chapterHistory.slice(-3).map(summarizeChapterForPrompt);
}

async function persist(): Promise<void> {
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

function applyResult(result: StoryTurnResult, actionText: string, choice?: StoryChoice, baseline?: WorldState): void {
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

function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('génération échouée', error);
  update((s) => ({ ...s, status: 'error', error: message, partialChapter: null }));
  toasts.show(message, 'error', 6000);
}

function onPartial(partial: GeneratePartial): void {
  update((s) => ({ ...s, partialChapter: partial }));
}

/** Fold the parallel-generated dossier into the live campaign, once. Guarded:
 * a dossier that resolves after the player switched story, or after one was
 * already recorded, is dropped rather than applied to the wrong campaign. */
function adoptDossier(storyId: string | null, dossier: string): void {
  if (!dossier || !storyId || snap.storyId !== storyId) return;
  if (!snap.worldState || snap.worldState.campaign.dossier) return;
  update((s) => (s.worldState
    ? { ...s, worldState: { ...s.worldState, campaign: { ...s.worldState.campaign, dossier } } }
    : s));
  recordDiag('dossier de campagne rattaché');
  void persist();
}

async function startOpening(): Promise<void> {
  const setup = snap.setup;
  if (!setup) return;
  update((s) => ({ ...s, status: 'generating', error: null, pendingAction: null, partialChapter: null }));
  try {
    const { config, mode, language } = await loadProvider();
    const storyId = snap.storyId;
    // The dossier is factual context for the campaign, not a prerequisite of the
    // opening. Generating it first meant TWO sequential model calls before the
    // player saw a single word (and its retries stacked on top). It now runs
    // ALONGSIDE the opening and is folded in once the scene is on screen, so it
    // costs no perceived latency — the trade-off is that it informs turn 2
    // onwards rather than the opening scene itself.
    const dossierPromise = (async () => {
      try {
        const codex = retrieveCodex(setup.era, buildMemoryQuery([setup.premise, setup.faction]), CODEX_DOSSIER_TOP);
        return await generateCampaignDossier(setup, config, codex);
      } catch {
        return ''; /* no dossier -> the game runs without it */
      }
    })();

    const result = await generateOpening({ ...setup, language }, config, { mode, onPartial });
    recordDiag(`ouverture générée (${result.mode}, ${config.model})`, { rawResponse: result.rawResponse });
    applyResult(result, '');
    // Attached AFTER applyResult so the dossier can never land in a world state
    // that is about to be replaced by the opening.
    void dossierPromise.then((dossier) => adoptDossier(storyId, dossier));
  } catch (error) {
    fail(error);
  }
}

async function submit(actionText: string, outcomeDirective = '', choice?: StoryChoice): Promise<void> {
  const setup = snap.setup;
  const worldState = snap.worldState;
  const action = actionText.trim();
  if (!setup || !worldState || worldState.ending || !action || snap.status === 'generating') return;

  update((s) => ({
    ...s,
    status: 'generating',
    error: null,
    pendingAction: { text: action, outcomeDirective, choice },
    partialChapter: null
  }));
  try {
    const { config, mode, language, contextBudget, memoryEmbeddings } = await loadProvider();
    const result = await generateTurn(
      {
        setup: { ...setup, language },
        worldState,
        turnNumber: snap.turnNumber + 1,
        actionText: action,
        memory: snap.memory,
        memoryEmbeddings,
        campaignDossier: worldState.campaign.dossier,
        chapterHistory: snap.chapterHistory,
        actionHistory: snap.actionHistory,
        contextBudget,
        playerDirectives: snap.actionHistory.slice(-10),
        outcomeDirective
      },
      config,
      { mode, onPartial }
    );
    recordDiag(`tour ${result.chapter.chapter_number} (${result.mode}, ${config.model})`, { action, rawResponse: result.rawResponse });
    applyResult(result, action, choice, worldState);
    void maybeConsolidate(config);
  } catch (error) {
    fail(error);
  }
}

function editPendingAction(): string {
  const action = snap.pendingAction?.text ?? '';
  if (!action) return '';
  update((s) => ({ ...s, status: 'ready', error: null, pendingAction: null, partialChapter: null }));
  return action;
}

const CONSOLIDATION_EVERY_TURNS = 10;

/** Mnemosyne-style episodic compression: every 10 turns the oldest notes are
 * condensed into a synthesis by the model. Fire-and-forget — the memory is
 * only ever replaced when the call succeeds, and a guard drops the pass if
 * the campaign advanced while the model was summarizing (no clobbering of
 * facts added by an intermediate turn). */
function maybeConsolidate(config: StoryProviderConfig): void {
  const { turnNumber, memory, storyId } = snap;
  if (!storyId || !memory?.length || turnNumber <= 0 || turnNumber % CONSOLIDATION_EVERY_TURNS !== 0) return;
  const snapshotTurn = turnNumber;
  const snapshotMemory = memory;
  void runConsolidation(snapshotMemory, snapshotTurn, config).then((next) => {
    if (next === snapshotMemory) return; // nothing changed (or consolidation failed)
    if (snap.turnNumber !== snapshotTurn || snap.memory !== snapshotMemory) return; // race guard
    update((s) => ({ ...s, memory: next }));
    void persist();
  });
}

/** Keep only the facts relevant to the current conversation. */
async function memoryForChat(enableEmbeddings: boolean, config: StoryProviderConfig): Promise<MemoryFact[]> {
  const query = buildMemoryQuery([
    snap.chat.sceneSummary,
    snap.chat.turns.at(-1)?.content,
    snap.chat.npcName,
    snap.worldState?.player.location
  ]);
  return retrieveMemory(snap.memory ?? [], query, {
    provider: config,
    enableEmbeddings,
    currentTurn: snap.turnNumber,
    cache: embeddingCache
  });
}

// ── Mode Direct (live chat) ───────────────────────────
function currentNpc(): NpcRelation {
  const found = snap.worldState?.npcs.find((n) => n.name === snap.chat.npcName);
  return found ?? { name: snap.chat.npcName || 'Inconnu', affinity: 0, status: 'neutral', alive: true };
}

function chatEnter(npcName: string): void {
  const chapter = snap.currentChapter;
  if (!snap.worldState || snap.worldState.ending || !npcName.trim() || snap.chat.active) return;
  const sceneSummary = chapter ? `${chapter.chapter_title}. ${chapter.narrative.action}`.slice(0, 600) : '';
  update((s) => ({ ...s, chat: { active: true, npcName: npcName.trim(), sceneSummary, turns: [], partial: '', busy: false, error: null, review: null } }));
  void persist();
}

async function chatSend(text: string): Promise<void> {
  const setup = snap.setup;
  const world = snap.worldState;
  const content = text.trim();
  if (!setup || !world || world.ending || !content || !snap.chat.active || snap.chat.review || snap.chat.busy) return;

  const turns: ChatTurn[] = [...snap.chat.turns, { speaker: 'player', content }];
  update((s) => ({ ...s, chat: { ...s.chat, turns, partial: '', busy: true, error: null } }));
  chatAbort = new AbortController();
  try {
    const { config, language, memoryEmbeddings } = await loadProvider();
    const memory = await memoryForChat(memoryEmbeddings, config);
    const reply = await npcReply(
      {
        setup: { ...setup, language }, worldState: world, npc: currentNpc(), sceneSummary: snap.chat.sceneSummary, turns,
        playerDirectives: snap.actionHistory.slice(-10), memory, recentEvents: recentEvents()
      },
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
  if (!setup || !world || world.ending || !snap.chat.active || snap.chat.review) return;
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
    const { config, language, memoryEmbeddings } = await loadProvider();
    const memory = await memoryForChat(memoryEmbeddings, config);
    const result = await resolveConversation(
      { setup: { ...setup, language }, worldState: world, npc, sceneSummary, turns, turnNumber: snap.turnNumber + 1, memory },
      config,
      signal
    );
    recordDiag(`conversation avec ${npc.name} préparée pour validation`, { messages: turns.length, rawResponse: result.rawResponse });
    update((s) => ({
      ...s,
      chat: { ...s.chat, busy: false, error: null, review: { npcName: npc.name, turns, result } }
    }));
    void persist();
  } catch (error) {
    // User-cancelled debrief → simply stay in the conversation, no error banner.
    const aborted = signal.aborted;
    update((s) => ({ ...s, chat: { ...s.chat, busy: false, error: aborted ? null : error instanceof Error ? error.message : String(error) } }));
  }
}

function confirmChatReview(): void {
  const review = snap.chat.review;
  if (!review) return;
  update((s) => ({ ...s, chat: { ...initialChat } }));
  applyResult(review.result, `[Conversation avec ${review.npcName}]`);
}

function discardChatReview(): void {
  if (!snap.chat.review) return;
  update((s) => ({ ...s, chat: { ...initialChat } }));
  void persist();
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
        ? cloneWorldState(session.worldState)
        : rebuildWorldState(story.setup, session.chapterHistory);
      set({
        storyId, setup: story.setup, status: 'ready', worldState,
        currentChapter: session.currentChapter ?? session.chapterHistory[session.chapterHistory.length - 1] ?? null,
        chapterHistory: session.chapterHistory,
        memory: session.memory ?? fromLegacyFacts(session.memoryFacts),
        actionHistory: session.actionHistory, turnNumber: session.turnNumber, error: null,
        pendingAction: null,
        partialChapter: null,
        chat: session.chat
          ? { active: true, npcName: session.chat.npcName, sceneSummary: session.chat.sceneSummary, turns: session.chat.turns, partial: '', busy: false, error: null, review: null }
          : { ...initialChat }
      });
    } else {
      set({ ...initial, storyId, setup: story.setup, status: 'idle' });
      await startOpening();
    }
  },
  retry(): Promise<void> {
    if (snap.pendingAction) {
      const pending = snap.pendingAction;
      return submit(pending.text, pending.outcomeDirective, pending.choice);
    }
    return snap.turnNumber === 0 || !snap.currentChapter ? startOpening() : Promise.resolve();
  },
  chooseChoice(choice: StoryChoice): Promise<void> {
    const world = snap.worldState;
    if (!world || world.ending) return Promise.resolve();
    if (!hasRequiredItems(world, choice)) {
      toasts.show(`Objet requis indisponible : ${(choice.requires_items ?? []).join(', ')}`, 'error', 4500);
      return Promise.resolve();
    }
    const skillScore = world.player.skills?.[choice.attribute] ?? 2;
    const roll = rollForChoice(choice, skillScore - 1);
    recordDiag(`jet caché : ${roll.outcome} (d20=${roll.roll} + aptitude ${skillScore - 1} vs DC ${roll.dc}, difficulté ${choice.difficulty})`, { choix: choice.text, attribute: choice.attribute });
    return submit(choice.text, roll.directive, choice);
  },
  freeAction(text: string): Promise<void> {
    return submit(text, '');
  },
  editPendingAction(): string {
    return editPendingAction();
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
  confirmChatReview(): void {
    confirmChatReview();
  },
  discardChatReview(): void {
    discardChatReview();
  },
  cancelChatReply(): void {
    chatAbort?.abort();
  }
};
