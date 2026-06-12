/* ═══════════════════════════════════════════════
   Provider registry — each provider owns its
   base URL, auth header, and supported models.
   OpenRouter models are loaded dynamically;
   MiMo models are hard-coded (no public /models).
══════════════════════════════════════════════ */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_APP_TITLE = 'Star Wars Story';

export const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1';

/** Canonical ids the app recognises. */
export const SUPPORTED_TEXT_PROVIDER_IDS = new Set<string>(['openrouter', 'mimo', 'none']);

/** Default provider on a fresh install. */
export const DEFAULT_TEXT_PROVIDER_ID = 'openrouter';
/** Default model (OpenRouter). */
export const DEFAULT_TEXT_MODEL_ID = 'qwen/qwen3.5-9b';

/** MiMo has no public /models — hard-code the V2.5 lineup. */
export const MIMO_MODELS = ['mimo-v2.5-pro', 'mimo-v2.5'] as const;

// ── display names ──────────────────────────────────────
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openrouter: 'OpenRouter',
  mimo: 'Xiaomi MiMo',
  none: 'Aucun provider'
};

/** Human-readable name for a model id. */
export function getModelDisplayName(modelId: string): string {
  const displayMap: Record<string, string> = {
    'mimo-v2.5-pro': 'MiMo V2.5 Pro',
    'mimo-v2.5': 'MiMo V2.5'
  };
  return displayMap[modelId] || modelId;
}

// ── aliases (legacy ids → canonical) ───────────────────
const PROVIDER_ALIASES: Record<string, string> = {
  openai: 'openrouter', anthropic: 'openrouter', mistral: 'openrouter',
  grok: 'openrouter', xai: 'openrouter', gemini: 'openrouter',
  groq: 'openrouter', together: 'openrouter', ollama: 'openrouter',
  xiaomi: 'mimo', 'xiaomi-mimo': 'mimo'
};

export function normalizeTextProviderId(rawProviderId: string | undefined): string {
  const id = String(rawProviderId || '').trim().toLowerCase();
  const normalized = PROVIDER_ALIASES[id] || id;
  return SUPPORTED_TEXT_PROVIDER_IDS.has(normalized) ? normalized : DEFAULT_TEXT_PROVIDER_ID;
}

export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] || providerId;
}

// ── runtime helpers ────────────────────────────────────
export function getProviderBaseUrl(providerId: string): string {
  switch (providerId) {
    case 'mimo': return MIMO_BASE_URL;
    default:     return OPENROUTER_BASE_URL;
  }
}

export function buildAuthHeaders(
  providerId: string,
  apiKey: string
): Record<string, string> {
  if (providerId === 'mimo') {
    return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  }
  // OpenRouter
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
    'X-Title': OPENROUTER_APP_TITLE
  };
}

/** Is this model id a MiMo model (provider-specific, not routed via OpenRouter)? */
export function isMimoModel(modelId: string): boolean {
  return modelId.startsWith('mimo-');
}

/** Placeholder hint shown in the model input for each provider. */
export function getModelPlaceholder(providerId: string): string {
  if (providerId === 'mimo') return 'mimo-v2.5-pro';
  return 'ex : qwen/qwen3.5-9b';
}
