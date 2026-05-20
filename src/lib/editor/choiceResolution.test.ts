import { describe, expect, it } from 'vitest';
import type { PlayerState, StoryChoice } from '$lib/ai/storyEngine';
import {
  buildOutcomeDirective,
  difficultyToDc,
  resolveChoiceOutcome,
  roleAttributeModifier,
  situationalDifficultyPenalty
} from './choiceResolution';

function makeChoice(partial: Partial<StoryChoice> = {}): StoryChoice {
  return { text: 'Foncer dans le tas', attribute: 'combat', difficulty: 3, faction_impact: {}, ...partial };
}

function makePlayer(partial: Partial<PlayerState> = {}): PlayerState {
  return {
    hp: 100,
    credits: 1000,
    location: 'Hangar',
    date: 'Jour 1',
    injuries: [],
    inventory: [],
    ...partial
  };
}

// rng that forces a specific d20 roll (1..20)
function rngForRoll(roll: number): () => number {
  return () => (roll - 1) / 20 + 0.0001;
}

describe('difficultyToDc', () => {
  it('maps difficulty 1..5 to increasing DCs and clamps out-of-range', () => {
    expect(difficultyToDc(1)).toBe(8);
    expect(difficultyToDc(3)).toBe(12);
    expect(difficultyToDc(5)).toBe(18);
    expect(difficultyToDc(6)).toBe(21);
    expect(difficultyToDc(0)).toBe(8);
    expect(difficultyToDc(99)).toBe(21);
  });
});

describe('roleAttributeModifier', () => {
  it('returns the per-role attribute bonus, 0 for unknown role/attribute', () => {
    expect(roleAttributeModifier('jedi_knight', 'force')).toBe(4);
    expect(roleAttributeModifier('smuggler', 'stealth')).toBe(3);
    expect(roleAttributeModifier('jedi_knight', 'tech')).toBe(0);
    expect(roleAttributeModifier('unknown_role', 'combat')).toBe(0);
  });
});

describe('situationalDifficultyPenalty', () => {
  it('adds +2 for combat/force when HP is critical', () => {
    const player = makePlayer({ hp: 10 });
    expect(situationalDifficultyPenalty(makeChoice({ attribute: 'combat' }), player)).toBe(2);
    expect(situationalDifficultyPenalty(makeChoice({ attribute: 'force' }), player)).toBe(2);
    expect(situationalDifficultyPenalty(makeChoice({ attribute: 'diplomacy' }), player)).toBe(0);
  });

  it('adds +1 for combat/stealth with a severe injury', () => {
    const player = makePlayer({ injuries: [{ description: 'jambe brisée', severity: 'severe' }] });
    expect(situationalDifficultyPenalty(makeChoice({ attribute: 'stealth' }), player)).toBe(1);
    expect(situationalDifficultyPenalty(makeChoice({ attribute: 'tech' }), player)).toBe(0);
  });

  it('returns 0 when healthy', () => {
    expect(situationalDifficultyPenalty(makeChoice(), makePlayer())).toBe(0);
  });
});

describe('resolveChoiceOutcome', () => {
  it('treats a natural 20 as success regardless of difficulty', () => {
    const result = resolveChoiceOutcome(
      makeChoice({ difficulty: 5, attribute: 'tech' }),
      { role: 'unknown_role', situationPenalty: 2 },
      rngForRoll(20)
    );
    expect(result.verdict).toBe('success');
  });

  it('treats a natural 1 as failure regardless of bonuses', () => {
    const result = resolveChoiceOutcome(
      makeChoice({ difficulty: 1, attribute: 'force' }),
      { role: 'jedi_master', situationPenalty: 0 },
      rngForRoll(1)
    );
    expect(result.verdict).toBe('failure');
  });

  it('succeeds when roll + role modifier clears the DC', () => {
    // difficulty 3 → DC 12, combat +3, roll 10 → total 13 ≥ 12
    const result = resolveChoiceOutcome(
      makeChoice({ difficulty: 3, attribute: 'combat' }),
      { role: 'jedi_knight', situationPenalty: 0 },
      rngForRoll(10)
    );
    expect(result.verdict).toBe('success');
  });

  it('returns partial when within 4 below the DC', () => {
    // difficulty 3 → DC 12, no modifier, roll 10 → total 10 (≥ 8) → partial
    const result = resolveChoiceOutcome(
      makeChoice({ difficulty: 3, attribute: 'combat' }),
      { role: 'unknown_role', situationPenalty: 0 },
      rngForRoll(10)
    );
    expect(result.verdict).toBe('partial');
  });

  it('fails when far below the DC', () => {
    // difficulty 3 → DC 12, no modifier, roll 5 → total 5 (< 8) → failure
    const result = resolveChoiceOutcome(
      makeChoice({ difficulty: 3, attribute: 'combat' }),
      { role: 'unknown_role', situationPenalty: 0 },
      rngForRoll(5)
    );
    expect(result.verdict).toBe('failure');
  });

  it('raises the effective difficulty with a situational penalty', () => {
    // difficulty 3 + penalty 2 → effective 5 → DC 18. roll 14, no mod → total 14 (≥ 14) → partial
    const partial = resolveChoiceOutcome(
      makeChoice({ difficulty: 3, attribute: 'combat' }),
      { role: 'unknown_role', situationPenalty: 2 },
      rngForRoll(14)
    );
    expect(partial.verdict).toBe('partial');

    // same but roll 13 → total 13 (< 14) → failure
    const failure = resolveChoiceOutcome(
      makeChoice({ difficulty: 3, attribute: 'combat' }),
      { role: 'unknown_role', situationPenalty: 2 },
      rngForRoll(13)
    );
    expect(failure.verdict).toBe('failure');
  });

  it('is deterministic for a given rng (replay safety)', () => {
    const choice = makeChoice({ difficulty: 4, attribute: 'stealth' });
    const ctx = { role: 'smuggler', situationPenalty: 0 };
    const first = resolveChoiceOutcome(choice, ctx, rngForRoll(11));
    const second = resolveChoiceOutcome(choice, ctx, rngForRoll(11));
    expect(first.verdict).toBe(second.verdict);
  });
});

describe('buildOutcomeDirective', () => {
  it('returns distinct directives per verdict', () => {
    const success = buildOutcomeDirective('success');
    const partial = buildOutcomeDirective('partial');
    const failure = buildOutcomeDirective('failure');

    expect(success).toContain('RÉUSSIT');
    expect(partial).toContain('PARTIELLE');
    expect(failure).toContain('ÉCHEC');
    expect(new Set([success, partial, failure]).size).toBe(3);
  });
});
