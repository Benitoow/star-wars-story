import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractUsage, cacheHitRate, formatUsage } from './usage';
import { callTextModel, callTextModelStream } from './provider';
import { getLogs, clearLogs } from '$lib/logger';
import type { StoryProviderConfig } from './types';

/** Strip the locale's thousands separators so assertions don't depend on them. */
const plain = (text = '') => text.replace(/[\u202f\u00a0\s](?=\d)/g, '');

const provider: StoryProviderConfig = { providerId: 'openrouter', model: 'deepseek/deepseek-v4-flash-0731', apiKey: 'k' };

afterEach(() => {
  vi.unstubAllGlobals();
  clearLogs();
});

describe('extractUsage', () => {
  it('reads the OpenAI-style nested shape used by OpenRouter', () => {
    const usage = extractUsage({
      usage: {
        prompt_tokens: 15_000,
        completion_tokens: 620,
        cost: 0.000691,
        prompt_tokens_details: { cached_tokens: 12_600, cache_write_tokens: 240 },
        completion_tokens_details: { reasoning_tokens: 180 }
      }
    });
    expect(usage).toEqual({
      prompt: 15_000, completion: 620, cached: 12_600, cacheWritten: 240, reasoning: 180, cost: 0.000691
    });
    expect(Math.round(cacheHitRate(usage!) * 100)).toBe(84);
  });

  it('falls back to the flat Anthropic-style aliases', () => {
    const usage = extractUsage({
      usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 700, cache_creation_input_tokens: 200 }
    });
    expect(usage?.prompt).toBe(900);
    expect(usage?.cached).toBe(700);
    expect(usage?.cacheWritten).toBe(200);
    expect(usage?.cost).toBeNull();
  });

  it('returns null when there is nothing to report', () => {
    expect(extractUsage(null)).toBeNull();
    expect(extractUsage({})).toBeNull();
    expect(extractUsage({ usage: {} })).toBeNull();
    expect(extractUsage({ usage: { prompt_tokens: 0, completion_tokens: 0 } })).toBeNull();
  });

  it('says plainly when the cache never engaged', () => {
    const cold = extractUsage({ usage: { prompt_tokens: 15_000, completion_tokens: 100 } })!;
    expect(cacheHitRate(cold)).toBe(0);
    expect(formatUsage(cold, 'écrivain', 'qwen/qwen3.5-9b')).toContain('cache inactif');
    const warm = extractUsage({ usage: { prompt_tokens: 100, completion_tokens: 1, prompt_tokens_details: { cached_tokens: 84 } } })!;
    expect(formatUsage(warm, 'écrivain', 'x')).toContain('(84 %)');
  });
});

describe('the transport records usage into the diagnostics ring', () => {
  it('reports it on the non-streaming path, tagged with the call label', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'scène' } }],
        usage: { prompt_tokens: 15_000, completion_tokens: 620, prompt_tokens_details: { cached_tokens: 12_600 } }
      }),
      text: async () => ''
    })));

    await callTextModel([{ role: 'user', content: 'x' }], provider, { label: 'écrivain' });

    const line = plain(getLogs().find((l) => l.message.startsWith('usage '))?.message);
    expect(line).toContain('écrivain');
    expect(line).toContain('deepseek/deepseek-v4-flash-0731');
    expect(line).toContain('12600 servis en cache (84 %)');
  });

  it('reports it on the streaming path, where usage rides the closing frame', async () => {
    const frames = [
      'data: {"choices":[{"delta":{"content":"Les sirènes"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" hurlent."}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":800,"completion_tokens":12,"prompt_tokens_details":{"cached_tokens":600}}}\n\n',
      'data: [DONE]\n\n'
    ];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            i < frames.length
              ? { done: false, value: new TextEncoder().encode(frames[i++]) }
              : { done: true, value: undefined }
        })
      }
    })));

    const text = await callTextModelStream([{ role: 'user', content: 'x' }], provider, () => {}, { label: 'réplique PNJ' });
    expect(text).toContain('hurlent');

    const line = plain(getLogs().find((l) => l.message.startsWith('usage '))?.message);
    expect(line).toContain('réplique PNJ');
    expect(line).toContain('600 servis en cache (75 %)');
  });
});
