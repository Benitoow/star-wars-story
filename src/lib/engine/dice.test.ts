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

  it('a mid roll clears an easy DC but misses a hard one', () => {
    expect(rollForChoice({ difficulty: 1 }, () => 0.5).outcome).toBe('success'); // roll 11 vs DC 9
    expect(rollForChoice({ difficulty: 5 }, () => 0.5).outcome).toBe('failure'); // roll 11 vs DC 21
  });

  it('always carries a hidden directive the player never sees', () => {
    expect(rollForChoice({ difficulty: 2 }, () => 0.5).directive).toMatch(/caché/i);
  });
});
