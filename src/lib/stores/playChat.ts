/* ═══════════════
   "Mode Direct" — the live NPC conversation nested inside a play session:
   streamed replies, a debrief the player validates before anything is
   written to the world, and the abort handle shared with the play store.
═══════════════ */
import {
  npcReply,
  resolveConversation,
  buildMemoryQuery,
  retrieveMemory,
  type ChatTurn,
  type MemoryFact,
  type NpcRelation,
  type StoryProviderConfig,
} from '$lib/engine';
import { embeddingCache } from '$lib/persistence';
import { recordDiag } from '$lib/logger';
import {
  applyResult,
  initialChat,
  loadProvider,
  persist,
  recentEvents,
  snap,
  update,
} from './playSession';

let chatAbort: AbortController | null = null;

/** Cancel an in-flight reply or debrief (also used when the store resets). */
export function abortChat(): void {
  chatAbort?.abort();
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

export function chatEnter(npcName: string): void {
  const chapter = snap.currentChapter;
  if (!snap.worldState || snap.worldState.ending || !npcName.trim() || snap.chat.active) return;
  const sceneSummary = chapter ? `${chapter.chapter_title}. ${chapter.narrative.action}`.slice(0, 600) : '';
  update((s) => ({ ...s, chat: { active: true, npcName: npcName.trim(), sceneSummary, turns: [], partial: '', busy: false, error: null, review: null } }));
  void persist();
}

export async function chatSend(text: string): Promise<void> {
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

export async function chatEnd(): Promise<void> {
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

export function confirmChatReview(): void {
  const review = snap.chat.review;
  if (!review) return;
  update((s) => ({ ...s, chat: { ...initialChat } }));
  applyResult(review.result, `[Conversation avec ${review.npcName}]`);
}

export function discardChatReview(): void {
  if (!snap.chat.review) return;
  update((s) => ({ ...s, chat: { ...initialChat } }));
  void persist();
}
