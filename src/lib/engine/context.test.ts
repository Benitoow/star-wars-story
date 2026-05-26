import { describe, it, expect } from 'vitest';
import { buildNarrativeContext } from './context';
import type { StoryChapter } from './types';

function ch(n: number, text: string): StoryChapter {
  return {
    chapter_title: `T${n}`,
    chapter_number: n,
    section_type: 'action',
    narrative: { action: text, dialogue: '', reflection: '', atmosphere: 'tense' },
    choices: [],
    memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] }
  };
}

const history = [ch(1, 'Ouverture sur Tatooine.'), ch(2, 'Fuite dans la cantina.'), ch(3, 'Duel au spatioport.')];
const actions = ['Je fuis', 'Je me bats']; // action[0] → ch2, action[1] → ch3

describe('buildNarrativeContext', () => {
  it('keeps the whole history raw under a generous budget (no archive)', () => {
    const { transcript, archive } = buildNarrativeContext(history, actions, 100_000);
    expect(archive).toHaveLength(0);
    expect(transcript).toHaveLength(5); // assistant(ch1) + (user,assistant)×2
    expect(transcript[0].role).toBe('assistant');
    expect(transcript.some((m) => m.role === 'user' && m.content === 'Je fuis')).toBe(true);
    expect(transcript[transcript.length - 1].content).toContain('Duel');
  });

  it('compresses the oldest turns into the archive under a tiny budget', () => {
    const { transcript, archive } = buildNarrativeContext(history, actions, 1);
    expect(archive.length).toBeGreaterThan(0);
    expect(transcript.some((m) => m.content.includes('Duel'))).toBe(true); // newest stays raw
    expect(transcript.some((m) => m.content.includes('Ouverture'))).toBe(false); // oldest archived
  });

  it('returns empty for empty history', () => {
    expect(buildNarrativeContext([], [], 1000)).toEqual({ transcript: [], archive: [] });
  });
});
