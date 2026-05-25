import { describe, it, expect } from 'vitest';
import { initWorldState, applyStateUpdate, advanceNarrativeDate, rebuildWorldState } from './worldState';
import type { StateUpdate, StoryChapter, StorySetup } from './types';

const setup: StorySetup = {
  era: 'imperial', faction: 'rebels', role: 'jedi_knight', premise: 'x',
  protagonistFirstName: 'Kael', writingStyle: 'cinematique', language: 'fr'
};

function chapter(state_update: StateUpdate, n = 1, title = 'Scène'): StoryChapter {
  return {
    chapter_title: title, chapter_number: n, section_type: 'action',
    narrative: { action: '', dialogue: '', reflection: '', atmosphere: 'tense' },
    choices: [], memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] },
    state_update
  };
}

describe('initWorldState', () => {
  it('seeds hp, role-based credits, era date and the player faction', () => {
    const w = initWorldState(setup);
    expect(w.player.hp).toBe(100);
    expect(w.player.credits).toBe(500); // jedi_knight
    expect(w.player.condition).toBe('active');
    expect(w.player.date).toContain('19 AVBY');
    expect(w.factions.rebels).toBe(50);
  });
});

describe('applyStateUpdate — vitals', () => {
  it('treats hp/credits as signed deltas and clamps them', () => {
    const w = applyStateUpdate(initWorldState(setup), chapter({ hp: -30, credits: -200 }));
    expect(w.player.hp).toBe(70);
    expect(w.player.credits).toBe(300);
  });

  it('floors hp at 0 and flips condition to critical, then heals back', () => {
    const downed = applyStateUpdate(initWorldState(setup), chapter({ hp: -500 }));
    expect(downed.player.hp).toBe(0);
    expect(downed.player.condition).toBe('critical');
    const revived = applyStateUpdate(downed, chapter({ hp: 40 }));
    expect(revived.player.hp).toBe(40);
    expect(revived.player.condition).toBe('active');
  });

  it('never lets credits go negative', () => {
    const w = applyStateUpdate(initWorldState(setup), chapter({ credits: -99999 }));
    expect(w.player.credits).toBe(0);
  });
});

describe('applyStateUpdate — injuries & inventory', () => {
  it('adds new injuries and resolves by partial description match', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ injuries_new: [{ description: 'Brûlure au bras', severity: 'moderate' }] }));
    expect(a.player.injuries).toHaveLength(1);
    const b = applyStateUpdate(a, chapter({ injuries_resolved: ['brûlure'] }));
    expect(b.player.injuries).toHaveLength(0);
  });

  it('stacks gained items and removes fully-lost ones', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ inventory_gained: [{ name: 'Medpac', qty: 2 }] }));
    const b = applyStateUpdate(a, chapter({ inventory_gained: [{ name: 'medpac', qty: 1 }] }));
    expect(b.player.inventory[0].qty).toBe(3);
    const c = applyStateUpdate(b, chapter({ inventory_lost: [{ name: 'Medpac', qty: 3 }] }));
    expect(c.player.inventory).toHaveLength(0);
  });
});

describe('applyStateUpdate — NPCs', () => {
  it('inserts then updates an NPC by name without duplicating', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ npcs: [{ name: 'Vela', affinity: 10 }] }));
    const b = applyStateUpdate(a, chapter({ npcs: [{ name: 'vela', affinity: 40 }] }));
    expect(b.npcs).toHaveLength(1);
    expect(b.npcs[0].affinity).toBe(40);
    expect(b.npcs[0].status).toBe('ally'); // ≥25
  });

  it('merges a name reveal onto an anonymous entry instead of duplicating', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ npcs: [{ name: "L'inconnu", affinity: 0 }] }));
    const b = applyStateUpdate(a, chapter({ npcs: [{ name: 'Dorn', affinity: 10 }] }));
    expect(b.npcs).toHaveLength(1);
    expect(b.npcs[0].name).toBe('Dorn');
  });

  it('marks an NPC dead', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ npcs: [{ name: 'Rax', affinity: -50 }] }));
    const b = applyStateUpdate(a, chapter({ npcs: [{ name: 'Rax', alive: false }] }));
    expect(b.npcs[0].status).toBe('dead');
    expect(b.npcs[0].alive).toBe(false);
  });
});

describe('applyStateUpdate — factions & date', () => {
  it('applies faction deltas clamped to [-100,100]', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ factions: { empire: -40 } }));
    expect(a.factions.empire).toBe(-40);
    const b = applyStateUpdate(a, chapter({ factions: { empire: -90 } }));
    expect(b.factions.empire).toBe(-100);
  });

  it('records a chronology entry each turn', () => {
    const w = applyStateUpdate(initWorldState(setup), chapter({ location: 'Mos Eisley' }, 1, 'Arrivée'));
    expect(w.chronology).toHaveLength(1);
    expect(w.chronology[0].location).toBe('Mos Eisley');
  });
});

describe('advanceNarrativeDate', () => {
  it('increments the day for a relative advance', () => {
    expect(advanceNarrativeDate('19 AVBY, Jour 1', '+1 jour')).toBe('19 AVBY, Jour 2');
  });
  it('takes an absolute era date verbatim', () => {
    expect(advanceNarrativeDate('19 AVBY, Jour 1', '18 AVBY, Jour 3')).toContain('18 AVBY');
  });
});

describe('rebuildWorldState', () => {
  it('replays chapters in order to reconstruct the world', () => {
    const chapters = [chapter({ hp: -20 }, 1), chapter({ hp: -10, credits: 100 }, 2)];
    const w = rebuildWorldState(setup, chapters);
    expect(w.player.hp).toBe(70);
    expect(w.player.credits).toBe(600);
    expect(w.chronology).toHaveLength(2);
  });
});
