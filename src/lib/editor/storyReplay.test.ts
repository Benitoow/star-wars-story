import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStoryTurn, type ChatMessage } from '$lib/ai/storyEngine';
import { STORY_REPLAY_SCENARIOS } from '../../test/fixtures/storyReplayScenarios';
import {
  loadInteractiveSessionPayload,
  saveInteractiveSessionPayload,
  type InteractiveSessionPayload
} from './interactiveSession';
import { initWorldState, applyStateUpdateToWorldState, rebuildWorldStateFromHistory } from './worldStateReducer';

const setup = {
  era: 'imperial',
  faction: 'rebels',
  role: 'smuggler',
  premise: 'Une cellule rebelle tente de survivre à la pression impériale.'
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

function buildAssistantMessage(content: string) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content
        }
      }
    ]
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('story engine replay corpus', () => {
  it('replays twelve deterministic campaign turns without diverging session or world state rebuild', async () => {
    vi.stubGlobal('localStorage', createLocalStorageMock());

    const queuedResponses = STORY_REPLAY_SCENARIOS.flatMap(scenario => [
      buildAssistantMessage(scenario.scribe),
      buildAssistantMessage(JSON.stringify(scenario.director)),
      buildAssistantMessage(scenario.writer),
      buildAssistantMessage(JSON.stringify(scenario.brain))
    ]);

    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => queuedResponses.shift()
    } as Response));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const providerConfig = {
      providerId: 'openrouter',
      model: 'qwen/qwen3.5-9b',
      apiKey: 'test-key'
    };

    let aiMessages: ChatMessage[] = [{ role: 'system', content: 'System prompt test' }];
    let worldState = initWorldState(setup);
    const chapterHistory = [];
    const actionHistory: string[] = [];
    const memoryLog: string[] = [];
    const storyId = 'story-replay-corpus';

    for (const scenario of STORY_REPLAY_SCENARIOS) {
      aiMessages = [...aiMessages, { role: 'user', content: `ACTION JOUEUR CANONIQUE: ${scenario.userAction}` }];
      actionHistory.push(scenario.userAction);

      const result = await generateStoryTurn(aiMessages, providerConfig, scenario.turnNumber);
      expect(result.mode).toBe('agentic-subagents');
      expect(result.chapter.chapter_number).toBe(scenario.turnNumber);
      expect(result.chapter.narrative.action || result.chapter.narrative.dialogue).toBeTruthy();

      worldState = applyStateUpdateToWorldState(worldState, result.chapter);
      chapterHistory.push(result.chapter);
      aiMessages = [...aiMessages, { role: 'assistant', content: result.rawResponse }];

      const payload: InteractiveSessionPayload = {
        version: 2,
        turnNumber: scenario.turnNumber,
        selectedTrame: 'custom',
        storyRuntimeMode: result.mode,
        currentChapter: result.chapter,
        chapterHistory: [...chapterHistory],
        actionHistory: [...actionHistory],
        aiMessages: [...aiMessages],
        memoryLog: [...memoryLog],
        setupSnapshot: setup,
        backgroundEvents: [],
        worldState,
        campaignArchive: []
      };

      saveInteractiveSessionPayload(storyId, payload);
      const loaded = loadInteractiveSessionPayload(storyId, setup);

      expect(loaded?.turnNumber).toBe(scenario.turnNumber);
      expect(loaded?.chapterHistory).toHaveLength(scenario.turnNumber);
      expect(loaded?.storyRuntimeMode).toBe('agentic-subagents');
      expect(loaded?.worldState?.player.location).toBe(worldState.player.location);
    }

    expect(fetchMock).toHaveBeenCalledTimes(STORY_REPLAY_SCENARIOS.length * 4);

    const rebuilt = rebuildWorldStateFromHistory(setup, chapterHistory, worldState);
    expect(rebuilt.player.hp).toBe(worldState.player.hp);
    expect(rebuilt.player.credits).toBe(worldState.player.credits);
    expect(rebuilt.player.location).toBe(worldState.player.location);
    expect(rebuilt.environment_status).toBe(worldState.environment_status);
    expect(rebuilt.director_instruction).toBe(worldState.director_instruction);
    expect(rebuilt.chronology).toHaveLength(STORY_REPLAY_SCENARIOS.length);
  });
});
