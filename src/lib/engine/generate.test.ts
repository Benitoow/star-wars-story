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

describe('generateTurn — streamed narrative preview (onPartial)', () => {
  function sseBody(chunks: string[]) {
    let i = 0;
    const enc = new TextEncoder();
    return { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined }) }) };
  }
  function sseFrames(content: string, chunkSize = 16): string[] {
    const frames: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      frames.push(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(i, i + chunkSize) } }] })}\n\n`);
    }
    frames.push('data: [DONE]\n\n');
    return frames;
  }

  it('streams the JSON, surfaces title + prose progressively, then parses the chapter', async () => {
    const doc = JSON.stringify({
      chapter_title: 'Percée',
      chapter_number: 2,
      section_type: 'action',
      narrative: { action: 'Le sas cède sous la poussée.', dialogue: '', reflection: '', atmosphere: 'tense' },
      choices: [{ text: 'Foncer dans la brèche', attribute: 'combat', difficulty: 2 }]
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: sseBody(sseFrames(doc)), text: async () => '' }));

    const partials: Array<{ title: string; text: string }> = [];
    const result = await generateTurn(
      { setup, worldState: initWorldState(setup), turnNumber: 2, actionText: 'Pousser le sas' },
      provider,
      { onPartial: (p) => partials.push({ ...p }) }
    );

    expect(partials.length).toBeGreaterThan(1);
    expect(partials[partials.length - 1].title).toBe('Percée');
    expect(partials[partials.length - 1].text).toBe('Le sas cède sous la poussée.');
    expect(result.chapter.chapter_title).toBe('Percée');
    expect(result.chapter.narrative.action).toContain('sas');
  });

  it('falls back to the non-streaming (retried) call when the stream fails', async () => {
    const doc = JSON.stringify({ chapter_title: 'Secours', narrative: { action: 'On le relève doucement.' } });
    const mock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, body: null, text: async () => 'stream en panne' })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: doc } }] }), text: async () => doc });
    vi.stubGlobal('fetch', mock);

    const result = await generateTurn(
      { setup, worldState: initWorldState(setup), turnNumber: 3, actionText: 'Le relever' },
      provider,
      { onPartial: () => {} }
    );
    expect(result.chapter.chapter_title).toBe('Secours');
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
