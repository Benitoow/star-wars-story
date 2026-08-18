/* Mode Direct (playChat.ts) — the chat state machine: streamed replies, the
   debrief the player validates, and the error paths that must keep a partial
   reply on screen. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { MemoryFact, StoryChapter, StoryTurnResult, WorldState } from '$lib/engine/types';

const engine = vi.hoisted(() => ({
  generateOpening: vi.fn(),
  generateTurn: vi.fn(),
  npcReply: vi.fn(),
  resolveConversation: vi.fn(),
  rebuildWorldState: vi.fn(),
  cloneWorldState: vi.fn((state: WorldState) => state),
  hasRequiredItems: vi.fn(() => true),
  applyChoiceInventoryCost: vi.fn((state: WorldState) => state),
  buildMemoryQuery: vi.fn((parts: Array<string | undefined>) => parts.filter(Boolean).join(' ')),
  retrieveMemory: vi.fn(async (facts: MemoryFact[]) => facts),
  runConsolidation: vi.fn(async (facts: MemoryFact[]) => facts),
  retrieveCodex: vi.fn(() => []),
  generateCampaignDossier: vi.fn(async () => ''),
  CODEX_DOSSIER_TOP: 5,
  resolveContextBudget: vi.fn(),
  rollForChoice: vi.fn()
}));
// Generation entry points are mocked; the pure memory/prompt helpers stay real.
vi.mock('$lib/engine', async () => {
  const memory = await vi.importActual<typeof import('$lib/engine/memory')>('$lib/engine/memory');
  const system = await vi.importActual<typeof import('$lib/engine/prompts/system')>('$lib/engine/prompts/system');
  return { ...memory, summarizeChapterForPrompt: system.summarizeChapterForPrompt, ...engine };
});

const persistence = vi.hoisted(() => ({
  SESSION_VERSION: 1,
  getPreferences: vi.fn(),
  getStory: vi.fn(),
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  touchStory: vi.fn(),
  embeddingCache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined) }
}));
vi.mock('$lib/persistence', () => persistence);

vi.mock('$lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  recordDiag: vi.fn()
}));
vi.mock('$lib/content/languages', () => ({ resolveUiLanguage: () => 'fr' }));

import { play } from './play';
import { setup, world, chap, turnResult } from './playTestFixtures';

async function openReadySession(): Promise<void> {
  persistence.getStory.mockResolvedValue({ id: 's1', title: 'T', setup, createdAt: 0, updatedAt: 0, turnCount: 1 });
  persistence.loadSession.mockResolvedValue({
    storyId: 's1', version: 1, turnNumber: 1, worldState: world(),
    currentChapter: chap(1), chapterHistory: [chap(1)], actionHistory: [], memoryFacts: [], trameId: null
  });
  await play.open('s1');
  expect(get(play).status).toBe('ready');
}

beforeEach(() => {
  play.reset();
  vi.clearAllMocks();
  persistence.getPreferences.mockResolvedValue({
    textProvider: 'openrouter', textModel: 'm', textApiKey: 'k', reasoningEffort: 'auto',
    runtimeMode: 'structured-json', uiLanguage: 'fr'
  });
  persistence.saveSession.mockResolvedValue(undefined);
  persistence.touchStory.mockResolvedValue(undefined);
  engine.resolveContextBudget.mockResolvedValue(100_000);
});

describe('chat — sendChatMessage', () => {
  it('streams a reply and commits it as an npc turn (persisted with the chat)', async () => {
    await openReadySession();
    play.enterChat('Vela');
    engine.npcReply.mockImplementation(async (_i: unknown, _c: unknown, onToken: (d: string) => void) => {
      onToken('Que ');
      onToken('veux-tu ?');
      return 'Que veux-tu ?';
    });

    await play.sendChatMessage('Salut Vela');
    const s = get(play);
    expect(s.chat.turns).toEqual([
      { speaker: 'player', content: 'Salut Vela' },
      { speaker: 'npc', content: 'Que veux-tu ?' }
    ]);
    expect(s.chat.partial).toBe('');
    expect(s.chat.busy).toBe(false);
    expect(s.chat.error).toBeNull();
    const lastSave = persistence.saveSession.mock.calls.at(-1)?.[0];
    expect(lastSave.chat).toMatchObject({ npcName: 'Vela' });
  });

  it('commits the partial as a turn when the stream dies midway', async () => {
    await openReadySession();
    play.enterChat('Vela');
    engine.npcReply.mockImplementation(async (_i: unknown, _c: unknown, onToken: (d: string) => void) => {
      onToken('Je te vois');
      throw new Error('réseau coupé');
    });

    await play.sendChatMessage('Salut');
    const s = get(play);
    expect(s.chat.turns.at(-1)).toEqual({ speaker: 'npc', content: 'Je te vois' });
    expect(s.chat.partial).toBe('');
    expect(s.chat.busy).toBe(false);
    expect(s.chat.error).toContain('réseau');
  });
});

describe('chat — endChat (debrief)', () => {
  it('prepares a conversation summary before applying any world consequence', async () => {
    await openReadySession();
    play.enterChat('Vela');
    engine.npcReply.mockImplementation(async (_i: unknown, _c: unknown, onToken: (d: string) => void) => {
      onToken('Réponse.');
      return 'Réponse.';
    });
    await play.sendChatMessage('Salut');
    engine.resolveConversation.mockResolvedValue(turnResult(2));

    await play.endChat();
    const s = get(play);
    expect(s.chat.active).toBe(true);
    expect(s.chat.review?.npcName).toBe('Vela');
    expect(s.chat.review?.result.chapter.chapter_number).toBe(2);
    expect(s.currentChapter?.chapter_number).toBe(1);
    expect(s.turnNumber).toBe(1);
    expect(s.actionHistory.at(-1)).not.toBe('[Conversation avec Vela]');

    play.confirmChatReview();
    const confirmed = get(play);
    expect(confirmed.chat.active).toBe(false);
    expect(confirmed.currentChapter?.chapter_number).toBe(2);
    expect(confirmed.turnNumber).toBe(2);
    expect(confirmed.actionHistory.at(-1)).toBe('[Conversation avec Vela]');
    // The saved session must have dropped the closed conversation.
    const lastSave = persistence.saveSession.mock.calls.at(-1)?.[0];
    expect(lastSave.chat).toBeUndefined();
  });

  it('closes silently without a debrief when nothing was said', async () => {
    await openReadySession();
    play.enterChat('Vela');
    await play.endChat();
    expect(engine.resolveConversation).not.toHaveBeenCalled();
    expect(get(play).chat.active).toBe(false);
  });

  it('keeps the chat open with the error when the debrief fails', async () => {
    await openReadySession();
    play.enterChat('Vela');
    engine.npcReply.mockImplementation(async (_i: unknown, _c: unknown, onToken: (d: string) => void) => {
      onToken('Réponse.');
      return 'Réponse.';
    });
    await play.sendChatMessage('Salut');
    engine.resolveConversation.mockRejectedValue(new Error('boom debrief'));

    await play.endChat();
    const s = get(play);
    expect(s.chat.active).toBe(true);
    expect(s.chat.busy).toBe(false);
    expect(s.chat.error).toContain('boom debrief');
    expect(s.turnNumber).toBe(1); // nothing applied
  });

  it('a user-cancelled debrief returns to the conversation without an error banner', async () => {
    await openReadySession();
    play.enterChat('Vela');
    engine.npcReply.mockImplementation(async (_i: unknown, _c: unknown, onToken: (d: string) => void) => {
      onToken('Réponse.');
      return 'Réponse.';
    });
    await play.sendChatMessage('Salut');
    engine.resolveConversation.mockImplementation(
      (_i: unknown, _c: unknown, signal?: AbortSignal) =>
        new Promise((_res, reject) => {
          if (signal?.aborted) return reject(new Error('annulé'));
          signal?.addEventListener('abort', () => reject(new Error('annulé')));
        })
    );

    const ending = play.endChat();
    expect(get(play).chat.busy).toBe(true);
    play.cancelChatReply();
    await ending;

    const s = get(play);
    expect(s.chat.active).toBe(true);
    expect(s.chat.busy).toBe(false);
    expect(s.chat.error).toBeNull();
  });
});
