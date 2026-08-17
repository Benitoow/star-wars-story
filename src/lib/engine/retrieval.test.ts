import { describe, it, expect } from 'vitest';
import {
  tokenize,
  cosineSimilarity,
  scoreFacts,
  selectTopFacts,
  mergeScores,
  buildMemoryQuery
} from './retrieval';
import type { MemoryFact } from './types';

function fact(text: string, category: MemoryFact['category'], turn: number): MemoryFact {
  return { text, category, turn };
}

const facts: MemoryFact[] = [
  fact('Vela est une contrebandière qui cherche une cargaison de spice', 'relations', 3),
  fact('Le hangar 7 se trouve sous le palais de Mos Eisley', 'places', 5),
  fact('L\'armée impériale a été décimée à la bataille de Chandrila', 'notes', 2),
  fact('Le sabre laser de Kael est resté dans la cantina', 'notes', 12),
  fact('La garnison impériale évacue le secteur', 'notes', 14)
];

describe('tokenize', () => {
  it('folds accents, lowercases and drops very short tokens', () => {
    expect(tokenize('Évacué la CANTINA !')).toContain('evacue');
    expect(tokenize('Évacué la CANTINA !')).not.toContain('la');
    expect(tokenize('Le hangar-7')).toContain('hangar');
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors and 0 for orthogonal ones', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
});

describe('scoreFacts (lexical retrieval)', () => {
  it('ranks a fact sharing query keywords above an unrelated one', () => {
    const scored = scoreFacts(facts, 'la garnison impériale évacue', { currentTurn: 15 });
    const best = [...scored].sort((a, b) => b.score - a.score)[0];
    expect(best.fact.text).toContain('garnison');
  });

  it('breaks ties with recency when facts are equally relevant', () => {
    const two: MemoryFact[] = [
      fact('Une relique sith brille dans le temple', 'notes', 2),
      fact('Une relique sith brille dans le temple', 'notes', 10)
    ];
    const scored = scoreFacts(two, 'relique sith temple', { currentTurn: 12 });
    const best = [...scored].sort((a, b) => b.score - a.score)[0];
    expect(best.fact.turn).toBe(10);
  });

  it('boosts facts from the current scene window regardless of lexical match', () => {
    const recent: MemoryFact[] = [fact('La porte du bunker est verrouillée', 'notes', 13)];
    const selected = selectTopFacts([...facts, ...recent], 'spice cargaison', {
      currentTurn: 14,
      topK: 3,
      alwaysIncludeRecent: 2
    });
    expect(selected.map((f) => f.text)).toContain('La porte du bunker est verrouillée');
  });
});

describe('selectTopFacts', () => {
  it('returns at most topK facts, best first, without duplicates', () => {
    const selected = selectTopFacts(facts, 'impériale évacue secteur', { currentTurn: 15, topK: 2 });
    expect(selected.length).toBeLessThanOrEqual(2);
    expect(new Set(selected.map((f) => f.text)).size).toBe(selected.length);
    expect(selected[0].text).toContain('garnison');
  });
});

describe('mergeScores', () => {
  it('combines lexical and semantic scores into one ranking', () => {
    const merged = mergeScores(
      [
        { fact: facts[4], score: 0.9 },
        { fact: facts[0], score: 0.5 }
      ],
      [
        { fact: facts[0], score: 0.8 },
        { fact: facts[4], score: 0.2 }
      ]
    );
    expect(merged[0].fact.text).toContain('contrebandière'); // strong in both
  });
});

describe('buildMemoryQuery', () => {
  it('joins the available context signals and drops empties', () => {
    expect(buildMemoryQuery(['action', '', undefined, 'lieu'])).toBe('action lieu');
  });
});
