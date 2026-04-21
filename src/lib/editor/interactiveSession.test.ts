import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadInteractiveSessionPayload,
  saveInteractiveSessionPayload,
  type InteractiveSessionPayload
} from './interactiveSession';

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
      version: 1,
      turnNumber: 0,
      selectedTrame: 'custom',
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
});
