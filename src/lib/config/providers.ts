export type ProviderCatalog = {
  id: string;
  name: string;
  models: string[];
  icon: string;
  recommended?: boolean;
  badges?: string[];
};

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  grok: 'Grok',
  ollama: 'Ollama',
  openrouter_img: 'OpenRouter Images',
  openai_img: 'OpenAI Images',
  fal_img: 'fal.ai',
  stability: 'Stability AI',
  none: 'Aucun provider'
};

export const DEFAULT_TEXT_PROVIDER_ID = 'openrouter';
export const DEFAULT_TEXT_MODEL_ID = 'qwen/qwen3.5-9b';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_IMAGE_PROVIDER_ID = 'none';
export const DEFAULT_IMAGE_MODEL_ID = '';
export const SUPPORTED_TEXT_PROVIDER_IDS = new Set<string>(['openrouter', 'none']);
export const LEGACY_TEXT_PROVIDER_IDS = new Set<string>(['openai', 'anthropic', 'mistral', 'grok', 'ollama']);

export const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1'
};

export const DEFAULT_TEXT_MODELS: Record<string, string> = {
  openrouter: 'qwen/qwen3.5-9b'
};

export const AGENTIC_TOOL_CALLING_PROVIDER_IDS = new Set<string>(['openrouter']);

