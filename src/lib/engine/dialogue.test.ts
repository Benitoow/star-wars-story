import { describe, it, expect } from 'vitest';
import { parseDialogue, looksLikeSpeakerLine, isSpeakerName, speakersIn, protagonistMatcher } from './dialogue';

describe('speaker detection', () => {
  it('accepts real character names', () => {
    for (const n of ['Kael', 'Jyn Ors', 'Capitaine Rann', 'Dark Vador', "L'Inconnu", 'R2-D2', 'Obi-Wan Kenobi']) {
      expect(isSpeakerName(n), n).toBe(true);
    }
  });

  it('rejects the narrative labels models keep emitting', () => {
    // These all used to be filed as dialogue by the bare regex.
    for (const line of [
      'Attention : le blaster est vide.',
      'Note : la patrouille approche.',
      'Objectif : rejoindre le hangar.',
      'Résumé : la cellule est démantelée.'
    ]) {
      expect(looksLikeSpeakerLine(line), line).toBe(false);
    }
  });

  it('rejects sentences and dates masquerading as speakers', () => {
    expect(looksLikeSpeakerLine('19 AVBY : la proclamation impériale.')).toBe(false);
    expect(looksLikeSpeakerLine('il se retourne lentement : personne.')).toBe(false);
    expect(looksLikeSpeakerLine('Le vieux contrebandier du secteur sept : il hésite.')).toBe(false);
  });

  it('still accepts a well-formed line of speech', () => {
    expect(looksLikeSpeakerLine('Jyn Ors : On ne reste pas ici.')).toBe(true);
    expect(looksLikeSpeakerLine('Kael : Trop tard.')).toBe(true);
  });
});

describe('parseDialogue', () => {
  it('attributes each line to its speaker', () => {
    const lines = parseDialogue('Kael : On y va.\nJyn Ors : Pas encore.');
    expect(lines).toEqual([
      { speaker: 'Kael', text: 'On y va.', continuation: false },
      { speaker: 'Jyn Ors', text: 'Pas encore.', continuation: false }
    ]);
  });

  it('keeps a spilled second line with the speaker who was talking', () => {
    // The old renderer dropped the attribution and printed an orphan line.
    const lines = parseDialogue('Jyn Ors : On ne reste pas ici.\nIls ont bouclé le secteur.\nKael : Trop tard.');
    expect(lines[1]).toEqual({ speaker: 'Jyn Ors', text: 'Ils ont bouclé le secteur.', continuation: true });
    expect(lines[2].speaker).toBe('Kael');
  });

  it('leaves a leading unattributed line unattributed rather than guessing', () => {
    const lines = parseDialogue('Un silence.\nKael : On y va.');
    expect(lines[0]).toEqual({ speaker: null, text: 'Un silence.', continuation: false });
  });

  it('does not split a reply that merely contains a colon', () => {
    const lines = parseDialogue('Kael : Écoute-moi : on part maintenant.');
    expect(lines).toHaveLength(1);
    expect(lines[0].speaker).toBe('Kael');
    expect(lines[0].text).toBe('Écoute-moi : on part maintenant.');
  });

  it('handles empty and blank input', () => {
    expect(parseDialogue('')).toEqual([]);
    expect(parseDialogue('\n\n  \n')).toEqual([]);
  });

  it('lists distinct speakers in order of first appearance', () => {
    expect(speakersIn('Kael : A.\nJyn : B.\nsuite de Jyn.\nKael : C.')).toEqual(['Kael', 'Jyn']);
  });
});

describe('protagonistMatcher', () => {
  it('resolves the first name to the protagonist — writers rarely use the full one', () => {
    const isMe = protagonistMatcher('Kael Voss');
    expect(isMe('Kael')).toBe(true);
    expect(isMe('Voss')).toBe(true);
    expect(isMe('Kael Voss')).toBe(true);
    expect(isMe('Jyn Ors')).toBe(false);
  });

  it('is accent- and case-insensitive on both sides', () => {
    const isMe = protagonistMatcher('Léa Ordo');
    expect(isMe('LEA')).toBe(true);
    expect(isMe('léa')).toBe(true);
    expect(isMe('Lea')).toBe(true);
  });

  it('never claims a name an NPC already answers to', () => {
    // An ally called Kael must keep their own lines.
    const isMe = protagonistMatcher('Kael Voss', ['Kael']);
    expect(isMe('Kael')).toBe(false);
    expect(isMe('Voss')).toBe(true);
  });

  it('matches nothing when there is no name', () => {
    const isMe = protagonistMatcher('');
    expect(isMe('Kael')).toBe(false);
    expect(isMe('')).toBe(false);
  });
});
