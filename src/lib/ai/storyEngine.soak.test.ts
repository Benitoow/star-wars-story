import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStoryTurn, type ChatMessage } from './storyEngine';
import { applyStateUpdateToWorldState, initWorldState, rebuildWorldStateFromHistory } from '$lib/editor/worldStateReducer';
import { loadInteractiveSessionPayload, saveInteractiveSessionPayload, type InteractiveSessionPayload, type SessionStore } from '$lib/editor/interactiveSession';

function createMemoryStore(): SessionStore {
  const data = new Map<string, unknown>();
  return {
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

const setup = {
  era: 'imperial',
  faction: 'rebels',
  role: 'smuggler',
  premise: 'Une campagne soak pour casser les dérives silencieuses.'
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

function buildAssistantResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            role: 'assistant',
            content
          }
        }
      ]
    })
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('story engine soak', () => {
  it('replays 200 mocked turns without empty chapters, invalid state, or session divergence', async () => {
    vi.stubGlobal('localStorage', createLocalStorageMock());

    let responseIndex = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      const turnNumber = Math.floor(responseIndex / 4) + 1;
      const step = responseIndex % 4;
      responseIndex += 1;

      if (step === 0) {
        return buildAssistantResponse(`Tour ${turnNumber}. Le secteur se crispe et le protagoniste garde l’initiative.`);
      }

      if (step === 1) {
        return buildAssistantResponse(JSON.stringify({
          player_action: `Je pousse l’avantage au tour ${turnNumber}.`,
          scene_goal: `Rendre le tour ${turnNumber} immédiatement jouable.`,
          tension: `Le tour ${turnNumber} doit conserver une pression nette.`,
          must_include: ['Un lieu concret', 'Une conséquence immédiate', 'Une relation qui bouge'],
          required_world_signals: ['location', 'npc'],
          section_type: turnNumber % 4 === 0 ? 'dialogue' : 'action',
          atmosphere: 'tense'
        }));
      }

      if (step === 2) {
        return buildAssistantResponse([
          `Le hangar ${turnNumber} vibre sous les alarmes et les pas pressés.`,
          `Tu t’imposes dans la trajectoire ennemie avant qu’ils ne referment le piège.`,
          `"On n’a plus de marge, on agit maintenant."`,
          `La scène reste nette, jouable, et coupe court à toute prose décorative inutile.`
        ].join('\n\n'));
      }

      return buildAssistantResponse(JSON.stringify({
        chapter_title: `Tour ${turnNumber} sous pression`,
        section_type: turnNumber % 4 === 0 ? 'dialogue' : 'action',
        atmosphere: 'tense',
        choices: [
          { text: 'Forcer le passage', attribute: 'combat', difficulty: 2, faction_impact: { empire: -1 } },
          { text: 'Mentir avec aplomb', attribute: 'diplomacy', difficulty: 3, faction_impact: { rebels: 1 } },
          { text: 'Contourner par les ombres', attribute: 'stealth', difficulty: 2, faction_impact: {} }
        ],
        memory_updates: {
          relations: [`Allié du tour ${turnNumber} reste engagé.`],
          places: [`Hangar ${turnNumber}`],
          injuries: [],
          resources: turnNumber % 2 === 0 ? [`Prime du tour ${turnNumber}`] : [],
          notes: [`Le tour ${turnNumber} laisse une trace exploitable.`]
        },
        state_update: {
          location: `Hangar ${turnNumber}`,
          hp: turnNumber % 3 === 0 ? -6 : 3,
          credits: turnNumber % 2 === 0 ? 25 : -15,
          npcs: [{ name: `Allié ${turnNumber}`, affinity: 25, status: 'ally', alive: true, current_location: `Hangar ${turnNumber}` }],
          factions: { empire: -1, rebels: 1 },
          rumors_new: [`Rumeur du tour ${turnNumber}`],
          environment_status: `Secteur sous tension ${turnNumber}`,
          director_instruction: `Tenir la pression du tour ${turnNumber + 1}`
        }
      }));
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const providerConfig = {
      providerId: 'openrouter',
      model: 'qwen/qwen3.5-9b',
      apiKey: 'test-key'
    };

    let worldState = initWorldState(setup);
    let aiMessages: ChatMessage[] = [{ role: 'system', content: 'Soak system prompt' }];
    const chapterHistory = [];
    const actionHistory: string[] = [];
    const storyId = 'story-engine-soak';
    const sessionStore = createMemoryStore();

    for (let turnNumber = 1; turnNumber <= 200; turnNumber += 1) {
      const userAction = `ACTION JOUEUR CANONIQUE: Je prends le contrôle du tour ${turnNumber}.`;
      aiMessages = [...aiMessages, { role: 'user', content: userAction }];
      actionHistory.push(userAction);

      const generation = await generateStoryTurn(aiMessages, providerConfig, turnNumber);
      expect(generation.chapter.narrative.action || generation.chapter.narrative.dialogue).toBeTruthy();

      worldState = applyStateUpdateToWorldState(worldState, generation.chapter);
      chapterHistory.push(generation.chapter);
      aiMessages = [...aiMessages, { role: 'assistant', content: generation.rawResponse }];

      if (turnNumber % 25 === 0) {
        const payload: InteractiveSessionPayload = {
          version: 2,
          turnNumber,
          selectedTrame: 'custom',
          storyRuntimeMode: generation.mode,
          currentChapter: generation.chapter,
          chapterHistory: [...chapterHistory],
          actionHistory: [...actionHistory],
          aiMessages: [...aiMessages],
          memoryLog: [],
          setupSnapshot: setup,
          backgroundEvents: [],
          worldState,
          campaignArchive: []
        };

        await saveInteractiveSessionPayload(storyId, payload, sessionStore);
        const restored = await loadInteractiveSessionPayload(storyId, setup, sessionStore);
        expect(restored?.turnNumber).toBe(turnNumber);
        expect(restored?.chapterHistory).toHaveLength(turnNumber);
        expect(restored?.worldState?.player.location).toBe(worldState.player.location);
      }
    }

    const rebuilt = rebuildWorldStateFromHistory(setup, chapterHistory, worldState);
    expect(rebuilt.player.hp).toBe(worldState.player.hp);
    expect(rebuilt.player.credits).toBe(worldState.player.credits);
    expect(rebuilt.player.location).toBe(worldState.player.location);
    expect(rebuilt.chronology).toHaveLength(worldState.chronology.length);
    expect(rebuilt.chronology.length).toBeGreaterThan(0);
  });
});
