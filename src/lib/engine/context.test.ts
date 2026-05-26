import { describe, it, expect } from 'vitest';
import { buildNarrativeContext, detectOverusedTerms, getModelContextLimit, getDynamicContextBudget } from './context';
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

describe('detectOverusedTerms', () => {
  it('flags a word that recurs across many scenes', () => {
    const chapters = Array.from({ length: 5 }, (_, i) => ch(i + 1, `Une lueur pourpre traverse la pièce numéro ${i}.`));
    expect(detectOverusedTerms(chapters)).toContain('pourpre');
  });

  it('ignores a word used in only one scene', () => {
    const chapters = [ch(1, 'Le blaster crépite.'), ch(2, 'Le calme revient.'), ch(3, 'Le sable brille.'), ch(4, 'La nuit tombe.')];
    expect(detectOverusedTerms(chapters)).not.toContain('blaster');
  });

  it('returns nothing without enough history', () => {
    expect(detectOverusedTerms([ch(1, 'pourpre pourpre pourpre')])).toEqual([]);
  });
});

describe('dynamic context budget', () => {
  it('correctly maps model names to context limits', () => {
    expect(getModelContextLimit('google/gemini-3.5-flash')).toBe(1_000_000);
    expect(getModelContextLimit('x-ai/grok-4.3')).toBe(1_000_000); // updated for Grok 4.3 1M
    expect(getModelContextLimit('openai/gpt-5.4-mini')).toBe(400_000); // updated for GPT-5.4 400K
    expect(getModelContextLimit('openai/gpt-4o')).toBe(128_000);
    expect(getModelContextLimit('meta-llama/llama-3.3-70b')).toBe(128_000);
    expect(getModelContextLimit('gpt-3.5-turbo')).toBe(16_384);
    expect(getModelContextLimit('unknown-model')).toBe(128_000); // default
  });

  it('correctly calculates dynamic budget as 50% of the limit', () => {
    expect(getDynamicContextBudget('google/gemini-3.5-flash')).toBe(500_000);
    expect(getDynamicContextBudget('x-ai/grok-4.3')).toBe(500_000); // 50% of 1M
    expect(getDynamicContextBudget('openai/gpt-5.4-mini')).toBe(200_000); // 50% of 400K
    expect(getDynamicContextBudget('gpt-3.5-turbo')).toBe(8_192);
  });
});

