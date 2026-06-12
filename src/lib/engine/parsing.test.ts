import { describe, it, expect } from 'vitest';
import { parseJsonSafely, sanitizeProse, parseStoryResponse } from './parsing';

describe('parseJsonSafely', () => {
  it('extracts JSON from a ```json fenced block', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(parseJsonSafely(raw)).toEqual({ a: 1 });
  });
  it('extracts the JSON object embedded in surrounding prose', () => {
    const raw = 'Voici la scène : {"chapter_title":"X","narrative":{"action":"Bla"}} — fin.';
    expect(parseJsonSafely(raw)?.chapter_title).toBe('X');
  });
  it('returns null for non-JSON', () => {
    expect(parseJsonSafely('juste du texte')).toBeNull();
  });
});

describe('sanitizeProse — dialogue dash ban', () => {
  it('strips a leading em-dash before a speaker', () => {
    expect(sanitizeProse('— Leia : Bonjour.')).toBe('Leia : Bonjour.');
  });
  it('strips a leading hyphen before a speaker', () => {
    expect(sanitizeProse('- Han : On file.')).toBe('Han : On file.');
  });
  it('strips a dash introducing speech after the colon', () => {
    expect(sanitizeProse('Leia : — Je comprends.')).toBe('Leia : Je comprends.');
  });
  it('keeps a negative number intact (does not eat the minus)', () => {
    expect(sanitizeProse('-15 crédits perdus')).toContain('-15');
  });
  it('removes markdown headers and choice blocks', () => {
    const raw = '## Titre\nLe vaisseau décolle.\nQue faites-vous ?\n- Fuir\n- Rester';
    const out = sanitizeProse(raw);
    expect(out).toContain('Le vaisseau décolle.');
    expect(out).not.toContain('Que faites-vous');
    expect(out).not.toContain('Fuir');
  });
});

describe('parseStoryResponse', () => {
  const full = JSON.stringify({
    chapter_title: 'Fuite à Mos Eisley',
    chapter_number: 3,
    section_type: 'action',
    narrative: { action: 'Les blasters crépitent.', dialogue: '— Han : Cours !', reflection: '', atmosphere: 'tense' },
    choices: [
      { text: 'Tirer sur le garde', attribute: 'combat', difficulty: 3 },
      { text: 'Tirer sur le garde', attribute: 'combat', difficulty: 3 }, // dup
      { text: 'Négocier', attribute: 'diplomacy', difficulty: 2 }
    ],
    state_update: { hp: -15, credits: -50, location: 'Mos Eisley', factions: { empire: -80 } }
  });

  it('parses a complete chapter and sanitizes the leaked dash in dialogue', () => {
    const c = parseStoryResponse(full, 3);
    expect(c.chapter_title).toBe('Fuite à Mos Eisley');
    expect(c.chapter_number).toBe(3);
    expect(c.narrative.dialogue).toBe('Han : Cours !');
  });

  it('dedupes choices and infers/keeps attributes', () => {
    const c = parseStoryResponse(full, 3);
    expect(c.choices).toHaveLength(2);
    expect(c.choices[0].attribute).toBe('combat');
  });

  it('coerces and clamps the state_update (faction delta capped at ±50)', () => {
    const c = parseStoryResponse(full, 3);
    expect(c.state_update?.hp).toBe(-15);
    expect(c.state_update?.factions?.empire).toBe(-50);
  });

  it('falls back to the turn number when chapter_number is missing', () => {
    const c = parseStoryResponse('{"narrative":{"action":"Bla"}}', 7);
    expect(c.chapter_number).toBe(7);
  });

  it('rejects a generic "Tour N" title and derives one instead', () => {
    const c = parseStoryResponse('{"chapter_title":"Tour 3","narrative":{"action":"Le sable brûle sous le double soleil."}}', 3);
    expect(c.chapter_title).not.toMatch(/^Tour 3$/);
    expect(c.chapter_title.length).toBeGreaterThan(0);
  });

  it('provides default choices when none are supplied', () => {
    const c = parseStoryResponse('{"narrative":{"action":"Bla"}}', 1);
    expect(c.choices.length).toBeGreaterThanOrEqual(3);
  });

  it('uses raw text as the action when the model returns no JSON', () => {
    const c = parseStoryResponse('Le hangar est plongé dans le noir.', 1);
    expect(c.narrative.action).toContain('hangar');
  });

  it('extracts npcs_present (cleaned, capped), absent when not emitted', () => {
    const withNpcs = parseStoryResponse(
      '{"narrative":{"action":"Bla"},"npcs_present":["Vela", "  ", "Dack Ralter", 42]}',
      1
    );
    expect(withNpcs.npcs_present).toEqual(['Vela', 'Dack Ralter', '42']);
    const without = parseStoryResponse('{"narrative":{"action":"Bla"}}', 1);
    expect(without.npcs_present).toBeUndefined();
  });

  it('clips an over-long memory note at a word boundary (no mid-word cut)', () => {
    const long = 'A survécu à l effondrement du temple de Lothal en y laissant sa cheville gauche mais a récupéré un artefact ancien dont la puissance brute dépasse tout entendement et menace de le consumer entièrement avant la fin';
    const c = parseStoryResponse(`{"narrative":{"action":"Bla"},"memory_updates":{"notes":["${long}"]}}`, 1);
    const note = c.memory_updates.notes[0];
    expect(note.endsWith('…')).toBe(true);
    expect(note.length).toBeLessThanOrEqual(181);
    expect(long.startsWith(note.slice(0, -1))).toBe(true); // clean prefix, not mangled
  });
});
