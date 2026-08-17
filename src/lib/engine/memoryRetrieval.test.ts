import { describe, it, expect, vi, afterEach } from 'vitest';
import { retrieveMemory } from './memoryRetrieval';
import type { MemoryFact, StoryProviderConfig } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };

function fact(text: string, turn: number): MemoryFact {
  return { text, category: 'notes', turn };
}

afterEach(() => vi.unstubAllGlobals());

describe('retrieveMemory (integration wiring)', () => {
  it('caches the facts but never persists the per-turn query', async () => {
    const cache = {
      get: vi.fn(async (_key: string) => null),
      set: vi.fn(async (_key: string, _vector: number[]) => undefined)
    };
    const mock = vi.fn().mockImplementation(async (url: unknown, init: { body?: string }) => {
      const body = JSON.parse(init.body ?? '{}') as { input: string[] };
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: body.input.map(() => ({ embedding: [1, 0, 0] })) }),
        text: async () => ''
      };
    });
    vi.stubGlobal('fetch', mock);

    const facts = [fact('Une relique sith dans le temple', 9), fact('Vela aime le spice', 3)];
    await retrieveMemory(facts, 'relique sith temple', { provider, enableEmbeddings: true, cache });

    // One network call per missing fact-batch + one for the query, never more.
    expect(mock).toHaveBeenCalledTimes(2);
    // Facts are persisted to the cache; the per-turn query is not.
    const writtenKeys = cache.set.mock.calls.map((c) => c[0] as string);
    expect(writtenKeys.some((k) => k.includes('relique sith dans le temple'))).toBe(true);
    expect(writtenKeys.some((k) => k.includes('::relique sith temple'))).toBe(false);
  });

  it('falls back to lexical selection when the query embedding fails', async () => {
    const cache = { get: vi.fn(async (_key: string) => null), set: vi.fn(async (_key: string, _vector: number[]) => undefined) };
    const mock = vi.fn().mockImplementation(async (url: unknown, init: { body?: string }) => {
      const body = JSON.parse(init.body ?? '{}') as { input: string[] };
      if (body.input.length === 1) throw new Error('réseau coupé'); // the query call
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: body.input.map(() => ({ embedding: [0, 1, 0] })) }),
        text: async () => ''
      };
    });
    vi.stubGlobal('fetch', mock);

    const facts = [fact('La garnison impériale évacue le secteur', 5), fact('Vela aime le spice', 3)];
    const selected = await retrieveMemory(facts, 'garnison impériale évacue', {
      provider,
      enableEmbeddings: true,
      cache
    });
    // Lexical fallback still surfaces the relevant fact — the turn never blocks.
    expect(selected[0].text).toContain('garnison');
  });
});
