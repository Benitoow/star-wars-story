import { describe, it, expect, vi, afterEach } from 'vitest';
import { callTextModelStream } from './provider';
import type { StoryProviderConfig } from './types';

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'x', apiKey: 'k' };

function sseBody(chunks: string[]) {
  let i = 0;
  const enc = new TextEncoder();
  return {
    getReader() {
      return {
        read: async () => (i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined })
      };
    }
  };
}

function stubStream(chunks: string[], ok = true, status = 200) {
  const mock = vi.fn().mockResolvedValue({ ok, status, body: sseBody(chunks), text: async () => 'erreur provider' });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('callTextModelStream', () => {
  it('accumulates SSE deltas and reports each via onToken', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"Bonjour"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":", vagabond"}}]}\n\n',
      'data: [DONE]\n\n'
    ]);
    const tokens: string[] = [];
    const full = await callTextModelStream([{ role: 'user', content: 'hi' }], provider, (t) => tokens.push(t));
    expect(tokens).toEqual(['Bonjour', ', vagabond']);
    expect(full).toBe('Bonjour, vagabond');
  });

  it('handles a JSON frame split across two reads (buffering)', async () => {
    stubStream(['data: {"choices":[{"delta":{"con', 'tent":"Salut"}}]}\n\ndata: [DONE]\n\n']);
    const full = await callTextModelStream([{ role: 'user', content: 'hi' }], provider, () => {});
    expect(full).toBe('Salut');
  });

  it('throws a descriptive error on a non-ok response', async () => {
    stubStream([], false, 401);
    await expect(callTextModelStream([{ role: 'user', content: 'hi' }], provider, () => {})).rejects.toThrow(/erreur provider/i);
  });
});
