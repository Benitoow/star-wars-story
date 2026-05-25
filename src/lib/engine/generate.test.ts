import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateOpening, generateTurn } from './generate';
import { callTextModel } from './provider';
import { initWorldState } from './worldState';
import type { StoryProviderConfig, StorySetup } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'qwen/qwen3.5-9b', apiKey: 'sk-test' };
const setup: StorySetup = {
  era: 'imperial', faction: 'rebels', role: 'jedi_knight', premise: 'x',
  protagonistFirstName: 'Kael', language: 'fr'
};

function stubFetch(content: string, ok = true, status = 200) {
  const mock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('callTextModel guards', () => {
  it('refuses the "none" provider with a clear error', async () => {
    await expect(
      callTextModel([{ role: 'user', content: 'hi' }], { providerId: 'none', model: '', apiKey: '' })
    ).rejects.toThrow(/provider/i);
  });

  it('refuses a missing API key', async () => {
    await expect(
      callTextModel([{ role: 'user', content: 'hi' }], { providerId: 'openrouter', model: 'x', apiKey: '' })
    ).rejects.toThrow(/cl[ée] api/i);
  });
});

describe('generateOpening (mocked transport)', () => {
  it('parses the chapter and advances the world from setup', async () => {
    stubFetch(JSON.stringify({
      chapter_title: 'Évasion',
      chapter_number: 1,
      section_type: 'action',
      narrative: { action: 'La cale tremble.', dialogue: 'Kael : On y va.', reflection: '', atmosphere: 'tense' },
      choices: [{ text: 'Forcer le sas', attribute: 'combat', difficulty: 3 }],
      state_update: { hp: -10, location: 'Cargo impérial', credits: 50 }
    }));

    const result = await generateOpening(setup, provider);
    expect(result.mode).toBe('structured-json');
    expect(result.chapter.chapter_title).toBe('Évasion');
    expect(result.worldState.player.location).toBe('Cargo impérial');
    expect(result.worldState.player.hp).toBe(90);
    expect(result.worldState.player.credits).toBe(550); // 500 + 50
  });

  it('requests JSON mode, sends the key, and sets no token ceiling', async () => {
    const fetchMock = stubFetch('{"narrative":{"action":"x"}}');
    await generateOpening(setup, provider);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(body.max_tokens).toBeUndefined();
  });
});

describe('generateTurn (mocked transport)', () => {
  it('applies the action consequences onto the existing world', async () => {
    stubFetch(JSON.stringify({
      chapter_number: 2,
      narrative: { action: 'Le garde s\'effondre.', dialogue: '', reflection: '', atmosphere: 'tense' },
      choices: [{ text: 'Récupérer la carte', attribute: 'stealth', difficulty: 2 }],
      state_update: { hp: -5, npcs: [{ name: 'Garde', alive: false }] }
    }));

    const world = initWorldState(setup);
    const result = await generateTurn(
      { setup, worldState: world, turnNumber: 2, actionText: 'Désarmer le garde' },
      provider
    );
    expect(result.chapter.chapter_number).toBe(2);
    expect(result.worldState.player.hp).toBe(95);
    expect(result.worldState.npcs.find((n) => n.name === 'Garde')?.alive).toBe(false);
  });
});
