/* ═══════════════════════════════════════════════
   Auto-detect a model's context window from OpenRouter
   (/models → context_length), cached. The transcript
   budget is a safe fraction of it, leaving room for the
   system prompt + the response. No manual setting.
══════════════════════════════════════════════ */
import { OPENROUTER_BASE_URL } from '$lib/content/providers';
import { logger } from '$lib/logger';
import { DEFAULT_CONTEXT_BUDGET } from './context';
import type { StoryProviderConfig } from './types';

// Share of the window used for the RAW transcript; the rest covers the system
// prompt, the archive and the model's response.
const TRANSCRIPT_SHARE = 0.7;

let cache: { key: string; lengths: Record<string, number> } | null = null;

async function fetchContextLengths(apiKey: string): Promise<Record<string, number>> {
  if (cache && cache.key === apiKey) return cache.lengths;

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, { headers });
  if (!res.ok) throw new Error(`models ${res.status}`);

  const data = (await res.json()) as { data?: Array<{ id?: string; context_length?: number }> };
  const lengths: Record<string, number> = {};
  for (const m of data?.data ?? []) {
    if (m?.id && typeof m.context_length === 'number' && Number.isFinite(m.context_length)) {
      lengths[m.id] = m.context_length;
    }
  }
  cache = { key: apiKey, lengths };
  return lengths;
}

/**
 * Token budget for the raw transcript, derived from the model's real context
 * window. Falls back to a safe default if detection fails. Cached per key.
 */
export async function resolveContextBudget(config: StoryProviderConfig): Promise<number> {
  if (config.providerId !== 'openrouter' || !config.apiKey || !config.model) {
    return DEFAULT_CONTEXT_BUDGET;
  }
  try {
    const lengths = await fetchContextLengths(config.apiKey);
    const window = lengths[config.model];
    if (!window || !Number.isFinite(window)) return DEFAULT_CONTEXT_BUDGET;
    return Math.max(DEFAULT_CONTEXT_BUDGET, Math.floor(window * TRANSCRIPT_SHARE));
  } catch (error) {
    logger.debug('context window auto-detect failed, using default budget', error);
    return DEFAULT_CONTEXT_BUDGET;
  }
}
