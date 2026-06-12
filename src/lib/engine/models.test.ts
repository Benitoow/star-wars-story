import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveContextBudget, supportsReasoningParam } from './models';
import { callTextModel } from './provider';
import { DEFAULT_CONTEXT_BUDGET } from './context';
import type { StoryProviderConfig } from './types';

function stubModels(models: Array<{ id: string; context_length?: number; supported_parameters?: string[] }>) {
  const mock = vi.fn().mockImplementation(async (url: unknown) => {
    if (String(url).includes('/models')) {
      return { ok: true, status: 200, json: async () => ({ data: models }) };
    }
    const content = 'ok';
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

// Distinct apiKeys per test: fetchContextLengths caches by key.
const cfg = (model: string, apiKey: string): StoryProviderConfig => ({ providerId: 'openrouter', model, apiKey });

describe('resolveContextBudget', () => {
  it('scales the budget to the model window — never floored at the default (regression)', async () => {
    stubModels([{ id: 'small/model', context_length: 32768 }]);
    const budget = await resolveContextBudget(cfg('small/model', 'k-small'));
    expect(budget).toBe(Math.floor(32768 * 0.7)); // 22937, not the 200K default
    expect(budget).toBeLessThan(32768); // fits inside the window — no overflow
    expect(budget).toBeLessThan(DEFAULT_CONTEXT_BUDGET);
  });

  it('scales up for a large-window model', async () => {
    stubModels([{ id: 'big/model', context_length: 1_000_000 }]);
    expect(await resolveContextBudget(cfg('big/model', 'k-big'))).toBe(700_000);
  });

  it('falls back to the default when the model is unknown to /models', async () => {
    stubModels([{ id: 'other/model', context_length: 128000 }]);
    expect(await resolveContextBudget(cfg('missing/model', 'k-missing'))).toBe(DEFAULT_CONTEXT_BUDGET);
  });

  it('falls back to the default without hitting the API for a non-openrouter provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveContextBudget({ providerId: 'none', model: 'x', apiKey: '' })).toBe(DEFAULT_CONTEXT_BUDGET);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('supportsReasoningParam (API-driven, no regex catalog)', () => {
  it('true when /models lists the reasoning parameter for the model', async () => {
    stubModels([{ id: 'think/model', supported_parameters: ['temperature', 'reasoning'] }]);
    expect(await supportsReasoningParam(cfg('think/model', 'k-r1'))).toBe(true);
  });

  it('false when the model is listed without reasoning support', async () => {
    stubModels([{ id: 'plain/model', supported_parameters: ['temperature'] }]);
    expect(await supportsReasoningParam(cfg('plain/model', 'k-r2'))).toBe(false);
  });

  it('null when the model is unknown to the catalog', async () => {
    stubModels([{ id: 'other/model', supported_parameters: ['reasoning'] }]);
    expect(await supportsReasoningParam(cfg('missing/model', 'k-r3'))).toBe(null);
  });
});

describe('reasoning payload (callTextModel, capability-aware)', () => {
  function completionBody(mock: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const call = mock.mock.calls.find((c) => String(c[0]).includes('/chat/completions'));
    return JSON.parse(String((call![1] as RequestInit).body)) as Record<string, unknown>;
  }

  it('sends effort "none" with skipReasoning when the model supports the param', async () => {
    const mock = stubModels([{ id: 'think/model', supported_parameters: ['reasoning'] }]);
    await callTextModel([{ role: 'user', content: 'hi' }], cfg('think/model', 'k-r4'), { skipReasoning: true });
    expect(completionBody(mock).reasoning).toEqual({ effort: 'none' });
  });

  it('omits reasoning entirely with skipReasoning on a non-reasoning model', async () => {
    const mock = stubModels([{ id: 'plain/model', supported_parameters: ['temperature'] }]);
    await callTextModel([{ role: 'user', content: 'hi' }], cfg('plain/model', 'k-r5'), { skipReasoning: true });
    expect(completionBody(mock).reasoning).toBeUndefined();
  });

  it('omits reasoning for effort "auto" without any capability lookup', async () => {
    const mock = stubModels([]);
    await callTextModel([{ role: 'user', content: 'hi' }], { ...cfg('any/model', 'k-r6'), reasoningEffort: 'auto' });
    expect(completionBody(mock).reasoning).toBeUndefined();
    expect(mock.mock.calls.some((c) => String(c[0]).includes('/models'))).toBe(false);
  });

  it('sends the explicit user effort when the model supports it', async () => {
    const mock = stubModels([{ id: 'think/model', supported_parameters: ['reasoning'] }]);
    await callTextModel([{ role: 'user', content: 'hi' }], { ...cfg('think/model', 'k-r7'), reasoningEffort: 'high' });
    expect(completionBody(mock).reasoning).toEqual({ effort: 'high' });
  });
});
