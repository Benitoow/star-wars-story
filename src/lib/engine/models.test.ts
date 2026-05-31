import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveContextBudget } from './models';
import { DEFAULT_CONTEXT_BUDGET } from './context';
import type { StoryProviderConfig } from './types';

function stubModels(models: Array<{ id: string; context_length?: number }>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: models }) }));
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
