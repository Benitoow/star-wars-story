import { describe, expect, it } from 'vitest';
import type { StoryChapter } from '$lib/ai/storyEngine';
import {
  applyStateUpdateToWorldState,
  FR_WORLD_HEURISTICS,
  getWorldHeuristics,
  initWorldState,
  rebuildWorldStateFromHistory,
  worldStateNeedsRepair
} from './worldStateReducer';

function buildMinimalChapter(overrides: Partial<StoryChapter> = {}): StoryChapter {
  return {
    chapter_title: 'Scène',
    chapter_number: 2,
    section_type: 'action',
    narrative: { context: '', action: '', dialogue: '', reflection: '', atmosphere: 'tense' },
    choices: [],
    memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] },
    scene_description: 'test',
    user_edits_applied: null,
    state_update: {},
    ...overrides
  };
}

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

  it('applies hp and credits as strict deltas instead of guessing absolute snapshots', () => {
    const initial = initWorldState(setup);
    initial.player.hp = 20;
    initial.player.credits = 800;

    const next = applyStateUpdateToWorldState(initial, {
      ...buildChapter(),
      state_update: {
        hp: 80,
        credits: 600
      }
    });

    expect(next.player.hp).toBe(100);
    expect(next.player.credits).toBe(1400);
  });

  it('keeps the existing director instruction when no new one is provided', () => {
    const initial = initWorldState(setup);
    initial.director_instruction = 'Maintiens la pression';

    const next = applyStateUpdateToWorldState(initial, {
      ...buildChapter(),
      state_update: {
        hp: -5
      }
    });

    expect(next.director_instruction).toBe('Maintiens la pression');
  });

  it('forces npc alive=false when a status update says dead and vice versa', () => {
    const initial = initWorldState(setup);
    initial.npcs = [
      {
        name: 'Lira Voss',
        affinity: 40,
        status: 'ally',
        alive: true,
        last_seen: 'Nar Shaddaa'
      }
    ];

    const next = applyStateUpdateToWorldState(initial, {
      ...buildChapter(),
      state_update: {
        npcs: [
          { name: 'Lira Voss', status: 'dead', alive: true },
          { name: 'Grisk', status: 'ally', alive: false }
        ]
      }
    });

    expect(next.npcs.find(npc => npc.name === 'Lira Voss')).toMatchObject({ status: 'dead', alive: false });
    expect(next.npcs.find(npc => npc.name === 'Grisk')).toMatchObject({ status: 'dead', alive: false });
  });

  it('does not mark a clean seeded world state as broken just because arrays are still empty', () => {
    const initial = initWorldState(setup);

    expect(worldStateNeedsRepair(initial)).toBe(false);
  });

  it('marks malformed world state payloads as needing repair', () => {
    const malformed = {
      ...initWorldState(setup),
      player: {
        ...initWorldState(setup).player,
        inventory: 'not-an-array'
      }
    };

    expect(worldStateNeedsRepair(malformed as never)).toBe(true);
  });

  it('seeds the player condition as active', () => {
    expect(initWorldState(setup).player.condition).toBe('active');
  });

  it('flips the player condition to critical when HP reaches 0', () => {
    const initial = initWorldState(setup);
    initial.player.hp = 10;
    const chapter = buildChapter();
    chapter.state_update = { hp: -25 };

    const next = applyStateUpdateToWorldState(initial, chapter);

    expect(next.player.hp).toBe(0);
    expect(next.player.condition).toBe('critical');
  });

  it('restores the active condition when HP climbs back above 0', () => {
    const downed = initWorldState(setup);
    downed.player.hp = 0;
    downed.player.condition = 'critical';
    const chapter = buildChapter();
    chapter.state_update = { hp: 30 };

    const next = applyStateUpdateToWorldState(downed, chapter);

    expect(next.player.hp).toBe(30);
    expect(next.player.condition).toBe('active');
  });

  it('rejects an invalid player condition during repair checks', () => {
    const broken = {
      ...initWorldState(setup),
      player: { ...initWorldState(setup).player, condition: 'doomed' }
    };

    expect(worldStateNeedsRepair(broken as never)).toBe(true);
  });
});

describe('world state reliability (#4)', () => {
  it('lets an explicit affinity signal win over hostile regex inference', () => {
    const initial = initWorldState(setup);
    const chapter = buildMinimalChapter({
      narrative: {
        context: '',
        action: 'Dash Rendar te trahit et t’attaque sans prévenir.',
        dialogue: 'Dash Rendar : « Reste avec nous. »',
        reflection: '',
        atmosphere: 'tense'
      },
      state_update: { npcs: [{ name: 'Dash Rendar', affinity: 60, status: 'ally', alive: true }] }
    });

    const next = applyStateUpdateToWorldState(initial, chapter);
    const dash = next.npcs.find(npc => npc.name === 'Dash Rendar');

    expect(dash?.affinity).toBe(60);
    expect(dash?.status).toBe('ally');
  });

  it('infers affinity from relation keywords only when no explicit signal is given', () => {
    const initial = initWorldState(setup);
    const chapter = buildMinimalChapter({
      narrative: {
        context: '',
        action: 'Mara Jade te sauve, te protège et te couvre pendant la fuite.',
        dialogue: 'Mara Jade : « Par ici, vite ! »',
        reflection: '',
        atmosphere: 'tense'
      },
      state_update: { npcs: [{ name: 'Mara Jade' }] }
    });

    const next = applyStateUpdateToWorldState(initial, chapter);
    const mara = next.npcs.find(npc => npc.name === 'Mara Jade');

    expect(mara).toBeDefined();
    expect((mara?.affinity ?? 0)).toBeGreaterThan(0);
  });

  it('refuses a faction label as a location (leak guard)', () => {
    const initial = initWorldState(setup);
    const startLocation = initial.player.location;
    const chapter = buildMinimalChapter({
      narrative: { context: '', action: 'La salle tremble sous les détonations.', dialogue: '', reflection: '', atmosphere: 'tense' },
      state_update: { location: 'Empire' }
    });

    const next = applyStateUpdateToWorldState(initial, chapter);

    expect(next.player.location).not.toBe('Empire');
    expect(next.player.location).toBe(startLocation);
  });

  it('does not turn an atmospheric/object speaker into an NPC', () => {
    const initial = initWorldState(setup);
    const chapter = buildMinimalChapter({
      narrative: {
        context: '',
        action: 'Un grésillement emplit la cabine.',
        dialogue: 'Voix distordue de l’émetteur : « Rendez-vous. »',
        reflection: '',
        atmosphere: 'eerie'
      }
    });

    const next = applyStateUpdateToWorldState(initial, chapter);

    expect(next.npcs).toHaveLength(0);
  });

  it('does not turn a place name into an NPC speaker', () => {
    const initial = initWorldState(setup);
    const chapter = buildMinimalChapter({
      narrative: {
        context: '',
        action: 'Les annonces résonnent dans le hall.',
        dialogue: 'Coruscant : « Bienvenue, voyageur. »',
        reflection: '',
        atmosphere: 'calm'
      }
    });

    const next = applyStateUpdateToWorldState(initial, chapter);

    expect(next.npcs.some(npc => npc.name.toLowerCase() === 'coruscant')).toBe(false);
  });

  it('resolves the French heuristics pack and falls back for unknown languages', () => {
    expect(getWorldHeuristics('fr')).toBe(FR_WORLD_HEURISTICS);
    expect(getWorldHeuristics('en')).toBe(FR_WORLD_HEURISTICS);
    expect(getWorldHeuristics()).toBe(FR_WORLD_HEURISTICS);
  });
});
