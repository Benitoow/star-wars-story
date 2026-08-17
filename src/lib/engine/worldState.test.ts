import { describe, it, expect } from 'vitest';
import { initWorldState, applyStateUpdate, advanceNarrativeDate, rebuildWorldState, cloneWorldState, hasRequiredItems, applyChoiceInventoryCost } from './worldState';
import type { StateUpdate, StoryChapter, StoryChoice, StorySetup } from './types';

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
    expect(w.player.skills.force).toBeGreaterThan(w.player.skills.tech);
    expect(w.campaign.status).toBe('active');
    expect(w.campaign.objective).toContain('x');
  });

  it('repairs a legacy world save that predates skills and campaign fields', () => {
    const legacy = {
      player: { hp: 70, credits: 20, location: 'Cantina', date: 'Jour 3', injuries: [], inventory: [], condition: 'active' },
      npcs: [], factions: {}, chronology: []
    } as unknown as import('./types').WorldState;
    const repaired = cloneWorldState(legacy);
    expect(repaired.player.skills.combat).toBe(2);
    expect(repaired.player.level).toBe(1);
    expect(repaired.campaign.status).toBe('active');
    expect(repaired.world_events).toEqual([]);
  });
  it('treats inventory as a real choice resource and consumes declared costs once', () => {
    const world = initWorldState(setup);
    world.player.inventory = [{ name: 'Medpac', qty: 1 }];
    const choice: StoryChoice = { text: 'Soigner la blessée', attribute: 'tech', difficulty: 2, faction_impact: {}, requires_items: ['medpac'], consumes_items: ['Medpac'] };
    expect(hasRequiredItems(world, choice)).toBe(true);
    const after = applyChoiceInventoryCost(world, choice);
    expect(after.player.inventory).toEqual([]);
    expect(world.player.inventory[0].qty).toBe(1);
    expect(hasRequiredItems(world, { ...choice, requires_items: ['medpac', 'medpac'] })).toBe(false);
    const before = initWorldState(setup);
    before.player.inventory = [{ name: 'Medpac', qty: 2 }];
    const modelAfter = applyStateUpdate(before, chapter({ inventory_lost: [{ name: 'Medpac', qty: 1 }] }));
    const once = applyChoiceInventoryCost(modelAfter, choice, before);
    expect(once.player.inventory).toEqual([{ name: 'Medpac', qty: 1 }]);
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

  it('ends the campaign when a second critical scene brings no rescue', () => {
    const first = applyStateUpdate(initWorldState(setup), chapter({ hp: -500 }, 1));
    const second = applyStateUpdate(first, chapter({ hp: 0 }, 2, 'Dernier souffle'));
    expect(second.ending?.type).toBe('death');
    expect(second.campaign.status).toBe('failed');
  });

  it('does not let a model death ending skip the first critical last chance', () => {
    const critical = applyStateUpdate(initWorldState(setup), chapter({ hp: -500, ending: { type: 'death', title: 'Trop tôt', epilogue: '' } }, 1));
    expect(critical.ending).toBeUndefined();
    expect(critical.player.condition).toBe('critical');
    expect(critical.player.criticalTurns).toBe(1);
  });

  it('turns an explicit failed campaign into a visible defeat ending', () => {
    const failed = applyStateUpdate(initWorldState(setup), chapter({ campaign_update: { status: 'failed', progress: 'Le contact est perdu.' } }, 1));
    expect(failed.ending?.type).toBe('defeat');
    expect(failed.campaign.status).toBe('failed');
  });
  it('applies experience, skill gains and off-screen world events', () => {
    const next = applyStateUpdate(initWorldState(setup), chapter({
      experience: 120,
      skill_gains: { force: 1 },
      world_events_new: ['Une garnison impériale évacue le secteur.']
    }, 1));
    expect(next.player.level).toBe(2);
    expect(next.player.skills.force).toBeGreaterThan(initWorldState(setup).player.skills.force);
    expect(next.world_events[0].summary).toContain('évacue');
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

  it('stamps last_seen for NPCs listed in npcs_present (accent-insensitive)', () => {
    const a = applyStateUpdate(initWorldState(setup), chapter({ npcs: [{ name: 'Véla', affinity: 10 }, { name: 'Dorn', affinity: 0 }] }));
    const next = { ...chapter({}), npcs_present: ['vela'] };
    const b = applyStateUpdate(a, next);
    expect(b.npcs.find((n) => n.name === 'Véla')?.last_seen).toBe(b.player.date);
    expect(b.npcs.find((n) => n.name === 'Dorn')?.last_seen).toBeUndefined();
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

  it('does not accumulate the same narrative time fragment forever', () => {
    const once = advanceNarrativeDate('3950 AVBY, Jour 1', 'quelques minutes d\'accalmie dans la cour de Bith');
    expect(advanceNarrativeDate(once, 'quelques minutes d\'accalmie dans la cour de Bith')).toBe(once);
    expect(once.length).toBeLessThan(80);
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
