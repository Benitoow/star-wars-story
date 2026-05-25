/* Text provider config. The app is single-provider (OpenRouter); models are
   loaded dynamically from the OpenRouter API once a key is set. 'none' = manual. */

export const DEFAULT_TEXT_PROVIDER_ID = 'openrouter';
export const DEFAULT_TEXT_MODEL_ID = 'qwen/qwen3.5-9b';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_APP_TITLE = 'Star Wars Story';

export const SUPPORTED_TEXT_PROVIDER_IDS = new Set<string>(['openrouter', 'none']);

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openrouter: 'OpenRouter',
  none: 'Aucun provider'
};

// Any legacy/aliased provider id folds onto OpenRouter (the only real backend).
const PROVIDER_ALIASES: Record<string, string> = {
  openai: 'openrouter', anthropic: 'openrouter', mistral: 'openrouter',
  grok: 'openrouter', xai: 'openrouter', gemini: 'openrouter',
  groq: 'openrouter', together: 'openrouter', ollama: 'openrouter'
};

export function normalizeTextProviderId(rawProviderId: string | undefined): string {
  const id = String(rawProviderId || '').trim().toLowerCase();
  const normalized = PROVIDER_ALIASES[id] || id;
  return SUPPORTED_TEXT_PROVIDER_IDS.has(normalized) ? normalized : DEFAULT_TEXT_PROVIDER_ID;
}

export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] || providerId;
}
