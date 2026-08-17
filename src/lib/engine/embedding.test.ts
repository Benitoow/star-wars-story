import { describe, it, expect, vi, afterEach } from 'vitest';
import { embedTexts, getOrCreateVectors } from './embedding';
import type { StoryProviderConfig } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };

function okEmbeddingResponse(vectors: number[][]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: vectors.map((embedding) => ({ embedding })) }),
    text: async () => ''
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('embedTexts', () => {
  it('posts to the provider embeddings endpoint and returns the vectors', async () => {
    const mock = vi.fn().mockResolvedValue(okEmbeddingResponse([[0.1, 0.2], [0.3, 0.4]]));
    vi.stubGlobal('fetch', mock);

    const vectors = await embedTexts(['un fait', 'un autre'], provider);
    expect(vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toContain('/embeddings');
    expect(JSON.parse(init.body)).toMatchObject({ model: expect.any(String), input: ['un fait', 'un autre'] });
  });

  it('throws a descriptive error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":{"message":"clé invalide"}}' }));
    await expect(embedTexts(['x'], provider)).rejects.toThrow(/clé invalide/);
  });

  it('throws for providers without an embeddings endpoint', async () => {
    await expect(embedTexts(['x'], { providerId: 'mimo', model: 'm', apiKey: 'k' })).rejects.toThrow(/embedding/i);
  });
});

describe('getOrCreateVectors (cached)', () => {
  const cache = {
    // Keys are accent-folded by the engine (foldText), so match on the folded form.
    get: vi.fn(async (key: string) => (key.includes('fait cache') ? [0.9, 0.1] : null)),
    set: vi.fn(async () => undefined)
  };

  it('reuses cached vectors and embeds only the missing texts in one batch', async () => {
    const mock = vi.fn().mockResolvedValue(okEmbeddingResponse([[0.5, 0.5]]));
    vi.stubGlobal('fetch', mock);

    const vectors = await getOrCreateVectors(['fait caché', 'fait neuf'], provider, cache);
    expect(vectors).not.toBeNull();
    expect(vectors!.get('fait cache')).toEqual([0.9, 0.1]);
    expect(vectors!.get('fait neuf')).toEqual([0.5, 0.5]);
    expect(mock).toHaveBeenCalledTimes(1); // only the missing one hit the network
    expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('fait neuf'), expect.any(Array));
  });

  it('returns null when the network call fails (caller falls back to lexical)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau coupé')));
    const vectors = await getOrCreateVectors(['fait neuf'], provider, cache);
    expect(vectors).toBeNull();
  });
});
