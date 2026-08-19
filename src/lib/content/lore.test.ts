import { describe, it, expect } from 'vitest';
import { eraFit, FACTION_DESC, ROLE_DESC, SKILL_LABELS } from './lore';
import { ERAS, FACTIONS, ROLES, deriveSkillProfile, FACTION_CREDITS } from './catalog';

describe('era coherence', () => {
  it('flags factions that simply do not exist yet', () => {
    expect(eraFit('old_republic', 'empire').fit).toBe('absent');
    expect(eraFit('old_republic', 'first_order').fit).toBe('absent');
    expect(eraFit('clone_wars', 'rebels').fit).toBe('absent');
    expect(eraFit('old_republic', 'empire').reason).toMatch(/4 000 ans/);
  });

  it('flags factions that no longer exist', () => {
    expect(eraFit('imperial', 'republic').fit).toBe('absent');
    expect(eraFit('first_order', 'empire').fit).toBe('absent');
  });

  it('marks survivors and secrets as rare rather than impossible', () => {
    expect(eraFit('imperial', 'jedi').fit).toBe('rare');      // hunted survivor
    expect(eraFit('clone_wars', 'sith').fit).toBe('rare');    // hidden
    expect(eraFit('new_republic', 'first_order').fit).toBe('rare');
  });

  it('leaves the natural pairings alone', () => {
    expect(eraFit('imperial', 'empire').fit).toBe('canon');
    expect(eraFit('old_republic', 'jedi').fit).toBe('canon');
    expect(eraFit('first_order', 'first_order').fit).toBe('canon');
    expect(eraFit('imperial', 'empire').reason).toBe('');
  });

  it('never blocks the player on missing data', () => {
    expect(eraFit('ere-inconnue', 'jedi').fit).toBe('canon');
    expect(eraFit('imperial', 'faction-inconnue').fit).toBe('canon');
  });

  it('every era keeps at least three plausible factions to pick from', () => {
    for (const era of ERAS) {
      const usable = FACTIONS.filter((f) => eraFit(era.id, f.id).fit !== 'absent');
      expect(usable.length, era.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('an absent verdict always explains itself', () => {
    for (const era of ERAS) {
      for (const f of FACTIONS) {
        const v = eraFit(era.id, f.id);
        if (v.fit !== 'canon') expect(v.reason.length, `${era.id}/${f.id}`).toBeGreaterThan(10);
      }
    }
  });
});

describe('the wizard has copy for everything it renders', () => {
  it('describes every faction and every role', () => {
    for (const f of FACTIONS) expect(FACTION_DESC[f.id], f.id).toBeTruthy();
    for (const r of ROLES) expect(ROLE_DESC[r.id], r.id).toBeTruthy();
  });

  it('labels every skill the profile displays', () => {
    const profile = deriveSkillProfile({ role: 'smuggler', faction: 'neutral' });
    for (const key of Object.keys(profile)) expect(SKILL_LABELS[key], key).toBeTruthy();
  });

  it('gives every role starting credits, so the wizard never shows a blank', () => {
    for (const r of ROLES) expect(FACTION_CREDITS[r.id], r.id).toBeGreaterThan(0);
  });

  it('keeps derived profiles inside the 1-5 range the bars are drawn against', () => {
    for (const r of ROLES) {
      for (const f of FACTIONS) {
        const profile = deriveSkillProfile({ role: r.id, faction: f.id });
        for (const [skill, value] of Object.entries(profile)) {
          expect(value, `${r.id}/${f.id}/${skill}`).toBeGreaterThanOrEqual(1);
          expect(value, `${r.id}/${f.id}/${skill}`).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});
