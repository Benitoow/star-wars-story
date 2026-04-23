import { describe, expect, it } from 'vitest';
import type { StoryChapter, WorldState } from '$lib/ai/storyEngine';
import { coerceStateUpdate, sanitizeNarrativeText } from '$lib/ai/storyEngine/parsing';
import {
  enforceTransitionChoiceQuality,
  planDialogueDisplay,
  sanitizeNarrativeTextForDisplay,
  splitNarrativeParagraphs
} from './narrativeGuardrails';

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

  it('detects speaker-labelled dialogue lines', () => {
    const paragraphs = splitNarrativeParagraphs('Grisk : Ils arrivent par la passerelle nord.');

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toEqual({
      kind: 'dialogue',
      text: '— Grisk : Ils arrivent par la passerelle nord.'
    });
  });

  it('keeps prose that appears after a block of choices', () => {
    const input = `La passerelle vibre sous les bottes.

Choix :
1. Forcer la porte du sas.
2. Appeler Vex sur le comlink.

La cloison explose soudain et la fumée envahit le couloir.`;

    const sanitized = sanitizeNarrativeTextForDisplay(input);

    expect(sanitized).toContain('La passerelle vibre sous les bottes.');
    expect(sanitized).toContain('La cloison explose soudain et la fumée envahit le couloir.');
    expect(sanitized).not.toContain('Forcer la porte du sas');
    expect(sanitized).not.toContain('Appeler Vex sur le comlink');
  });
});

describe('sanitizeNarrativeText', () => {
  it('keeps prose that resumes after enumerated choices', () => {
    const input = `Les alarmes se déclenchent.

Que faites-vous ?
A. Pirater la porte blindée.
B. Courir vers le hangar.

Une silhouette encapuchonnée apparaît ensuite dans la fumée.`;

    const sanitized = sanitizeNarrativeText(input, 600);

    expect(sanitized).toContain('Les alarmes se déclenchent.');
    expect(sanitized).toContain('Une silhouette encapuchonnée apparaît ensuite dans la fumée.');
    expect(sanitized).not.toContain('Pirater la porte blindée');
    expect(sanitized).not.toContain('Courir vers le hangar');
  });
});

describe('coerceStateUpdate', () => {
  it('synchronizes dead status and alive flag in npc updates', () => {
    const update = coerceStateUpdate({
      npcs: [
        { name: 'Lira Voss', status: 'dead', alive: true },
        { name: 'Grisk', status: 'ally', alive: false }
      ]
    });

    expect(update?.npcs).toEqual([
      { name: 'Lira Voss', status: 'dead', alive: false },
      { name: 'Grisk', status: 'dead', alive: false }
    ]);
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

describe('planDialogueDisplay', () => {
  it('interleaves dialogue into action flow for non-dialogue scenes and removes duplicates', () => {
    const chapter: StoryChapter = {
      chapter_title: 'Sous le feu croisé',
      chapter_number: 6,
      section_type: 'action',
      narrative: {
        context: '',
        action: `Le hangar tremble sous les tirs.
      Tu ajustes ton blaster.
      — Vex : On bouge.
      Les portes commencent à céder.`,
        dialogue: `— Vex : On bouge.
      Lira : Couvre la sortie.
      Grisk : J'ouvre un passage.`,
        reflection: '',
        atmosphere: 'tense'
      },
      choices: [],
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

    const display = planDialogueDisplay(chapter);
    const actionTexts = display.actionParagraphs.map(paragraph => paragraph.text);
    const vexLineCount = actionTexts.filter(text => /vex\s*:\s*on bouge/i.test(text)).length;
    const liraLineIndex = actionTexts.findIndex(text => /lira\s*:\s*couvre la sortie/i.test(text));
    const griskLineIndex = actionTexts.findIndex(text => /grisk\s*:\s*j'ouvre un passage/i.test(text));
    const lateActionIndex = actionTexts.findIndex(text => /portes commencent à céder/i.test(text));

    expect(display.dialogueParagraphs).toHaveLength(0);
    expect(liraLineIndex).toBeGreaterThanOrEqual(0);
    expect(griskLineIndex).toBeGreaterThanOrEqual(0);
    expect(liraLineIndex).toBeLessThan(lateActionIndex);
    expect(griskLineIndex).toBeLessThan(lateActionIndex);
    expect(vexLineCount).toBe(1);
  });

  it('keeps standalone dialogue block for dialogue scenes', () => {
    const chapter: StoryChapter = {
      chapter_title: 'Interrogatoire discret',
      chapter_number: 3,
      section_type: 'dialogue',
      narrative: {
        context: '',
        action: 'La pluie tambourine sur le toit de tôle.',
        dialogue: `— Lira : Écoute-moi.
      — Vex : On n'a pas beaucoup de temps.`,
        reflection: '',
        atmosphere: 'tense'
      },
      choices: [],
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

    const display = planDialogueDisplay(chapter);

    expect(display.actionParagraphs.length).toBeGreaterThan(0);
    expect(display.dialogueParagraphs.length).toBeGreaterThan(0);
  });
});
