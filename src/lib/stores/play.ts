/* ═══════════════════════════════════════════════
   Active play session — the runtime brain. Loads/saves
   a session, calls the engine, applies the hidden roll,
   and persists after every turn.
══════════════════════════════════════════════ */
import { TRAMES } from '$lib/content/catalog';
import {
  fromLegacyFacts,
  generateOpening,
  generateTurn,
  rebuildWorldState,
  cloneWorldState,
  rollForChoice,
  hasRequiredItems,
  buildMemoryQuery,
  runConsolidation,
  retrieveCodex,
  generateCampaignDossier,
  CODEX_DOSSIER_TOP,
  type StoryChoice,
  type StoryProviderConfig,
} from '$lib/engine';
import { recordDiag } from '$lib/logger';
import { getStory, loadSession } from '$lib/persistence';
import { toasts } from './ui';
import {
  initial,
  initialChat,
  applyResult,
  fail,
  loadProvider,
  onPartial,
  persist,
  set,
  snap,
  subscribe,
  update,
} from './playSession';
import { abortChat, chatEnd, chatEnter, chatSend, confirmChatReview, discardChatReview } from './playChat';
export type { PlayStatus, PlayState, ChatState, ChatReview, PendingAction } from './playSession';

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

    const trameLabel = TRAMES.find((t) => t.id === setup.trameId)?.name ?? null;
    const result = await generateOpening({ ...setup, language }, config, { mode, onPartial, trameLabel });
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

export const play = {
  subscribe,
  reset(): void {
    abortChat();
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
    abortChat();
  }
};
