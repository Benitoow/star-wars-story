import { describe, it, expect } from 'vitest';
import { rollForChoice } from './dice';

describe('rollForChoice', () => {
  it('a natural 20 on an easy choice is a critical success', () => {
    const r = rollForChoice({ difficulty: 1 }, () => 0.999);
    expect(r.roll).toBe(20);
    expect(r.outcome).toBe('critical');
  });

  it('a natural 1 is a failure', () => {
    const r = rollForChoice({ difficulty: 3 }, () => 0);
    expect(r.roll).toBe(1);
    expect(r.outcome).toBe('failure');
  });

  it('a mid roll clears an easy DC but is only a partial on a heroic task', () => {
    expect(rollForChoice({ difficulty: 1 }, () => 0.5).outcome).toBe('success');
    expect(rollForChoice({ difficulty: 5 }, () => 0.5).outcome).toBe('partial');
  });

  it('difficulty 5 is hard but reachable with a strong roll (no longer near-unwinnable)', () => {
    expect(rollForChoice({ difficulty: 5 }, () => 0.9).outcome).toBe('success'); // roll 19 vs DC 17
  });

  it('always carries a hidden directive the player never sees', () => {
    expect(rollForChoice({ difficulty: 2 }, () => 0.5).directive).toMatch(/caché/i);
  });

  it('uses the selected attribute bonus instead of treating every character alike', () => {
    const untrained = rollForChoice({ difficulty: 4 }, 0, () => 0.5);
    const specialist = rollForChoice({ difficulty: 4 }, 4, () => 0.5);
    expect(specialist.outcome).not.toBe('failure');
    expect(specialist.bonus).toBe(4);
    expect(untrained.bonus).toBe(0);
  });
});
