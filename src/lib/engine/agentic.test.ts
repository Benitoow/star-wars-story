import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateTurn } from './generate';
import { initWorldState } from './worldState';
import type { StoryProviderConfig, StorySetup } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };
const setup: StorySetup = { era: 'imperial', faction: 'rebels', role: 'jedi_knight', premise: 'x', protagonistFirstName: 'Kael', language: 'fr' };

function stubSequence(contents: string[]) {
  let i = 0;
  const mock = vi.fn().mockImplementation(async (url: unknown) => {
    // Capability lookups (/models) are served separately from the completion sequence.
    if (String(url).includes('/models')) {
      return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '' };
    }
    const content = contents[Math.min(i, contents.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('agentic pipeline (mocked transport)', () => {
  it('runs Director → Writer → Reviewer → Brain and assembles the reviewed scene', async () => {
    const director = JSON.stringify({ scene_goal: 'fuir', tension: 'gardes', must_include: ['un sas'], section_type: 'action', atmosphere: 'tense' });
    const writer = 'Les sirènes hurlent dans la coursive enfumée.\n\nKael : On ne s\'arrête pas.';
    const reviewer = 'Les sirènes déchirent la coursive noyée de fumée.\n\nKael : On ne lâche rien.';
    const brain = JSON.stringify({
      chapter_title: 'Coursive en feu',
      section_type: 'action',
      narrative: { atmosphere: 'tense' },
      state_update: { hp: -10, location: 'Coursive du cargo' },
      choices: [{ text: 'Sceller le sas derrière soi', attribute: 'tech', difficulty: 3 }],
      memory_updates: {}
    });
    const mock = stubSequence([director, writer, reviewer, brain]);

    const result = await generateTurn(
      { setup, worldState: initWorldState(setup), turnNumber: 2, actionText: 'Courir vers le hangar' },
      provider,
      { mode: 'agentic-subagents' }
    );

    const completionCalls = mock.mock.calls.filter((c) => String(c[0]).includes('/chat/completions'));
    expect(completionCalls).toHaveLength(4);
    expect(result.mode).toBe('agentic-subagents');
    expect(result.chapter.chapter_title).toBe('Coursive en feu');
    expect(result.chapter.narrative.action).toContain('déchirent'); // the reviewed prose is used
    expect(result.chapter.narrative.dialogue).toContain('Kael :');
    expect(result.chapter.choices[0].text).toBe('Sceller le sas derrière soi');
    expect(result.worldState.player.hp).toBe(90);
    expect(result.worldState.player.location).toBe('Coursive du cargo');
  });

  it('gives the Director AND the Writer the era codex + the honesty guardrail', async () => {
    const director = JSON.stringify({ scene_goal: 'g', tension: 't', must_include: ['x'], section_type: 'action', atmosphere: 'tense' });
    const brain = JSON.stringify({ chapter_title: 'T', section_type: 'action', narrative: {}, state_update: {}, choices: [], memory_updates: {} });
    const mock = stubSequence([director, 'prose', 'prose relue', brain]);

    await generateTurn(
      { setup, worldState: initWorldState(setup), turnNumber: 2, actionText: 'Fouiller le destroyer stellaire' },
      provider,
      { mode: 'agentic-subagents' }
    );

    const bodies = mock.mock.calls
      .filter((c) => String(c[0]).includes('/chat/completions'))
      .map((c) => JSON.parse((c[1] as { body: string }).body) as { messages: Array<{ role: string; content: string }> });
    const [directorCall, writerCall] = bodies;

    // The Director invents the must_include elements — it needs both.
    expect(directorCall.messages[0].content).toContain('HONNÊTETÉ HISTORIQUE');
    expect(directorCall.messages.at(-1)!.content).toContain("CODEX DE L'ÉPOQUE");
    // The Writer renders them — it needs both too.
    expect(writerCall.messages[0].content).toContain('HONNÊTETÉ HISTORIQUE');
    expect(writerCall.messages.at(-1)!.content).toContain("CODEX DE L'ÉPOQUE");
  });
});
