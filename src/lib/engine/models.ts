/* ═══════════════════════════════════════════════
   Model capabilities — auto-detected from the
   provider's /models endpoint, or hard-coded for
   providers without a public catalog (MiMo).
   Cached per (provider, key) pair.
══════════════════════════════════════════════ */
import { getProviderBaseUrl } from '$lib/content/providers';
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

// ── Hard-coded catalogs (no /models endpoint) ──────────

const MIMO_CATALOG: Record<string, ModelCapabilities> = {
  'mimo-v2.5-pro': {
    contextLength: 131_072,
    supportedParameters: ['reasoning', 'temperature', 'top_p', 'max_completion_tokens', 'tools']
  },
  'mimo-v2.5': {
    contextLength: 131_072,
    supportedParameters: ['reasoning', 'temperature', 'top_p', 'max_completion_tokens', 'tools']
  }
};

// ── Dynamic catalog cache (OpenRouter, etc.) ───────────

let cache: { key: string; models: Record<string, ModelCapabilities> } | null = null;

/**
 * Fetch the full model catalog for a provider.
 * - openrouter: hits /models (dynamic, cached per apiKey)
 * - mimo: returns the hard-coded catalog
 * - other/none: empty
 */
export async function fetchModelCatalog(
  apiKey: string,
  providerId = 'openrouter'
): Promise<Record<string, ModelCapabilities>> {
  if (providerId === 'mimo') return { ...MIMO_CATALOG };
  if (providerId !== 'openrouter' || !apiKey) return {};

  const cacheKey = `${providerId}:${apiKey}`;
  if (cache && cache.key === cacheKey) return cache.models;

  const baseUrl = getProviderBaseUrl(providerId);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl}/models`, { headers });
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
  cache = { key: cacheKey, models };
  return models;
}

/** Context windows by model id — kept for the settings display. */
export async function fetchContextLengths(
  apiKey: string,
  providerId = 'openrouter'
): Promise<Record<string, number>> {
  const models = await fetchModelCatalog(apiKey, providerId);
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
  if (!config.apiKey || !config.model) return DEFAULT_CONTEXT_BUDGET;
  try {
    const models = await fetchModelCatalog(config.apiKey, config.providerId);
    const window = models[config.model]?.contextLength;
    if (!window || !Number.isFinite(window)) return DEFAULT_CONTEXT_BUDGET;
    return Math.floor(window * TRANSCRIPT_SHARE);
  } catch (error) {
    logger.debug('context window auto-detect failed, using default budget', error);
    return DEFAULT_CONTEXT_BUDGET;
  }
}

/**
 * Whether the model accepts the reasoning parameter.
 * true/false when the catalog knows the model; null when unknown.
 * MiMo always returns true (thinking is always supported).
 */
export async function supportsReasoningParam(config: StoryProviderConfig): Promise<boolean | null> {
  if (!config.model) return null;
  // MiMo always supports thinking — no catalog check needed
  if (config.providerId === 'mimo') return true;
  if (config.providerId !== 'openrouter') return null;
  try {
    const models = await fetchModelCatalog(config.apiKey ?? '', config.providerId);
    const supported = models[config.model]?.supportedParameters;
    if (!supported) return null;
    return supported.includes('reasoning');
  } catch {
    return null;
  }
}
