/* Store-level tests — the most stateful code in the app (chat state machine,
   session resume, error paths) exercised against a fully mocked engine. */
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

describe('play.open', () => {
  it('restores a session including a persisted in-progress conversation', async () => {
    persistence.getStory.mockResolvedValue({ id: 's1', title: 'T', setup, createdAt: 0, updatedAt: 0, turnCount: 1 });
    persistence.loadSession.mockResolvedValue({
      storyId: 's1', version: 1, turnNumber: 1, worldState: world(),
      currentChapter: chap(1), chapterHistory: [chap(1)], actionHistory: [], memoryFacts: [], trameId: null,
      chat: { npcName: 'Vela', sceneSummary: 'cantina', turns: [{ speaker: 'player', content: 'Salut.' }] }
    });

    await play.open('s1');
    const s = get(play);
    expect(s.status).toBe('ready');
    expect(s.chat.active).toBe(true);
    expect(s.chat.npcName).toBe('Vela');
    expect(s.chat.turns).toHaveLength(1);
    expect(s.chat.busy).toBe(false);
  });

  it('never resets an in-flight generation when re-fired with the same story id', async () => {
    persistence.getStory.mockResolvedValue({ id: 's1', title: 'T', setup, createdAt: 0, updatedAt: 0, turnCount: 0 });
    persistence.loadSession.mockResolvedValue(null); // fresh story → opening generation
    let resolveOpening!: (r: StoryTurnResult) => void;
    engine.generateOpening.mockImplementation(() => new Promise((res) => (resolveOpening = res)));

    const first = play.open('s1');
    await vi.waitFor(() => expect(get(play).status).toBe('generating'));

    await play.open('s1'); // reactive re-fire mid-generation — must be a no-op
    expect(get(play).status).toBe('generating');
    expect(engine.generateOpening).toHaveBeenCalledTimes(1);

    resolveOpening(turnResult(1));
    await first;
    expect(get(play).status).toBe('ready');
    expect(get(play).currentChapter?.chapter_number).toBe(1);
  });
});

describe('failed action recovery', () => {
  it('re-enables editing and clears the stale pending action', async () => {
    await openReadySession();
    engine.generateTurn.mockRejectedValue(new Error('provider indisponible'));

    await play.freeAction('Forcer le sas');
    expect(get(play).status).toBe('error');
    expect(get(play).pendingAction?.text).toBe('Forcer le sas');

    expect(play.editPendingAction()).toBe('Forcer le sas');
    expect(get(play).status).toBe('ready');
    expect(get(play).error).toBeNull();
    expect(get(play).pendingAction).toBeNull();
  });
});

describe('campaign dossier (parallel, never on the critical path)', () => {
  it('starts the opening WITHOUT waiting for the dossier, then folds it in', async () => {
    persistence.getStory.mockResolvedValue({ id: 's1', title: 'T', setup, createdAt: 0, updatedAt: 0, turnCount: 0 });
    persistence.loadSession.mockResolvedValue(null); // fresh story -> opening generation
    let resolveDossier!: (d: string) => void;
    engine.generateCampaignDossier.mockImplementation(() => new Promise((res) => (resolveDossier = res)));
    engine.generateOpening.mockResolvedValue(turnResult(1));

    await play.open('s1');

    // The opening ran and finished while the dossier was still in flight.
    expect(engine.generateOpening).toHaveBeenCalledTimes(1);
    expect(get(play).status).toBe('ready');
    expect(get(play).worldState?.campaign.dossier).toBeFalsy();
    // It was NOT passed to the opening — it informs turn 2 onwards.
    expect(engine.generateOpening.mock.calls[0][2]).not.toHaveProperty('campaignDossier');

    resolveDossier('Sous l Empire, la Bordure Exterieure vit sous la loi martiale.');
    await vi.waitFor(() => expect(get(play).worldState?.campaign.dossier).toContain('Bordure'));
  });

  it('drops a dossier that lands after the player left the story', async () => {
    persistence.getStory.mockResolvedValue({ id: 's1', title: 'T', setup, createdAt: 0, updatedAt: 0, turnCount: 0 });
    persistence.loadSession.mockResolvedValue(null);
    let resolveDossier!: (d: string) => void;
    engine.generateCampaignDossier.mockImplementation(() => new Promise((res) => (resolveDossier = res)));
    engine.generateOpening.mockResolvedValue(turnResult(1));

    await play.open('s1');
    play.reset(); // player closed the story

    resolveDossier('dossier tardif');
    await Promise.resolve();
    expect(get(play).worldState).toBeNull();
  });

  it('a failed dossier never breaks the opening', async () => {
    persistence.getStory.mockResolvedValue({ id: 's1', title: 'T', setup, createdAt: 0, updatedAt: 0, turnCount: 0 });
    persistence.loadSession.mockResolvedValue(null);
    engine.generateCampaignDossier.mockRejectedValue(new Error('reseau coupe'));
    engine.generateOpening.mockResolvedValue(turnResult(1));

    await play.open('s1');
    expect(get(play).status).toBe('ready');
    expect(get(play).currentChapter?.chapter_number).toBe(1);
  });
});
