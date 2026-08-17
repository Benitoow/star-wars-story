import { describe, it, expect, vi, afterEach } from 'vitest';
import { planConsolidation, consolidateInto, runConsolidation } from './consolidate';
import type { MemoryFact, StoryProviderConfig } from './types';

function fact(text: string, category: MemoryFact['category'], turn: number): MemoryFact {
  return { text, category, turn };
}

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };

afterEach(() => vi.unstubAllGlobals());

describe('planConsolidation', () => {
  const manyOldNotes: MemoryFact[] = Array.from({ length: 6 }, (_, i) => fact(`Vieux fait ${i}`, 'notes', 2));

  it('returns null before the consolidation cadence or with nothing old enough', () => {
    expect(planConsolidation(manyOldNotes, 5, { everyTurn: 10 })).toBeNull();
    expect(planConsolidation([fact('Récent', 'notes', 9)], 10, { everyTurn: 10, olderThan: 8 })).toBeNull();
  });

  it('isolates old notes past the age threshold and keeps the rest', () => {
    const mixed = [...manyOldNotes, fact('Fait récent', 'notes', 9), fact('Vela alliée', 'relations', 3)];
    const plan = planConsolidation(mixed, 10, { everyTurn: 10, olderThan: 8, minOldFacts: 4 });
    expect(plan).not.toBeNull();
    expect(plan!.toConsolidate.length).toBe(6);
    expect(plan!.remaining.some((f) => f.text === 'Fait récent')).toBe(true);
    expect(plan!.remaining.some((f) => f.text === 'Vela alliée')).toBe(true); // relations never consolidated
  });

  it('caps the consolidated batch', () => {
    const plan = planConsolidation(manyOldNotes, 10, { everyTurn: 10, olderThan: 8, maxBatch: 4 });
    expect(plan!.toConsolidate.length).toBe(4);
  });
});

describe('consolidateInto', () => {
  it('replaces the consolidated facts with a dated synthesis', () => {
    const old = fact('Vieux fait 1', 'notes', 2);
    const kept = fact('Vela alliée', 'relations', 4);
    const next = consolidateInto([old, kept], [old], 'Les vieux faits ont été résumés.', 10);
    expect(next).toHaveLength(2);
    expect(next.some((f) => f.text === 'Les vieux faits ont été résumés.')).toBe(true);
    expect(next.some((f) => f.text === 'Vieux fait 1')).toBe(false);
  });
});

describe('runConsolidation', () => {
  it('summarizes old facts through the model and applies the synthesis', async () => {
    const old: MemoryFact[] = Array.from({ length: 5 }, (_, i) => fact(`Indice ${i} sur Coruscant`, 'notes', 1));
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"summary":"La piste mène à Coruscant."}' } }] }),
      text: async () => ''
    });
    vi.stubGlobal('fetch', mock);

    const next = await runConsolidation(old, 10, provider);
    expect(next.some((f) => f.text === 'La piste mène à Coruscant.')).toBe(true);
    expect(next.some((f) => f.text === old[0].text)).toBe(false);
  });

  it('leaves the memory untouched when the model call fails', async () => {
    const old = fact('Fait précieux', 'notes', 1);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau coupé')));

    const next = await runConsolidation([old], 10, provider);
    expect(next).toEqual([old]);
  });
});
