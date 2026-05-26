import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateTurn } from './generate';
import { initWorldState } from './worldState';
import type { StoryProviderConfig, StorySetup } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };
const setup: StorySetup = { era: 'imperial', faction: 'rebels', role: 'jedi_knight', premise: 'x', protagonistFirstName: 'Kael', language: 'fr' };

function stubSequence(contents: string[]) {
  let i = 0;
  const mock = vi.fn().mockImplementation(async () => {
    const content = contents[Math.min(i, contents.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('agentic pipeline (mocked transport)', () => {
  it('runs Director → Writer → Brain and assembles a chapter', async () => {
    const director = JSON.stringify({ scene_goal: 'fuir', tension: 'gardes', must_include: ['un sas'], section_type: 'action', atmosphere: 'tense' });
    const writer = 'Les sirènes hurlent dans la coursive enfumée.\n\nKael : On ne s\'arrête pas maintenant.';
    const brain = JSON.stringify({
      chapter_title: 'Coursive en feu',
      section_type: 'action',
      narrative: { atmosphere: 'tense' },
      state_update: { hp: -10, location: 'Coursive du cargo' },
      choices: [{ text: 'Sceller le sas derrière soi', attribute: 'tech', difficulty: 3 }],
      memory_updates: {}
    });
    const mock = stubSequence([director, writer, brain]);

    const result = await generateTurn(
      { setup, worldState: initWorldState(setup), turnNumber: 2, actionText: 'Courir vers le hangar', recentSummary: ['Tour 1 : capture.'] },
      provider,
      { mode: 'agentic-subagents' }
    );

    expect(mock).toHaveBeenCalledTimes(3);
    expect(result.mode).toBe('agentic-subagents');
    expect(result.chapter.chapter_title).toBe('Coursive en feu');
    expect(result.chapter.narrative.action).toContain('sirènes');
    expect(result.chapter.narrative.dialogue).toContain('Kael :');
    expect(result.chapter.choices[0].text).toBe('Sceller le sas derrière soi');
    expect(result.worldState.player.hp).toBe(90);
    expect(result.worldState.player.location).toBe('Coursive du cargo');
  });
});
