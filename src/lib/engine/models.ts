/* ═══════════════════════════════════════════════
   Model capabilities — auto-detected from OpenRouter
   (/models → context_length + supported_parameters),
   cached per key. No hand-maintained model catalogs:
   the API is the source of truth.
══════════════════════════════════════════════ */
import { OPENROUTER_BASE_URL } from '$lib/content/providers';
import { logger } from '$lib/logger';
import { DEFAULT_CONTEXT_BUDGET } from './context';
import type { StoryProviderConfig } from './types';

// Share of the window used for the RAW transcript; the rest covers the system
// prompt, the archive and the model's response.
export const TRANSCRIPT_SHARE = 0.7;

export interface ModelCapabilities {
  contextLength?: number;
  supportedParameters?: string[];
}

let cache: { key: string; models: Record<string, ModelCapabilities> } | null = null;

export async function fetchModelCatalog(apiKey: string): Promise<Record<string, ModelCapabilities>> {
  if (cache && cache.key === apiKey) return cache.models;

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, { headers });
  if (!res.ok) throw new Error(`models ${res.status}`);

  const data = (await res.json()) as {
    data?: Array<{ id?: string; context_length?: number; supported_parameters?: unknown }>;
  };
  const models: Record<string, ModelCapabilities> = {};
  for (const m of data?.data ?? []) {
    if (!m?.id) continue;
    models[m.id] = {
      contextLength:
        typeof m.context_length === 'number' && Number.isFinite(m.context_length) ? m.context_length : undefined,
      supportedParameters: Array.isArray(m.supported_parameters)
        ? m.supported_parameters.filter((p): p is string => typeof p === 'string')
        : undefined
    };
  }
  cache = { key: apiKey, models };
  return models;
}

/** Context windows by model id — kept for the settings display. */
export async function fetchContextLengths(apiKey: string): Promise<Record<string, number>> {
  const models = await fetchModelCatalog(apiKey);
  const lengths: Record<string, number> = {};
  for (const [id, caps] of Object.entries(models)) {
    if (caps.contextLength) lengths[id] = caps.contextLength;
  }
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
    const models = await fetchModelCatalog(config.apiKey);
    const window = models[config.model]?.contextLength;
    if (!window || !Number.isFinite(window)) return DEFAULT_CONTEXT_BUDGET;
    // Scale to the model's real window — never floor it at the default, or a
    // small/medium model gets a transcript budget bigger than its whole window.
    return Math.floor(window * TRANSCRIPT_SHARE);
  } catch (error) {
    logger.debug('context window auto-detect failed, using default budget', error);
    return DEFAULT_CONTEXT_BUDGET;
  }
}

/**
 * Whether the model accepts the OpenRouter `reasoning` parameter.
 * true/false when the catalog knows the model; null when unknown
 * (offline, other provider, model absent from /models).
 */
export async function supportsReasoningParam(config: StoryProviderConfig): Promise<boolean | null> {
  if (config.providerId !== 'openrouter' || !config.model) return null;
  try {
    const models = await fetchModelCatalog(config.apiKey ?? '');
    const supported = models[config.model]?.supportedParameters;
    if (!supported) return null;
    return supported.includes('reasoning');
  } catch {
    return null;
  }
}
