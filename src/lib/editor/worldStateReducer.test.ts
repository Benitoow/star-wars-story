import { describe, expect, it } from 'vitest';
import type { StoryChapter } from '$lib/ai/storyEngine';
import { applyStateUpdateToWorldState, initWorldState, rebuildWorldStateFromHistory } from './worldStateReducer';

const setup = {
  era: 'imperial',
  faction: 'rebels',
  role: 'smuggler',
  premise: 'Un cargo disparaît sur Nar Shaddaa.'
};

function buildChapter(): StoryChapter {
  return {
    chapter_title: 'Chaos au spatioport',
    chapter_number: 2,
    section_type: 'action',
    narrative: {
      context: '',
      action: 'La foule se disperse dans le spatioport de Nar Shaddaa pendant que les alarmes se déclenchent.',
      dialogue: '',
      reflection: '',
      atmosphere: 'tense'
    },
    choices: [],
    memory_updates: {
      relations: [],
      places: [],
      injuries: [],
      resources: [],
      notes: []
    },
    scene_description: 'test',
    user_edits_applied: null,
    state_update: {
      hp: -10,
      credits: 100,
      clocks_new: [{ name: 'alerte_portuaire', max_steps: 4 }],
      clocks_advance: { alerte_portuaire: 1 },
      sector_influence: { rebel_alliance: 15 },
      rumors_new: ['Les quais sont sur le point d’exploser.'],
      environment_status: 'Port sous tension',
      director_instruction: 'Fais monter la pression'
    }
  };
}

describe('worldStateReducer', () => {
  it('preserves advanced world state fields when applying a chapter update', () => {
    const initial = initWorldState(setup);
    const next = applyStateUpdateToWorldState(initial, buildChapter());

    expect(next.player.hp).toBe(90);
    expect(next.player.credits).toBe(900);
    expect(next.clocks?.alerte_portuaire).toEqual({ current: 1, max: 4 });
    expect(next.sector_influence?.rebel_alliance).toBe(65);
    expect(next.rumors).toContain('Les quais sont sur le point d’exploser.');
    expect(next.environment_status).toBe('Port sous tension');
    expect(next.director_instruction).toBe('Fais monter la pression');
  });

  it('rebuilds from a clean seed instead of double-applying an already-mutated state', () => {
    const chapter = buildChapter();
    const initial = initWorldState(setup);
    const mutatedState = applyStateUpdateToWorldState(initial, chapter);
    const rebuilt = rebuildWorldStateFromHistory(setup, [chapter], mutatedState);

    expect(rebuilt.player.hp).toBe(mutatedState.player.hp);
    expect(rebuilt.player.credits).toBe(mutatedState.player.credits);
    expect(rebuilt.clocks?.alerte_portuaire).toEqual({ current: 1, max: 4 });
    expect(rebuilt.chronology).toHaveLength(1);
  });
});
