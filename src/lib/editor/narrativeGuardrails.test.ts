import { describe, expect, it } from 'vitest';
import type { StoryChapter, WorldState } from '$lib/ai/storyEngine';
import { enforceTransitionChoiceQuality, sanitizeNarrativeTextForDisplay, splitNarrativeParagraphs } from './narrativeGuardrails';

describe('sanitizeNarrativeTextForDisplay', () => {
  it('strips inline state directives from narrative prose', () => {
    const input = "Tu avances vers le hangar. credits:+200. hp:-10. Les moteurs hurlent.";
    const sanitized = sanitizeNarrativeTextForDisplay(input);

    expect(sanitized).not.toContain('credits:+200');
    expect(sanitized).not.toContain('hp:-10');
    expect(sanitized).toContain('Tu avances vers le hangar.');
    expect(sanitized).toContain('Les moteurs hurlent.');
  });

  it('separates quoted dialogue into distinct paragraphs', () => {
    const input = 'Lira s\'approche, puis dit: "Reste derrière moi." Le vent se lève. — On bouge maintenant.';
    const sanitized = sanitizeNarrativeTextForDisplay(input);
    const paragraphs = splitNarrativeParagraphs(sanitized).map(item => `${item.kind}:${item.text}`);

    expect(paragraphs.some(item => item.includes('dialogue:— Reste derrière moi.'))).toBe(true);
    expect(paragraphs.some(item => item.includes('dialogue:— On bouge maintenant.'))).toBe(true);
    expect(paragraphs.some(item => item.includes('prose:Le vent se lève.'))).toBe(true);
  });
});

describe('enforceTransitionChoiceQuality', () => {
  const baseWorldState: WorldState = {
    player: {
      hp: 85,
      credits: 1000,
      location: 'Hangar discret',
      date: '19 AVBY, Jour 1',
      injuries: [],
      inventory: []
    },
    npcs: [{ name: 'Lira Voss', affinity: 40, status: 'ally', alive: true }],
    factions: { rebel_alliance: 50 },
    chronology: []
  };

  it('replaces passive time-pass choice in urgent action scenes', () => {
    const chapter: StoryChapter = {
      chapter_title: 'Pacte dans la poussière',
      chapter_number: 2,
      section_type: 'action',
      narrative: {
        context: '',
        action: "Un vrombissement lointain: chasseurs TIE. La mission bascule déjà vers le chaos.",
        dialogue: '',
        reflection: '',
        atmosphere: 'tense'
      },
      choices: [
        {
          text: 'A. Profiter du trajet pour observer, planifier la suite et laisser le temps avancer.',
          attribute: 'survival',
          difficulty: 1,
          faction_impact: {}
        },
        {
          text: '2. Inspecter le vaisseau avant embarquement.',
          attribute: 'survival',
          difficulty: 2,
          faction_impact: {}
        },
        {
          text: '3. Questionner les Rodiens sur le plan détaillé.',
          attribute: 'diplomacy',
          difficulty: 2,
          faction_impact: {}
        }
      ],
      memory_updates: {
        relations: [],
        places: [],
        injuries: [],
        resources: [],
        notes: []
      },
      scene_description: 'test',
      user_edits_applied: null
    };

    const adjusted = enforceTransitionChoiceQuality(chapter, baseWorldState);
    const allTexts = adjusted.choices.map(choice => choice.text.toLowerCase());

    expect(allTexts.some(text => text.includes('laisser le temps avancer'))).toBe(false);
    expect(adjusted.choices.some(choice => /^\d+[.)]/.test(choice.text))).toBe(false);
  });
});