const PROVIDER_ICONS: Record<string, string> = {
  openrouter: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"/></svg>`,
  openai: `<img src="/svg/openai-icon.svg" alt="" loading="lazy" decoding="async" />`,
  anthropic: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.304 3.541h-3.672L20.328 20.46H24zm-10.608 0L0 20.46h3.744l1.37-3.553h7.005l1.37 3.553h3.744L10.536 3.541Zm-.371 10.223 2.291-5.946 2.292 5.946z"/></svg>`,
  mistral: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z"/></svg>`,
  grok: `<img src="/svg/grok-ai-icon.svg" alt="" loading="lazy" decoding="async" />`,
  ollama: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="7" width="12" height="10" rx="3" fill="currentColor"/><circle cx="10" cy="12" r="1.5" fill="var(--color-bg-primary)"/><circle cx="14" cy="12" r="1.5" fill="var(--color-bg-primary)"/><path d="M9 4.5h2M13 4.5h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  fal_img: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M5 4h9M5 4v16M5 12h7"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M16 14l3 3-3 3M14 17h5"/></svg>`,
  stability: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 2 20h20L12 2Zm0 4.5L19.5 20h-15L12 6.5Z"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/></svg>`,
  none: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="1.5"/></svg>`,
  default: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
};

export function providerIconSvg(providerId: string): string {
  return PROVIDER_ICONS[providerId] ?? PROVIDER_ICONS.default;
}

export const TEXT_PROVIDERS: ProviderCatalog[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      'qwen/qwen3.5-9b',
      'google/gemma-3-27b-it:free',
      'google/gemma-4-26b-a4b-it',
      'google/gemma-4-31b-it',
      'meta-llama/llama-4-scout:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-small-3.2-24b-instruct:free',
      'qwen/qwen3-30b-a3b:free',
      'qwen/qwen3-235b-a22b:free',
      'xiaomi/mimo-v2-flash',
      'xiaomi/mimo-v2-omni',
      'x-ai/grok-4.1-fast',
      'x-ai/grok-4.20',
      'minimax/minimax-m2.7',
      'deepseek/deepseek-v3.2',
      'deepseek/deepseek-v4-flash',
      'moonshotai/kimi-k2.6',
      'openai/gpt-oss-120b',
      'google/gemini-2.5-flash-lite',
      'google/gemini-3-flash-preview',
      'mistralai/mistral-small-2603',
      'meta-llama/llama-4-maverick',
      'google/gemini-2.0-flash-001',
      'google/gemini-2.5-flash-preview',
      'openai/gpt-5.4-mini',
      'anthropic/claude-3-7-sonnet',
      'anthropic/claude-sonnet-4-5',
      'openai/gpt-5.4',
      'x-ai/grok-4',
      'google/gemini-2.5-pro',
      'anthropic/claude-opus-4-5',
      'openai/gpt-5'
    ],
    icon: providerIconSvg('openrouter'),
    recommended: true,
    badges: ['Orchestration à sous-agents', 'Catalogue unifié', 'Mode supporté']
  },
  { id: 'none', name: 'Aucun (texte manuel)', models: [], icon: providerIconSvg('none') }
];

export const IMAGE_PROVIDERS: ProviderCatalog[] = [
  {
    id: 'openrouter_img',
    name: 'OpenRouter Images',
    models: [
      'black-forest-labs/flux-1.1-pro',
      'black-forest-labs/flux-1.1-pro:ultra',
      'black-forest-labs/flux-1-schnell:free',
      'black-forest-labs/flux-1-dev',
      'recraft-ai/recraft-v3',
      'ideogram-ai/ideogram-v2',
      'openai/dall-e-3',
      'stabilityai/stable-diffusion-xl-base-1.0',
      'x-ai/grok-imagine-image-quality'
    ],
    icon: providerIconSvg('openrouter'),
    badges: ['Modèles d\'images', 'FLUX · Recraft · DALL-E']
  },
  {
    id: 'fal_img',
    name: 'fal.ai',
    models: [
      'fal-ai/flux-pro/v1.1-ultra',
      'fal-ai/flux-pro/v1.1',
      'fal-ai/flux/dev',
      'fal-ai/flux/schnell',
      'fal-ai/recraft-v3',
      'fal-ai/ideogram/v2',
      'fal-ai/stable-diffusion-3.5-large',
      'fal-ai/stable-diffusion-v3-medium'
    ],
    icon: providerIconSvg('fal_img'),
    badges: ['FLUX Pro', 'Recraft', 'SD 3.5']
  },
  {
    id: 'openai_img',
    name: 'OpenAI Images',
    models: ['dall-e-3', 'dall-e-2'],
    icon: providerIconSvg('openai'),
    badges: ['DALL-E 3', 'DALL-E 2']
  },
  {
    id: 'stability',
    name: 'Stability AI',
    models: ['stable-image-ultra', 'stable-image-core', 'sd3.5-large', 'sd3.5-medium'],
    icon: providerIconSvg('stability'),
    badges: ['SD 3.5', 'Ultra']
  },
  { id: 'none', name: 'Aucun (texte uniquement)', models: [], icon: providerIconSvg('none') }
];

export const TEXT_PROVIDER_ALIAS_MAP: Record<string, string> = {
  gemini: 'openrouter',
  groq: 'openrouter',
  xai: 'openrouter',
  together: 'openrouter',
  togetherai: 'openrouter',
  openai: 'openrouter',
  anthropic: 'openrouter',
  mistral: 'openrouter',
  grok: 'openrouter',
  ollama: 'openrouter'
};

export const IMAGE_PROVIDER_ALIAS_MAP: Record<string, string> = {
  openrouter: 'openrouter_img',
  openai: 'openai_img',
  flux: 'openrouter_img',
  together_img: 'openrouter_img'
};

export function normalizeTextProviderId(rawProviderId: string | undefined): string {
  const providerId = String(rawProviderId || '').trim().toLowerCase();
  const normalized = TEXT_PROVIDER_ALIAS_MAP[providerId] || providerId;
  return SUPPORTED_TEXT_PROVIDER_IDS.has(normalized) ? normalized : DEFAULT_TEXT_PROVIDER_ID;
}

export function normalizeImageProviderId(rawProviderId: string | undefined): string {
  const providerId = String(rawProviderId || '').trim().toLowerCase();
  return IMAGE_PROVIDER_ALIAS_MAP[providerId] || providerId;
}

export function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] || providerId;
}
