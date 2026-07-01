import { describe, it, expect } from 'vitest';
import {
  foldArchive,
  fromLegacyFacts,
  memoryFactLines,
  mergeMemoryFacts,
  renderMemoryBlock,
  sanitizeMemory
} from './memory';
import type { MemoryFact, StoryChapter } from './types';

function chapterWith(n: number, updates: Partial<StoryChapter['memory_updates']>): StoryChapter {
  return {
    chapter_title: `Chap ${n}`,
    chapter_number: n,
    section_type: 'action',
    narrative: { action: 'x', dialogue: '', reflection: '', atmosphere: 'tense' },
    choices: [],
    memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [], ...updates }
  };
}

describe('mergeMemoryFacts — categorized, turn-stamped memory', () => {
  it('files each update under its category with the chapter turn', () => {
    const facts = mergeMemoryFacts([], chapterWith(3, { relations: ['Vela fait confiance au héros'], places: ['Cantina de Mos Espa'] }));
    expect(facts).toContainEqual({ text: 'Vela fait confiance au héros', category: 'relations', turn: 3 });
    expect(facts).toContainEqual({ text: 'Cantina de Mos Espa', category: 'places', turn: 3 });
  });

  it('re-stating a known fact refreshes its turn instead of duplicating', () => {
    const first = mergeMemoryFacts([], chapterWith(2, { notes: ['Le marché est sans soldats'] }));
    const again = mergeMemoryFacts(first, chapterWith(7, { notes: ['le marche est sans soldats'] })); // accent/case-folded match
    expect(again.filter((f) => f.category === 'notes')).toHaveLength(1);
    expect(again[0].turn).toBe(7);
  });

  it('caps per category — a flood of notes cannot evict relations', () => {
    let facts: MemoryFact[] = mergeMemoryFacts([], chapterWith(1, { relations: ['Kael est un allié fidèle'] }));
    for (let turn = 2; turn <= 30; turn += 1) {
      facts = mergeMemoryFacts(facts, chapterWith(turn, { notes: [`Note du tour ${turn}`] }));
    }
    expect(facts.filter((f) => f.category === 'notes').length).toBeLessThanOrEqual(16);
    // The single relation survives 29 turns of note spam.
    expect(facts.some((f) => f.category === 'relations' && f.text.includes('Kael'))).toBe(true);
  });

  it('evicts the OLDEST facts of an overflowing category', () => {
    let facts: MemoryFact[] = [];
    for (let turn = 1; turn <= 20; turn += 1) {
      facts = mergeMemoryFacts(facts, chapterWith(turn, { notes: [`Note ${turn}`] }));
    }
    const notes = facts.filter((f) => f.category === 'notes');
    expect(notes.some((f) => f.text === 'Note 1')).toBe(false);
    expect(notes.some((f) => f.text === 'Note 20')).toBe(true);
  });
});

describe('renderMemoryBlock', () => {
  it('groups facts by category with turn stamps', () => {
    const block = renderMemoryBlock([
      { text: 'Vela est une alliée', category: 'relations', turn: 4 },
      { text: 'Le hangar 12 est piégé', category: 'places', turn: 6 }
    ]);
    expect(block).toContain('MÉMOIRE NARRATIVE');
    expect(block).toContain('Relations :');
    expect(block).toContain('(T4) Vela est une alliée');
    expect(block).toContain('Lieux :');
    expect(block).toContain('(T6) Le hangar 12 est piégé');
  });

  it('is empty with no facts', () => {
    expect(renderMemoryBlock([])).toBe('');
  });
});

describe('memoryFactLines', () => {
  it('returns the most recent facts as flat lines', () => {
    const facts: MemoryFact[] = [
      { text: 'ancien', category: 'notes', turn: 1 },
      { text: 'récent', category: 'notes', turn: 9 }
    ];
    expect(memoryFactLines(facts, 1)).toEqual(['récent']);
  });
});

describe('legacy migration & sanitization', () => {
  it('fromLegacyFacts wraps flat strings as notes', () => {
    expect(fromLegacyFacts(['un fait', ''])).toEqual([{ text: 'un fait', category: 'notes', turn: 0 }]);
  });

  it('sanitizeMemory repairs malformed persisted entries', () => {
    const dirty = [
      { text: 'ok', category: 'places', turn: 3 },
      { text: 'catégorie inconnue', category: 'weird', turn: -2 },
      { text: '', category: 'notes', turn: 1 },
      null,
      'pas un objet'
    ];
    expect(sanitizeMemory(dirty)).toEqual([
      { text: 'ok', category: 'places', turn: 3 },
      { text: 'catégorie inconnue', category: 'notes', turn: 0 }
    ]);
    expect(sanitizeMemory(undefined)).toEqual([]);
    expect(sanitizeMemory('nope')).toEqual([]);
  });
});

describe('foldArchive — hierarchical campaign archive', () => {
  const line = (n: number) => `Tour ${n} : Titre ${n} (action) — De la prose détaillée du tour ${n}.`;

  it('returns short archives untouched', () => {
    const archive = [line(1), line(2)];
    expect(foldArchive(archive)).toEqual(archive);
  });

  it('folds old lines into title-only arcs and keeps the newest detailed', () => {
    const archive = Array.from({ length: 50 }, (_, i) => line(i + 1));
    const folded = foldArchive(archive, 30);
    expect(folded.length).toBeLessThan(archive.length);
    // The 20 oldest turns fold into arcs of 12.
    expect(folded[0]).toMatch(/^Tours 1–12 : /);
    expect(folded[0]).toContain('Titre 1');
    expect(folded[0]).not.toContain('prose détaillée');
    expect(folded[1]).toMatch(/^Tours 13–20 : /);
    // The newest lines survive verbatim.
    expect(folded.at(-1)).toBe(line(50));
    expect(folded[2]).toBe(line(21));
  });
});
