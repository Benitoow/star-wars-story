import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadInteractiveSessionPayload,
  saveInteractiveSessionPayload,
  type InteractiveSessionPayload
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('interactiveSession', () => {
  it('restores setup-only sessions with no chapter history', () => {
    vi.stubGlobal('localStorage', createLocalStorageMock());

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

    saveInteractiveSessionPayload('story-setup-only', payload);
    const loaded = loadInteractiveSessionPayload('story-setup-only', fallbackSetup);

    expect(loaded).not.toBeNull();
    expect(loaded?.currentChapter).toBeNull();
    expect(loaded?.chapterHistory).toEqual([]);
    expect(loaded?.turnNumber).toBe(0);
    expect(loaded?.storyRuntimeMode).toBe('agentic-subagents');
    expect(loaded?.setupSnapshot).toEqual(fallbackSetup);
  });

  it('backfills legacy background events as visible by default', () => {
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

    const loaded = loadInteractiveSessionPayload('story-legacy', fallbackSetup);

    expect(loaded?.backgroundEvents?.[0]?.visibleNow).toBe(true);
  });

  it('drops malformed world state payloads instead of restoring unusable runtime data', () => {
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

    const loaded = loadInteractiveSessionPayload('story-bad-world', fallbackSetup);

    expect(loaded).not.toBeNull();
    expect(loaded?.worldState).toBeUndefined();
    expect(loaded?.aiMessages).toEqual([{ role: 'assistant', content: 'ok' }]);
    expect(loaded?.memoryLog).toEqual(['fait']);
  });

  it.each(SESSION_CORRUPTION_FIXTURES)('survives corrupted session fixture: $name', ({ payload }) => {
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    localStorage.setItem(
      'sw_svelte_interactive_story_story-corrupted',
      JSON.stringify(payload)
    );

    const loaded = loadInteractiveSessionPayload('story-corrupted', fallbackSetup);

    if ((payload.version as number | undefined) === 99) {
      expect(loaded).toBeNull();
      return;
    }

    expect(loaded).not.toBeNull();
    expect(loaded?.setupSnapshot).toEqual(fallbackSetup);
    expect(Array.isArray(loaded?.chapterHistory)).toBe(true);
  });
});
