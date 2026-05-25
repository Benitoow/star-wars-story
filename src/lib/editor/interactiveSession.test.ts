import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadInteractiveSessionPayload,
  saveInteractiveSessionPayload,
  type InteractiveSessionPayload,
  type SessionStore
} from './interactiveSession';
import { SESSION_CORRUPTION_FIXTURES } from '../../test/fixtures/sessionCorruptionFixtures';

const fallbackSetup = {
  era: 'imperial',
  faction: 'rebels',
  role: 'smuggler',
  premise: 'Test'
};

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };
}

// In-memory SessionStore so the persistence logic is testable without a real IndexedDB.
function createMemoryStore(): SessionStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(id) {
      return data.get(id);
    },
    async put(id, payload) {
      data.set(id, payload);
    },
    async delete(id) {
      data.delete(id);
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('interactiveSession', () => {
  it('round-trips a session through the IndexedDB-backed store', async () => {
    const store = createMemoryStore();

    const payload: InteractiveSessionPayload = {
      version: 2,
      turnNumber: 0,
      selectedTrame: 'custom',
      storyRuntimeMode: 'agentic-subagents',
      currentChapter: null,
      chapterHistory: [],
      actionHistory: [],
      aiMessages: [],
      memoryLog: [],
      backgroundEvents: [],
      setupSnapshot: fallbackSetup,
      campaignArchive: []
    };

    await saveInteractiveSessionPayload('story-setup-only', payload, store);
    const loaded = await loadInteractiveSessionPayload('story-setup-only', fallbackSetup, store);

    expect(loaded).not.toBeNull();
    expect(loaded?.currentChapter).toBeNull();
    expect(loaded?.chapterHistory).toEqual([]);
    expect(loaded?.turnNumber).toBe(0);
    expect(loaded?.storyRuntimeMode).toBe('agentic-subagents');
    expect(loaded?.setupSnapshot).toEqual(fallbackSetup);
  });

  it('prefers an IndexedDB record over a legacy localStorage entry', async () => {
    const store = createMemoryStore();
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    // A stale localStorage entry that must be ignored once a db record exists.
    localStorage.setItem(
      'sw_svelte_interactive_story_story-precedence',
      JSON.stringify({ version: 2, turnNumber: 99, chapterHistory: [], setupSnapshot: fallbackSetup })
    );

    const payload: InteractiveSessionPayload = {
      version: 2,
      turnNumber: 3,
      selectedTrame: null,
      storyRuntimeMode: 'structured-json',
      currentChapter: null,
      chapterHistory: [],
      actionHistory: [],
      aiMessages: [],
      memoryLog: [],
      backgroundEvents: [],
      setupSnapshot: fallbackSetup,
      campaignArchive: []
    };
    await saveInteractiveSessionPayload('story-precedence', payload, store);

    const loaded = await loadInteractiveSessionPayload('story-precedence', fallbackSetup, store);

    expect(loaded?.turnNumber).toBe(3);
    expect(loaded?.storyRuntimeMode).toBe('structured-json');
  });

  it('migrates a legacy localStorage session into the store and drops the old key', async () => {
    const store = createMemoryStore();
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    const key = 'sw_svelte_interactive_story_story-migrate';
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        turnNumber: 4,
        chapterHistory: [],
        actionHistory: [],
        aiMessages: [{ role: 'assistant', content: 'ok' }],
        memoryLog: ['fait'],
        setupSnapshot: fallbackSetup
      })
    );

    const loaded = await loadInteractiveSessionPayload('story-migrate', fallbackSetup, store);

    expect(loaded?.turnNumber).toBe(4);
    expect(store.data.has('story-migrate')).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('backfills legacy background events as visible by default', async () => {
    const store = createMemoryStore();
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    localStorage.setItem(
      'sw_svelte_interactive_story_story-legacy',
      JSON.stringify({
        version: 1,
        turnNumber: 1,
        chapterHistory: [],
        actionHistory: [],
        aiMessages: [],
        memoryLog: [],
        backgroundEvents: [{ id: 'bg-1', turn: 1, title: 'Test', summary: 'Visible par défaut' }],
        setupSnapshot: fallbackSetup
      })
    );

    const loaded = await loadInteractiveSessionPayload('story-legacy', fallbackSetup, store);

    expect(loaded?.backgroundEvents?.[0]?.visibleNow).toBe(true);
  });

  it('drops malformed world state payloads instead of restoring unusable runtime data', async () => {
    const store = createMemoryStore();
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    localStorage.setItem(
      'sw_svelte_interactive_story_story-bad-world',
      JSON.stringify({
        version: 1,
        turnNumber: 2,
        chapterHistory: [],
        actionHistory: [],
        aiMessages: [{ role: 'assistant', content: 'ok' }],
        memoryLog: ['fait'],
        worldState: {
          player: {
            hp: '100',
            credits: 900,
            location: ''
          },
          npcs: 'not-an-array'
        },
        setupSnapshot: fallbackSetup
      })
    );

    const loaded = await loadInteractiveSessionPayload('story-bad-world', fallbackSetup, store);

    expect(loaded).not.toBeNull();
    expect(loaded?.worldState).toBeUndefined();
    expect(loaded?.aiMessages).toEqual([{ role: 'assistant', content: 'ok' }]);
    expect(loaded?.memoryLog).toEqual(['fait']);
  });

  it.each(SESSION_CORRUPTION_FIXTURES)('survives corrupted session fixture: $name', async ({ payload }) => {
    const store = createMemoryStore();
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    localStorage.setItem(
      'sw_svelte_interactive_story_story-corrupted',
      JSON.stringify(payload)
    );

    const loaded = await loadInteractiveSessionPayload('story-corrupted', fallbackSetup, store);

    if ((payload.version as number | undefined) === 99) {
      expect(loaded).toBeNull();
      return;
    }

    expect(loaded).not.toBeNull();
    expect(loaded?.setupSnapshot).toEqual(fallbackSetup);
    expect(Array.isArray(loaded?.chapterHistory)).toBe(true);
  });

  it('protects AI-generated protagonist avatar from being overwritten by emoji', async () => {
    const store = createMemoryStore();
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    const setupWithAiAvatar = {
      ...fallbackSetup,
      protagonistAvatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'
    };

    localStorage.setItem(
      'sw_svelte_interactive_story_story-protect-avatar',
      JSON.stringify({
        version: 2,
        turnNumber: 1,
        chapterHistory: [],
        actionHistory: [],
        aiMessages: [],
        memoryLog: [],
        setupSnapshot: {
          ...fallbackSetup,
          protagonistAvatar: '🧑‍🚀' // Emoji par défaut dans la session stockée
        }
      })
    );

    // On charge la session avec le fallback setup possédant l'avatar IA
    const loaded = await loadInteractiveSessionPayload('story-protect-avatar', setupWithAiAvatar, store);

    expect(loaded).not.toBeNull();
    expect(loaded?.setupSnapshot.protagonistAvatar).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA');
  });
});
