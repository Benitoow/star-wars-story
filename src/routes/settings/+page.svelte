<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { getPreferences, savePreferences, exportAllData, importAllData, emptyTrash, type UserPreferences } from '$lib/db';
  import { showToast, theme, uiLanguage } from '$lib/stores/ui';
  import { UI_LANGUAGE_OPTIONS, type UiLanguageCode } from '$lib/config/languages';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let preferences: UserPreferences | null = null;
  let loading = true;
  let saving = false;
  let importInput: HTMLInputElement | null = null;
  let confirmMessage = '';
  let confirmDanger = false;
  let pendingAction: (() => Promise<void>) | null = null;
  let pendingFile: File | null = null;

  // ── Wizard navigation ─────────────────────
  const SCREENS = [
    { id: 'ai_text', label: 'IA Texte', icon: '🤖' },
    { id: 'ai_image', label: 'IA Images', icon: '🎨' },
    { id: 'appearance', label: 'Apparence', icon: '🌙' },
    { id: 'data', label: 'Données', icon: '💾' }
  ];

  let currentScreen = 'ai_text';
  let slideDir = 1;

  function goTo(id: string) {
    const from = SCREENS.findIndex(s => s.id === currentScreen);
    const to   = SCREENS.findIndex(s => s.id === id);
    if (to === -1) return;
    slideDir = to >= (from === -1 ? 0 : from) ? 1 : -1;
    currentScreen = id;
  }

  type ProviderConfig = {
    id: string;
    name: string;
    models: string[];
    icon: string;
    recommended?: boolean;
    badges?: string[];
  };

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

  function providerIconSvg(providerId: string): string {
    return PROVIDER_ICONS[providerId] ?? PROVIDER_ICONS.default;
  }

  // ── Config data ───────────────────────────
  const TEXT_PROVIDERS: ProviderConfig[] = [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      models: [
        // ── Free tier ──
        'google/gemma-3-27b-it:free',
        'google/gemma-4-26b-a4b-it',
        'google/gemma-4-31b-it',
        'meta-llama/llama-4-scout:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'mistralai/mistral-small-3.2-24b-instruct:free',
        'qwen/qwen3-30b-a3b:free',
        'qwen/qwen3-235b-a22b:free',
        'xiaomi/mimo-v2-omni',
        // ── Milieu de gamme ──
        'x-ai/grok-4.1-fast',
        'deepseek/deepseek-v3.2',
        'mistralai/mistral-small-2603',
        'meta-llama/llama-4-maverick',
        'google/gemini-2.0-flash-001',
        'google/gemini-2.5-flash-preview',
        'openai/gpt-5.4-mini',
        'anthropic/claude-3-7-sonnet',
        // ── Premium ──
        'anthropic/claude-sonnet-4-5',
        'openai/gpt-5.4',
        'x-ai/grok-4',
        'google/gemini-2.5-pro',
        'anthropic/claude-opus-4-5',
        'openai/gpt-5',
      ],
      icon: providerIconSvg('openrouter'),
      recommended: true,
      badges: ['⚡ Agentique', 'Tool calling natif', '400+ modèles']
    },
    {
      id: 'openai',
      name: 'OpenAI',
      models: [
        'gpt-5.4',
        'gpt-5.4-mini',
        'gpt-5.4-nano',
        'gpt-5-mini',
        'gpt-5',
        'o4-mini',
        'o3',
      ],
      icon: providerIconSvg('openai'),
      badges: ['GPT-5.4 · o3', 'Vision', 'Fonctions']
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: [
        'claude-opus-4-5',
        'claude-sonnet-4-5',
        'claude-3-7-sonnet-latest',
      ],
      icon: providerIconSvg('anthropic'),
      badges: ['Claude 4', '200K tokens', 'Vision']
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      models: [
        'mistral-large-latest',
        'mistral-medium-3',
        'mistral-small-2603',
        'codestral-latest',
      ],
      icon: providerIconSvg('mistral'),
      badges: ['EU hébergé', 'Magistral', 'Codestral']
    },
    {
      id: 'grok',
      name: 'Grok / xAI',
      models: [
        'grok-4.1-fast',
        'grok-4',
        'grok-3-beta',
        'grok-3-mini-beta',
        'grok-2-vision-1212',
      ],
      icon: providerIconSvg('grok'),
      badges: ['Grok 4', '2M tokens', '⚡ Tool calling']
    },
    {
      id: 'ollama',
      name: 'Ollama (local)',
      models: [
        'llama4', 'llama3.3', 'gemma3', 'gemma3:12b',
        'qwen3.5', 'qwen3.5:32b', 'qwen3', 'phi4', 'phi4-mini',
        'glm4.7-air', 'glm4', 'mistral', 'deepseek-r1', 'codestral',
      ],
      icon: providerIconSvg('ollama'),
      badges: ['100% local', 'Sans clé API', '🔒 Vie privée']
    },
    { id: 'none', name: 'Aucun (texte manuel)', models: [], icon: providerIconSvg('none') }
  ];

  const IMAGE_PROVIDERS: ProviderConfig[] = [
    {
      id: 'openrouter_img',
      name: 'OpenRouter Images',
      models: [
        'google/gemini-2.5-flash-preview:thinking',
        'google/gemini-2.0-flash-exp:free',
        'openai/gpt-image-1',
        'openai/gpt-4o-image',
        'black-forest-labs/flux-1.1-pro',
        'black-forest-labs/flux-1.1-pro:ultra',
        'black-forest-labs/flux-1-schnell:free',
        'black-forest-labs/flux-1-dev',
        'recraft-ai/recraft-v3',
        'ideogram-ai/ideogram-v2',
      ],
      icon: providerIconSvg('openrouter'),
      badges: ['400+ modèles', 'Gemini · FLUX · GPT']
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
        'fal-ai/hidream-i1-full',
        'fal-ai/stable-diffusion-3.5-large',
        'fal-ai/stable-diffusion-v3-medium',
      ],
      icon: providerIconSvg('fal_img'),
      badges: ['FLUX Pro', 'HiDream', 'SD 3.5']
    },
    {
      id: 'openai_img',
      name: 'OpenAI Images',
      models: ['gpt-image-1'],
      icon: providerIconSvg('openai'),
      badges: ['GPT-Image-1']
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

  const WRITING_STYLES = [
    { id: 'cinematique', name: 'Cinématique',  desc: 'Scènes courtes, rythme intense, style film' },
    { id: 'litteraire',  name: 'Littéraire',   desc: 'Prose riche, descriptions profondes, introspection' },
    { id: 'epique',      name: 'Épique',        desc: 'Grandeur, batailles, destins héroïques' },
    { id: 'immersif',    name: 'Immersif',      desc: '2ème personne, style jeu de rôle, vous êtes le héros' },
  ];

  const WRITING_TONES = [
    { id: 'heroique', name: 'Héroïque',   desc: 'Courage, sacrifice, lumière' },
    { id: 'sombre',   name: 'Sombre',     desc: 'Tension, danger, ambiguïté morale' },
    { id: 'aventure', name: 'Aventure',   desc: 'Action, humour, légèreté' },
    { id: 'drame',    name: 'Dramatique', desc: 'Émotions, relations, trahisons' },
  ];

  const CONTENT_MODES = [
    { id: 'cinematic', name: 'Cinéma', desc: 'Intense mais équilibré. Adapté aux IA filtrées.', icon: '🎬' },
    { id: 'dark', name: 'Sombre', desc: 'Ambiance dure et tendue, sans gratuité excessive.', icon: '🌒' },
    { id: 'adult', name: 'Adulte', desc: 'Mature et frontal, selon les limites du provider choisi.', icon: '🔞' },
    { id: 'raw', name: 'Brut', desc: 'Très frontal et sans concession (quand le modèle le permet).', icon: '⚠️' },
  ];

  const AVATARS = ['🧑‍🚀', '👩‍🚀', '🧙', '🧙‍♀️', '⚔️', '🤖', '👾', '🦾', '🌌', '💫', '🔵', '🔴'];

  // ── Helpers ───────────────────────────────
  const IMAGE_MODEL_PATTERN = /(image|flux|sdxl|stable[-_\s]?diffusion|sd3|gpt-image|ideogram|recraft|kandinsky|sana|lumina|dall)/i;
  const TEXT_MODEL_PRIORITIES: Record<string, RegExp[]> = {
    openrouter: [
      // Free first
      /google\/gemma-4-26b-a4b-it/i,
      /google\/gemma-4-31b-it/i,
      /google\/gemma-3-27b-it/i,
      /meta-llama\/llama-4-scout.*free/i,
      /meta-llama\/llama-3\.3-70b.*free/i,
      /qwen\/qwen3-235b/i,
      /qwen\/qwen3/i,
      // Mid-range
      /x-ai\/grok-4\.1-fast/i,
      /deepseek\/deepseek-v3\.2/i,
      /mistralai\/mistral-small-2603/i,
      /meta-llama\/llama-4-maverick/i,
      /xiaomi\/mimo/i,
      // Premium
      /anthropic\/claude-(opus|sonnet)-4/i,
      /x-ai\/grok-4/i,
      /openai\/gpt-5\.4/i,
      /openai\/gpt-5/i,
      /google\/gemini-2\.5-pro/i,
    ],
    openai: [/^gpt-5\.4/i, /^gpt-5/i, /^o4/i, /^o3/i, /mini/i, /nano/i],
    anthropic: [/opus-4-5/i, /sonnet-4-5/i, /3-7-sonnet/i],
    mistral: [/mistral-large/i, /mistral-medium/i, /mistral-small/i, /codestral/i],
    grok: [/grok-4\.1-fast/i, /grok-4(?!\.)/i, /grok-3/i, /grok-2/i],
    ollama: [/^qwen3\.5/i, /^qwen3/i, /^glm4\.7-air/i, /^glm4/i, /^llama/i, /^gemma/i]
  };

  let dynamicTextModels: Record<string, string[]> = {};
  let dynamicImageModels: Record<string, string[]> = {};
  let syncingTextModels = false;
  let syncingImageModels = false;
  let syncTextMessage = '';
  let syncImageMessage = '';
  let textModelSearch = '';
  let imageModelSearch = '';

  let activeTextProviderId = '';
  let activeImageProviderId = '';
  let textProviderModels: string[] = [];
  let imageProviderModels: string[] = [];
  let normalizedTextSearch = '';
  let normalizedImageSearch = '';
  let filteredTextModels: string[] = [];
  let filteredImageModels: string[] = [];

  let textSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let imageSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTextSyncSignature = '';
  let lastImageSyncSignature = '';

  $: activeTextProviderId = preferences?.textProvider ?? '';
  $: activeImageProviderId = preferences?.imageProvider ?? '';
  $: textProviderModels = activeTextProviderId
    ? (dynamicTextModels[activeTextProviderId] ?? TEXT_PROVIDERS.find(p => p.id === activeTextProviderId)?.models ?? [])
    : [];
  $: imageProviderModels = activeImageProviderId
    ? (dynamicImageModels[activeImageProviderId] ?? IMAGE_PROVIDERS.find(p => p.id === activeImageProviderId)?.models ?? [])
    : [];

  $: providerModelCounts = Object.fromEntries(
    TEXT_PROVIDERS.map(p => [p.id, (dynamicTextModels[p.id] ?? p.models).length])
  );
  $: imageProviderModelCounts = Object.fromEntries(
    IMAGE_PROVIDERS.map(p => [p.id, (dynamicImageModels[p.id] ?? p.models).length])
  );

  $: normalizedTextSearch = textModelSearch.trim().toLowerCase();
  $: normalizedImageSearch = imageModelSearch.trim().toLowerCase();

  $: filteredTextModels = normalizedTextSearch
    ? textProviderModels.filter(model => model.toLowerCase().includes(normalizedTextSearch))
    : textProviderModels;

  $: filteredImageModels = normalizedImageSearch
    ? imageProviderModels.filter(model => model.toLowerCase().includes(normalizedImageSearch))
    : imageProviderModels;

  function shortModelName(model: string): string {
    // "google/gemma-3-27b-it:free" → "gemma-3-27b-it"
    // "anthropic/claude-sonnet-4.5" → "claude-sonnet-4.5"
    // "gpt-5-mini" → "gpt-5-mini"
    const afterSlash = model.includes('/') ? model.split('/').pop()! : model;
    return afterSlash.split(':')[0];
  }

  function uniqueSorted(models: string[]): string[] {
    return Array.from(new Set(models.map(m => m.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function getPriorityRank(model: string, patterns: RegExp[]): number {
    const index = patterns.findIndex(pattern => pattern.test(model));
    return index === -1 ? patterns.length + 1 : index;
  }

  function sortModelsForProvider(models: string[], providerId: string): string[] {
    const uniqueModels = Array.from(new Set(models.map(model => model.trim()).filter(Boolean)));
    const priorities = TEXT_MODEL_PRIORITIES[providerId] || [];

    return uniqueModels.sort((left, right) => {
      const rankDiff = getPriorityRank(left, priorities) - getPriorityRank(right, priorities);
      if (rankDiff !== 0) return rankDiff;
      return left.localeCompare(right);
    });
  }

  function normalizeOllamaUrl(url?: string): string {
    const source = (url || '').trim() || 'http://localhost:11434';
    return source.replace(/\/+$/, '');
  }

  function getTextProviderModels(providerId?: string): string[] {
    if (!providerId) return [];
    return dynamicTextModels[providerId] ?? TEXT_PROVIDERS.find(p => p.id === providerId)?.models ?? [];
  }

  function getImageProviderModels(providerId?: string): string[] {
    if (!providerId) return [];
    return dynamicImageModels[providerId] ?? IMAGE_PROVIDERS.find(p => p.id === providerId)?.models ?? [];
  }

  function scheduleAutoTextSync() {
    if (textSyncTimer) clearTimeout(textSyncTimer);
    textSyncTimer = setTimeout(() => {
      void refreshTextModels({ automatic: true });
    }, 300);
  }

  function scheduleAutoImageSync() {
    if (imageSyncTimer) clearTimeout(imageSyncTimer);
    imageSyncTimer = setTimeout(() => {
      void refreshImageModels({ automatic: true });
    }, 300);
  }

  function requireApiKey(key: string | undefined): string | null {
    const value = key?.trim() || '';
    if (!value) return null;
    return value;
  }

  async function fetchModelsFromJsonEndpoint(url: string, headers: Record<string, string> = {}): Promise<string[]> {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> };
    return uniqueSorted((payload.data || []).map(entry => String(entry?.id || '')).filter(Boolean));
  }

  async function refreshTextModels(options: { automatic?: boolean } = {}) {
    if (!preferences) return;
    const isAutomatic = options.automatic === true;

    const providerId = preferences.textProvider;
    if (!providerId || providerId === 'none') {
      syncTextMessage = '';
      return;
    }

    syncingTextModels = true;
    syncTextMessage = isAutomatic ? 'Synchronisation automatique des modèles…' : '';

    try {
      let models: string[] = [];

      if (providerId === 'ollama') {
        const ollamaUrl = normalizeOllamaUrl(preferences.ollamaUrl);
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { models?: Array<{ name?: string }> };
        models = uniqueSorted((payload.models || []).map(model => String(model?.name || '')).filter(Boolean));
      } else if (providerId === 'openrouter') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const optionalKey = preferences.textApiKey?.trim();
        if (optionalKey) headers.Authorization = `Bearer ${optionalKey}`;
        models = (await fetchModelsFromJsonEndpoint('https://openrouter.ai/api/v1/models', headers))
          .filter(model => !IMAGE_MODEL_PATTERN.test(model));
      } else if (providerId === 'openai') {
        const key = requireApiKey(preferences.textApiKey);
        if (!key) {
          syncTextMessage = 'Ajoute une clé API OpenAI pour charger les modèles en direct.';
          return;
        }
        models = (await fetchModelsFromJsonEndpoint('https://api.openai.com/v1/models', {
          Authorization: `Bearer ${key}`
        })).filter(model => /^(gpt|o\d)/i.test(model));
      } else if (providerId === 'anthropic') {
        const key = requireApiKey(preferences.textApiKey);
        if (!key) {
          syncTextMessage = 'Ajoute une clé API Anthropic pour charger les modèles en direct.';
          return;
        }
        models = (await fetchModelsFromJsonEndpoint('https://api.anthropic.com/v1/models', {
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        })).filter(model => /^claude/i.test(model));
      } else if (providerId === 'mistral') {
        const key = requireApiKey(preferences.textApiKey);
        if (!key) {
          syncTextMessage = 'Ajoute une clé API Mistral pour charger les modèles en direct.';
          return;
        }
        models = (await fetchModelsFromJsonEndpoint('https://api.mistral.ai/v1/models', {
          Authorization: `Bearer ${key}`
        })).filter(model => /(mistral|ministral|magistral|mixtral)/i.test(model));
      } else if (providerId === 'grok') {
        const key = requireApiKey(preferences.textApiKey);
        if (!key) {
          syncTextMessage = 'Ajoute une clé API Grok pour charger les modèles en direct.';
          return;
        }
        models = (await fetchModelsFromJsonEndpoint('https://api.x.ai/v1/models', {
          Authorization: `Bearer ${key}`
        })).filter(model => /grok/i.test(model));
      }

      if (!models.length) {
        throw new Error('Aucun modèle détecté');
      }

      models = sortModelsForProvider(models, providerId);

      dynamicTextModels = { ...dynamicTextModels, [providerId]: models };

      if (!models.includes(preferences.textModel || '')) {
        preferences.textModel = models[0] || '';
        preferences = { ...preferences };
      }

      syncTextMessage = `${models.length} modèles chargés automatiquement.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      syncTextMessage = `Impossible de charger les modèles (${message}).`;
    } finally {
      syncingTextModels = false;
    }
  }

  async function refreshImageModels(options: { automatic?: boolean } = {}) {
    if (!preferences) return;
    const isAutomatic = options.automatic === true;

    const providerId = preferences.imageProvider;
    if (!providerId || providerId === 'none') {
      syncImageMessage = '';
      return;
    }

    syncingImageModels = true;
    syncImageMessage = isAutomatic ? 'Synchronisation automatique des modèles image…' : '';

    try {
      let models: string[] = [];

      if (providerId === 'openrouter_img') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const key = (preferences.imageApiKey || preferences.textApiKey || '').trim();
        if (key) headers.Authorization = `Bearer ${key}`;

        const allModels = await fetchModelsFromJsonEndpoint('https://openrouter.ai/api/v1/models', headers);
        models = allModels.filter(model => IMAGE_MODEL_PATTERN.test(model));
      } else if (providerId === 'openai_img') {
        const key = requireApiKey(preferences.imageApiKey || preferences.textApiKey);
        if (!key) {
          syncImageMessage = 'Ajoute une clé API OpenAI pour charger les modèles image en direct.';
          return;
        }

        const allModels = await fetchModelsFromJsonEndpoint('https://api.openai.com/v1/models', {
          Authorization: `Bearer ${key}`
        });
        models = allModels.filter(model => /^gpt-image/i.test(model) || /image/i.test(model));

        if (!models.length) {
          models = ['gpt-image-1'];
        }
      } else {
        models = IMAGE_PROVIDERS.find(provider => provider.id === providerId)?.models || [];
      }

      models = uniqueSorted(models);
      if (!models.length) {
        throw new Error('Aucun modèle image détecté');
      }

      dynamicImageModels = { ...dynamicImageModels, [providerId]: models };

      if (!models.includes(preferences.imageModel || '')) {
        preferences.imageModel = models[0] || '';
        preferences = { ...preferences };
      }

      preferences.defaultImageProvider = preferences.imageProvider;
      preferences.defaultImgModel = preferences.imageModel;

      syncImageMessage = `${models.length} modèles image chargés automatiquement.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      syncImageMessage = `Impossible de charger les modèles image (${message}).`;
    } finally {
      syncingImageModels = false;
    }
  }

  $: if (preferences) {
    const signature = [
      preferences.textProvider || '',
      preferences.textApiKey || '',
      preferences.ollamaUrl || ''
    ].join('|');

    if (signature !== lastTextSyncSignature) {
      lastTextSyncSignature = signature;
      scheduleAutoTextSync();
    }
  }

  $: if (preferences) {
    const signature = [
      preferences.imageProvider || '',
      preferences.imageApiKey || '',
      preferences.textApiKey || ''
    ].join('|');

    if (signature !== lastImageSyncSignature) {
      lastImageSyncSignature = signature;
      scheduleAutoImageSync();
    }
  }

  function applyPreferenceDefaults(input: UserPreferences): UserPreferences {
    const next = { ...input };

    next.profiles = Array.isArray(next.profiles) ? next.profiles : [];
    if (!next.avatarEmoji) next.avatarEmoji = AVATARS[0];

    const textProviderAlias: Record<string, string> = {
      gemini: 'openrouter',
      groq: 'grok',
      together: 'openrouter'
    };
    const imageProviderAlias: Record<string, string> = {
      openai: 'openai_img',
      flux: 'openrouter_img',
      together_img: 'openrouter_img'
    };

    if (next.textProvider && textProviderAlias[next.textProvider]) {
      next.textProvider = textProviderAlias[next.textProvider];
    }

    if (next.imageProvider && imageProviderAlias[next.imageProvider]) {
      next.imageProvider = imageProviderAlias[next.imageProvider];
    }

    if (next.defaultImageProvider && imageProviderAlias[next.defaultImageProvider]) {
      next.defaultImageProvider = imageProviderAlias[next.defaultImageProvider];
    }

    const validTextProviderIds = new Set(TEXT_PROVIDERS.map(provider => provider.id));
    if (!next.textProvider || !validTextProviderIds.has(next.textProvider)) next.textProvider = 'openrouter';

    const textProvider = TEXT_PROVIDERS.find(p => p.id === next.textProvider);
    if (!next.textModel) {
      next.textModel = textProvider?.models[0] ?? '';
    }

    const legacyContentMode = (next as UserPreferences & { contentIntensity?: string }).contentIntensity;
    if (!next.contentMode && typeof legacyContentMode === 'string') {
      next.contentMode = legacyContentMode;
    }

    const contentModeAlias: Record<string, string> = {
      famille: 'cinematic',
      ado: 'dark',
      adulte: 'adult',
      libre: 'raw'
    };
    if (next.contentMode && contentModeAlias[next.contentMode]) {
      next.contentMode = contentModeAlias[next.contentMode];
    }

    if (!next.contentMode) next.contentMode = 'cinematic';
    if (!next.writingStyle) next.writingStyle = 'cinematique';
    if (!next.writingTone) next.writingTone = 'aventure';
    if (!next.writingPov) next.writingPov = 'troisieme';
    if (!next.writingLength) next.writingLength = 'moyen';

    const validImageProviderIds = new Set(IMAGE_PROVIDERS.map(provider => provider.id));
    if (!next.imageProvider) {
      next.imageProvider = next.defaultImageProvider || 'none';
    }
    if (!validImageProviderIds.has(next.imageProvider)) {
      next.imageProvider = 'none';
    }

    const imageProvider = IMAGE_PROVIDERS.find(p => p.id === next.imageProvider);
    if (!next.imageModel) {
      next.imageModel = next.defaultImgModel || imageProvider?.models[0] || '';
    }

    next.defaultImageProvider = next.imageProvider;
    next.defaultImgModel = next.imageModel;
    return next;
  }

  function selectTextProvider(providerId: string) {
    if (!preferences) return;
    preferences.textProvider = providerId;
    textModelSearch = '';

    const provider = TEXT_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    const availableModels = getTextProviderModels(providerId);

    if (!availableModels.includes(preferences.textModel || '')) {
      preferences.textModel = availableModels[0] ?? '';
    }

    if (providerId === 'none') {
      preferences.textModel = '';
      preferences.textApiKey = '';
      syncTextMessage = '';
    }

    if (providerId === 'ollama' && !preferences.ollamaUrl) {
      preferences.ollamaUrl = 'http://localhost:11434';
    }

    preferences = { ...preferences };
    scheduleAutoTextSync();
  }

  function selectImageProvider(providerId: string) {
    if (!preferences) return;
    preferences.imageProvider = providerId;
    imageModelSearch = '';

    const provider = IMAGE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    const availableModels = getImageProviderModels(providerId);

    if (!availableModels.includes(preferences.imageModel || '')) {
      preferences.imageModel = availableModels[0] ?? '';
    }

    if (providerId === 'none') {
      preferences.imageModel = '';
      preferences.imageApiKey = '';
      syncImageMessage = '';
    }

    preferences.defaultImageProvider = preferences.imageProvider;
    preferences.defaultImgModel = preferences.imageModel;

    preferences = { ...preferences };
    scheduleAutoImageSync();
  }

  function addProfile() {
    if (!preferences) return;
    const newProfile = {
      id: crypto.randomUUID(),
      name: 'Nouveau Profil',
      icon: '🚀',
      config: {}
    };
    preferences.profiles = [...preferences.profiles, newProfile];
  }

  function removeProfile(profileId: string) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.filter(p => p.id !== profileId);
  }

  function updateProfileName(profileId: string, name: string) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.map(p =>
      p.id === profileId ? { ...p, name } : p
    );
  }

  function updateProfileIcon(profileId: string, icon: string) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.map(p =>
      p.id === profileId ? { ...p, icon } : p
    );
  }

  function updateProfileConfig(
    profileId: string,
    key: keyof UserPreferences['profiles'][number]['config'],
    value: string
  ) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.map(profile =>
      profile.id === profileId
        ? { ...profile, config: { ...profile.config, [key]: value } }
        : profile
    );
  }

  onMount(async () => {
    try {
      preferences = applyPreferenceDefaults(await getPreferences());
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
    loading = false;
  });

  async function handleSave() {
    if (!preferences) return;
    saving = true;
    try {
      const normalized = applyPreferenceDefaults({ ...preferences });
      normalized.defaultImageProvider = normalized.imageProvider;
      normalized.defaultImgModel = normalized.imageModel;

      await savePreferences(normalized);
      preferences = normalized;

      uiLanguage.set(normalized.uiLanguage);
      theme.set(normalized.theme);
      showToast('Paramètres sauvegardés', 'success');
    } catch (e) {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
    saving = false;
  }

  async function handleExportData() {
    try {
      const payload = await exportAllData();
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `star-wars-story-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Sauvegarde exportée', 'success');
    } catch {
      showToast("Impossible d'exporter les données", 'error');
    }
  }

  function triggerImport() { importInput?.click(); }

  function getInputValue(event: Event): string {
    return (event.currentTarget as HTMLInputElement).value;
  }

  function getSelectValue(event: Event): string {
    return (event.currentTarget as HTMLSelectElement).value;
  }

  function getInputChecked(event: Event): boolean {
    return (event.currentTarget as HTMLInputElement).checked;
  }

  function getUiLanguageValue(event: Event): UiLanguageCode {
    return getSelectValue(event) as UiLanguageCode;
  }

  async function handleImportData(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    pendingFile = file;
    requestConfirm('Importer ce fichier remplacera toutes les données locales. Continuer ?', async () => {
      try {
        const payload = await pendingFile!.text();
        const counts = await importAllData(payload);
        showToast(`Import : ${counts.stories} histoires, ${counts.folders} dossiers`, 'success');
        window.location.reload();
      } catch {
        showToast("Impossible d'importer ce fichier", 'error');
      } finally {
        pendingFile = null;
        if (importInput) importInput.value = '';
      }
    }, false);
  }

  async function handleEmptyTrash() {
    requestConfirm('Supprimer définitivement toutes les histoires de la corbeille ?', async () => {
      try {
        await emptyTrash();
        showToast('Corbeille vidée', 'success');
      } catch {
        showToast('Impossible de vider la corbeille', 'error');
      }
    }, true);
  }

  function requestConfirm(message: string, action: () => Promise<void>, danger = false) {
    confirmMessage = message;
    confirmDanger = danger;
    pendingAction = action;
  }

  async function handleConfirm() {
    const action = pendingAction;
    pendingAction = null;
    if (action) await action();
  }

  function handleCancel() {
    pendingAction = null;
    pendingFile = null;
    if (importInput) importInput.value = '';
  }
</script>

<svelte:head>
  <title>Paramètres — Star Wars Story Manager</title>
</svelte:head>

{#if pendingAction}
  <ConfirmDialog
    message={confirmMessage}
    danger={confirmDanger}
    confirmLabel={confirmDanger ? 'Supprimer' : 'Confirmer'}
    on:confirm={handleConfirm}
    on:cancel={handleCancel}
  />
{/if}

<div class="settings-layout">
  <PageHeader title="Paramètres" showBack={true} on:back={() => goto('/')}>
    <button class="btn btn-primary save-btn" on:click={handleSave} disabled={saving || !preferences}>
      {#if saving}<span class="spinner"></span>{:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17,21 17,13 7,13 7,21"/>
          <polyline points="7,3 7,8 15,8"/>
        </svg>
      {/if}
      Sauvegarder
    </button>
  </PageHeader>

  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement...</p>
    </div>
  {:else if preferences}
    <div class="wizard">
      <!-- Left nav -->
      <nav class="wizard-nav">
        {#each SCREENS as s}
          <button
            class="nav-btn"
            class:active={currentScreen === s.id}
            on:click={() => goTo(s.id)}
          >
            <span class="nav-icon">{s.icon}</span>
            <span class="nav-label">{s.label}</span>
            {#if currentScreen === s.id}<span class="nav-dot"></span>{/if}
          </button>
        {/each}
      </nav>

      <!-- Screen area -->
      <div class="wizard-content">
        {#key currentScreen}
          <div
            class="screen"
            in:fly={{ x: slideDir * 60, duration: 220, opacity: 0 }}
            out:fly={{ x: -slideDir * 60, duration: 180, opacity: 0 }}
          >

            <!-- ── PROFIL ─────────────────────────── -->
            {#if currentScreen === 'profile'}
              <div class="screen-header">
                <h2>Votre profil</h2>
                <p>Ces informations personnalisent vos histoires</p>
              </div>

              <div class="avatar-row">
                {#each AVATARS as av}
                  <button
                    class="avatar-btn"
                    class:selected={preferences.avatarEmoji === av}
                    on:click={() => { if (preferences) preferences.avatarEmoji = av; }}
                  >{av}</button>
                {/each}
              </div>

              <div class="field-group">
                <div class="field">
                  <label>Prénom</label>
                  <input
                    type="text"
                    class="input"
                    placeholder="Luke"
                    bind:value={preferences.firstName}
                  />
                </div>
                <div class="field">
                  <label>Nom</label>
                  <input
                    type="text"
                    class="input"
                    placeholder="Skywalker"
                    bind:value={preferences.lastName}
                  />
                </div>
              </div>

              <div class="screen-footer">
                <button class="btn-next" on:click={() => goTo('ai_text')}>
                  Suivant : IA Texte →
                </button>
              </div>

            <!-- ── IA TEXTE ────────────────────────── -->
            {:else if currentScreen === 'ai_text'}
              <div class="screen-header">
                <h2>Modèle de texte</h2>
                <p>OpenRouter est recommandé (mode agentique + modèles récents). Profil, style et contenu se règlent désormais pendant la création.</p>
              </div>

              <div class="provider-grid">
                {#each TEXT_PROVIDERS as p}
                  <button
                    class="provider-card"
                    class:selected={preferences.textProvider === p.id}
                    on:click={() => selectTextProvider(p.id)}
                  >
                    <span class="provider-head">
                      <span class="provider-logo" aria-hidden="true">{@html p.icon}</span>
                      <span class="provider-name">{p.name}</span>
                    </span>
                    <span class="provider-models">{providerModelCounts[p.id] ?? p.models.length} modèles</span>
                    {#if preferences.textProvider === p.id && preferences.textModel}
                      <span class="provider-active-model" title={preferences.textModel}>
                        <svg viewBox="0 0 8 8" width="6" height="6"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
                        {shortModelName(preferences.textModel)}
                      </span>
                    {/if}
                    {#if p.recommended || (p.badges && p.badges.length)}
                      <span class="provider-badges">
                        {#if p.recommended}
                          <span class="provider-badge provider-badge-recommended">Recommandé</span>
                        {/if}
                        {#if p.badges}
                          {#each p.badges as badge}
                            <span class="provider-badge">{badge}</span>
                          {/each}
                        {/if}
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>

              {#if preferences.textProvider && preferences.textProvider !== 'none'}
                <div class="field-group">
                  {#if textProviderModels.length}
                    <div class="field model-picker-field">
                      <div class="model-picker-head">
                        <label>Modèle</label>
                        <span class="model-count">{textProviderModels.length} disponibles</span>
                      </div>
                      <input
                        type="search"
                        class="input model-search"
                        placeholder="Rechercher un modèle…"
                        bind:value={textModelSearch}
                      />
                      <div class="model-list" role="listbox" aria-label="Modèles IA texte disponibles">
                        {#if filteredTextModels.length}
                          {#each filteredTextModels as m}
                            <button
                              type="button"
                              class="model-option"
                              class:selected={preferences.textModel === m}
                              on:click={() => {
                                if (!preferences) return;
                                preferences.textModel = m;
                                preferences = { ...preferences };
                              }}
                            >
                              <span class="model-option-name">{m}</span>
                            </button>
                          {/each}
                        {:else}
                          <div class="model-empty">Aucun modèle ne correspond à « {textModelSearch} ».</div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  {#if preferences.textProvider !== 'ollama'}
                    <div class="field">
                      <label>Clé API</label>
                      <input
                        type="password"
                        class="input"
                        placeholder="sk-..."
                        bind:value={preferences.textApiKey}
                      />
                      <span class="field-hint">Stockée localement, jamais envoyée à nos serveurs</span>
                    </div>
                  {:else}
                    <div class="field">
                      <label>URL Ollama</label>
                      <input
                        type="text"
                        class="input"
                        placeholder="http://localhost:11434"
                        bind:value={preferences.ollamaUrl}
                      />
                    </div>
                  {/if}

                  <div class="field provider-tools">
                    {#if syncingTextModels}
                      <span class="field-hint">Synchronisation automatique des modèles…</span>
                    {:else if syncTextMessage}
                      <span class="field-hint">{syncTextMessage}</span>
                    {/if}
                  </div>
                </div>
              {/if}

              <div class="screen-footer">
                <button class="btn-next" on:click={() => goTo('ai_image')}>Suivant : IA Images →</button>
              </div>

            <!-- ── IA IMAGES ───────────────────────── -->
            {:else if currentScreen === 'ai_image'}
              <div class="screen-header">
                <h2>Génération d'images</h2>
                <p>Illustrez automatiquement vos scènes clés</p>
              </div>

              <div class="provider-grid">
                {#each IMAGE_PROVIDERS as p}
                  <button
                    class="provider-card"
                    class:selected={preferences.imageProvider === p.id}
                    on:click={() => selectImageProvider(p.id)}
                  >
                    <span class="provider-head">
                      <span class="provider-logo" aria-hidden="true">{@html p.icon}</span>
                      <span class="provider-name">{p.name}</span>
                    </span>
                    <span class="provider-models">{imageProviderModelCounts[p.id] ?? p.models.length} modèles</span>
                    {#if preferences.imageProvider === p.id && preferences.imageModel}
                      <span class="provider-active-model" title={preferences.imageModel}>
                        <svg viewBox="0 0 8 8" width="6" height="6"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
                        {shortModelName(preferences.imageModel)}
                      </span>
                    {/if}
                    {#if p.badges && p.badges.length}
                      <span class="provider-badges">
                        {#each p.badges as badge}
                          <span class="provider-badge">{badge}</span>
                        {/each}
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>

              {#if preferences.imageProvider && preferences.imageProvider !== 'none'}
                <div class="field-group">
                  {#if imageProviderModels.length}
                    <div class="field model-picker-field">
                      <div class="model-picker-head">
                        <label>Modèle</label>
                        <span class="model-count">{imageProviderModels.length} disponibles</span>
                      </div>
                      <input
                        type="search"
                        class="input model-search"
                        placeholder="Rechercher un modèle image…"
                        bind:value={imageModelSearch}
                      />
                      <div class="model-list" role="listbox" aria-label="Modèles IA image disponibles">
                        {#if filteredImageModels.length}
                          {#each filteredImageModels as m}
                            <button
                              type="button"
                              class="model-option"
                              class:selected={preferences.imageModel === m}
                              on:click={() => {
                                if (!preferences) return;
                                preferences.imageModel = m;
                                preferences.defaultImgModel = m;
                                preferences = { ...preferences };
                              }}
                            >
                              <span class="model-option-name">{m}</span>
                            </button>
                          {/each}
                        {:else}
                          <div class="model-empty">Aucun modèle ne correspond à « {imageModelSearch} ».</div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                  <div class="field">
                    <label>Clé API</label>
                    <input
                      type="password"
                      class="input"
                      placeholder="Votre clé API..."
                      bind:value={preferences.imageApiKey}
                    />
                    <span class="field-hint">Stockée localement, jamais envoyée à nos serveurs</span>
                  </div>

                  <div class="field provider-tools">
                    {#if syncingImageModels}
                      <span class="field-hint">Synchronisation automatique des modèles image…</span>
                    {:else if syncImageMessage}
                      <span class="field-hint">{syncImageMessage}</span>
                    {/if}
                  </div>
                </div>
              {/if}

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('ai_text')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('appearance')}>Suivant : Apparence →</button>
              </div>

            <!-- ── STYLE ──────────────────────────── -->
            {:else if currentScreen === 'style'}
              <div class="screen-header">
                <h2>Style d'écriture</h2>
                <p>Comment vos histoires seront rédigées</p>
              </div>

              <div class="field-section">
                <h3>Format narratif</h3>
                <div class="option-grid">
                  {#each WRITING_STYLES as s}
                    <button
                      class="option-card"
                      class:selected={preferences.writingStyle === s.id}
                      on:click={() => { if (preferences) preferences.writingStyle = s.id; }}
                    >
                      <span class="option-name">{s.name}</span>
                      <span class="option-desc">{s.desc}</span>
                    </button>
                  {/each}
                </div>
              </div>

              <div class="field-section">
                <h3>Ton de l'histoire</h3>
                <div class="option-grid">
                  {#each WRITING_TONES as t}
                    <button
                      class="option-card"
                      class:selected={preferences.writingTone === t.id}
                      on:click={() => { if (preferences) preferences.writingTone = t.id; }}
                    >
                      <span class="option-name">{t.name}</span>
                      <span class="option-desc">{t.desc}</span>
                    </button>
                  {/each}
                </div>
              </div>

              <div class="field-group">
                <div class="field">
                  <label>Point de vue</label>
                  <div class="btn-toggle-group">
                    <button
                      class="btn-toggle"
                      class:active={preferences.writingPov === 'premiere' || !preferences.writingPov}
                      on:click={() => { if (preferences) preferences.writingPov = 'premiere'; }}
                    >1ère personne — Je</button>
                    <button
                      class="btn-toggle"
                      class:active={preferences.writingPov === 'troisieme'}
                      on:click={() => { if (preferences) preferences.writingPov = 'troisieme'; }}
                    >3ème personne — Il/Elle</button>
                  </div>
                </div>

                <div class="field">
                  <label>Longueur des passages</label>
                  <div class="btn-toggle-group">
                    <button class="btn-toggle" class:active={preferences.writingLength === 'court'} on:click={() => { if (preferences) preferences.writingLength = 'court'; }}>Court</button>
                    <button class="btn-toggle" class:active={preferences.writingLength === 'moyen' || !preferences.writingLength} on:click={() => { if (preferences) preferences.writingLength = 'moyen'; }}>Moyen</button>
                    <button class="btn-toggle" class:active={preferences.writingLength === 'long'} on:click={() => { if (preferences) preferences.writingLength = 'long'; }}>Long</button>
                  </div>
                </div>
              </div>

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('ai_image')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('content')}>Suivant : Contenu →</button>
              </div>

            <!-- ── CONTENU ─────────────────────────── -->
            {:else if currentScreen === 'content'}
              <div class="screen-header">
                <h2>Mode narratif / censure IA</h2>
                <p>Définissez l'intensité selon les limites de votre modèle et le ton souhaité</p>
              </div>

              <div class="content-mode-list">
                {#each CONTENT_MODES as mode}
                  <button
                    class="content-mode-card"
                    class:selected={preferences.contentMode === mode.id}
                    on:click={() => { if (preferences) preferences.contentMode = mode.id; }}
                  >
                    <span class="mode-icon">{mode.icon}</span>
                    <div class="mode-info">
                      <span class="mode-name">{mode.name}</span>
                      <span class="mode-desc">{mode.desc}</span>
                    </div>
                    {#if preferences.contentMode === mode.id}
                      <span class="mode-check">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('style')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('profiles')}>Suivant : Profils →</button>
              </div>

            <!-- ── PROFILS CRÉATIFS ────────────────── -->
            {:else if currentScreen === 'profiles'}
              <div class="screen-header">
                <h2>Profils créatifs</h2>
                <p>Retrouvez vos presets d'univers, de faction et de style de départ</p>
              </div>

              <div class="profiles-grid">
                {#each preferences.profiles as profile (profile.id)}
                  <div class="profile-card">
                    <div class="profile-header">
                      <input
                        type="text"
                        class="profile-icon-input"
                        value={profile.icon}
                        maxlength="4"
                        on:input={(e) => updateProfileIcon(profile.id, getInputValue(e))}
                        aria-label="Icône du profil"
                      />

                      <input
                        type="text"
                        class="profile-name"
                        value={profile.name}
                        on:input={(e) => updateProfileName(profile.id, getInputValue(e))}
                      />

                      <button class="profile-delete" on:click={() => removeProfile(profile.id)} aria-label="Supprimer le profil">
                        ✕
                      </button>
                    </div>

                    <div class="profile-fields">
                      <div class="profile-field">
                        <label>Ère par défaut</label>
                        <select
                          class="select"
                          value={profile.config.defaultEra || ''}
                          on:change={(e) => updateProfileConfig(profile.id, 'defaultEra', getSelectValue(e))}
                        >
                          <option value="">Aucune</option>
                          <option value="old_republic">Ancienne République</option>
                          <option value="clone_wars">Guerres des Clones</option>
                          <option value="imperial">Ère Impériale</option>
                          <option value="new_republic">Nouvelle République</option>
                          <option value="first_order">Premier Ordre</option>
                        </select>
                      </div>

                      <div class="profile-field">
                        <label>Faction par défaut</label>
                        <select
                          class="select"
                          value={profile.config.defaultFaction || ''}
                          on:change={(e) => updateProfileConfig(profile.id, 'defaultFaction', getSelectValue(e))}
                        >
                          <option value="">Aucune</option>
                          <option value="jedi">Ordre Jedi</option>
                          <option value="sith">Ordre Sith</option>
                          <option value="empire">Empire</option>
                          <option value="rebels">Alliance Rebelle</option>
                          <option value="republic">République</option>
                          <option value="mandalore">Mandaloriens</option>
                          <option value="first_order">Premier Ordre</option>
                          <option value="hutt">Cartel Hutt</option>
                          <option value="neutral">Indépendant</option>
                        </select>
                      </div>
                    </div>
                  </div>
                {/each}

                <button class="add-profile-btn" on:click={addProfile}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Ajouter un profil
                </button>
              </div>

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('content')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('shortcuts')}>Suivant : Raccourcis →</button>
              </div>

            <!-- ── RACCOURCIS ─────────────────────── -->
            {:else if currentScreen === 'shortcuts'}
              <div class="screen-header">
                <h2>Raccourcis clavier</h2>
                <p>Les raccourcis actifs hérités de la version précédente</p>
              </div>

              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <span class="shortcut-action">Nouvelle histoire</span>
                  <kbd class="shortcut-key">{preferences.shortcuts.newStory || 'Ctrl+N'}</kbd>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-action">Sauvegarder</span>
                  <kbd class="shortcut-key">{preferences.shortcuts.saveStory || 'Ctrl+S'}</kbd>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-action">Rechercher</span>
                  <kbd class="shortcut-key">{preferences.shortcuts.search || 'Ctrl+F'}</kbd>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-action">Afficher / masquer la barre latérale</span>
                  <kbd class="shortcut-key">{preferences.shortcuts.toggleSidebar || 'Ctrl+B'}</kbd>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-action">Paramètres</span>
                  <kbd class="shortcut-key">{preferences.shortcuts.settings || 'Ctrl+,'}</kbd>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-action">Aide</span>
                  <kbd class="shortcut-key">{preferences.shortcuts.help || '?'}</kbd>
                </div>
              </div>

              <span class="field-hint">Édition avancée des raccourcis à venir — affichage et conservation des valeurs actuelles.</span>

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('profiles')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('appearance')}>Suivant : Apparence →</button>
              </div>

            <!-- ── APPARENCE ───────────────────────── -->
            {:else if currentScreen === 'appearance'}
              <div class="screen-header">
                <h2>Apparence</h2>
                <p>Personnalisez l'interface</p>
              </div>

              <div class="field-group">
                <div class="field">
                  <label>Thème</label>
                  <div class="btn-toggle-group">
                    <button class="btn-toggle" class:active={preferences.theme === 'dark'} on:click={() => { if (preferences) { preferences.theme = 'dark'; theme.set('dark'); } }}>
                      🌑 Sombre
                    </button>
                    <button class="btn-toggle" class:active={preferences.theme === 'light'} on:click={() => { if (preferences) { preferences.theme = 'light'; theme.set('light'); } }}>
                      ☀️ Clair
                    </button>
                    <button class="btn-toggle" class:active={preferences.theme === 'auto'} on:click={() => { if (preferences) { preferences.theme = 'auto'; theme.set('auto'); } }}>
                      🖥️ Auto
                    </button>
                  </div>
                </div>

                <div class="field">
                  <label>Langue de l'interface</label>
                  <select
                    class="select"
                    value={preferences.uiLanguage}
                    on:change={(e) => { if (preferences) { preferences.uiLanguage = getUiLanguageValue(e); uiLanguage.set(preferences.uiLanguage); } }}
                  >
                    {#each UI_LANGUAGE_OPTIONS as lang}
                      <option value={lang.code}>{lang.name}</option>
                    {/each}
                  </select>
                </div>

                <div class="field">
                  <label>Sauvegarde automatique</label>
                  <label class="toggle">
                    <input type="checkbox" checked={preferences.autoSave}
                      on:change={(e) => { if (preferences) preferences.autoSave = getInputChecked(e); }} />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

                {#if preferences.autoSave}
                  <div class="field">
                    <label>Intervalle</label>
                    <select class="select" bind:value={preferences.autoSaveInterval}>
                      <option value={15000}>15 secondes</option>
                      <option value={30000}>30 secondes</option>
                      <option value={60000}>1 minute</option>
                      <option value={120000}>2 minutes</option>
                      <option value={300000}>5 minutes</option>
                    </select>
                  </div>
                {/if}
              </div>

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('ai_image')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('data')}>Suivant : Données →</button>
              </div>

            <!-- ── DONNÉES ─────────────────────────── -->
            {:else if currentScreen === 'data'}
              <div class="screen-header">
                <h2>Gestion des données</h2>
                <p>Exportez, importez ou effacez vos données locales</p>
              </div>

              <div class="data-actions">
                <div class="data-card">
                  <div class="data-card-info">
                    <span class="data-card-title">Exporter toutes les données</span>
                    <span class="data-card-desc">Téléchargez une sauvegarde complète au format JSON</span>
                  </div>
                  <button class="btn btn-secondary" on:click={handleExportData}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Exporter
                  </button>
                </div>

                <div class="data-card">
                  <div class="data-card-info">
                    <span class="data-card-title">Importer des données</span>
                    <span class="data-card-desc">Restaurer depuis un fichier de sauvegarde (remplace tout)</span>
                  </div>
                  <input bind:this={importInput} type="file" accept="application/json" style="display:none" on:change={handleImportData} />
                  <button class="btn btn-secondary" on:click={triggerImport}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17,8 12,3 7,8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Importer
                  </button>
                </div>

                <div class="data-card danger">
                  <div class="data-card-info">
                    <span class="data-card-title danger-text">Vider la corbeille</span>
                    <span class="data-card-desc">Suppression définitive de toutes les histoires supprimées</span>
                  </div>
                  <button class="btn btn-danger" on:click={handleEmptyTrash}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    Vider
                  </button>
                </div>
              </div>

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('appearance')}>← Retour</button>
              </div>
            {/if}

          </div>
        {/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--space-md);
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Wizard ──────────────────────────────── */
  .wizard {
    display: flex;
    flex: 1;
    gap: 0;
    overflow: hidden;
  }

  .wizard-nav {
    width: 180px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-lg) var(--space-md);
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    position: relative;
    width: 100%;
  }

  .nav-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .nav-btn.active {
    background: rgba(255, 232, 31, 0.1);
    color: var(--color-gold);
    font-weight: 600;
  }

  .nav-icon { font-size: 1rem; flex-shrink: 0; }
  .nav-label { flex: 1; }

  .nav-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-gold);
    flex-shrink: 0;
  }

  .wizard-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .screen {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    padding: var(--space-xl) var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  /* ── Screen header ───────────────────────── */
  .screen-header h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--color-text-primary);
    margin-bottom: var(--space-xs);
  }

  .screen-header p {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  /* ── Profile ─────────────────────────────── */
  .avatar-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .avatar-btn {
    width: 48px;
    height: 48px;
    font-size: 1.5rem;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-btn:hover, .avatar-btn.selected {
    border-color: var(--color-gold);
    background: rgba(255, 232, 31, 0.1);
  }

  /* ── Fields ──────────────────────────────── */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .field label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
  }

  .input {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: 0.9375rem;
    transition: border-color var(--transition-fast);
  }

  .input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .select {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .select:focus { outline: none; border-color: var(--color-gold); }

  .field-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* ── Provider grid ───────────────────────── */
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-md);
  }

  .provider-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .provider-card:hover { border-color: var(--color-gold); transform: translateY(-2px); }
  .provider-card.selected {
    border-color: var(--color-gold);
    background: rgba(255, 232, 31, 0.08);
  }

  .provider-head {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
  }

  .provider-logo {
    width: 20px;
    height: 20px;
    color: var(--color-text-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .provider-logo :global(svg) {
    width: 20px;
    height: 20px;
    display: block;
  }

  .provider-logo :global(img) {
    width: 20px;
    height: 20px;
    object-fit: contain;
    display: block;
  }

  .provider-name {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .provider-models {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .provider-badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }

  .provider-badge {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.68rem;
    line-height: 1.2;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
  }

  .provider-badge-recommended {
    border-color: rgba(255, 232, 31, 0.5);
    color: var(--color-gold);
    background: rgba(255, 232, 31, 0.12);
  }

  .provider-active-model {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #4ade80;
    font-family: var(--font-mono, monospace);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .provider-active-model svg {
    flex-shrink: 0;
    color: #4ade80;
  }

  .provider-tools {
    gap: var(--space-xs);
  }

  .model-picker-field {
    gap: var(--space-sm);
  }

  .model-picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .model-count {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .model-search {
    font-size: 0.875rem;
  }

  .model-list {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-tertiary);
    padding: var(--space-xs);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .model-option {
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: var(--space-xs) var(--space-sm);
    transition: all var(--transition-fast);
  }

  .model-option:hover {
    border-color: var(--color-border-hover);
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .model-option.selected {
    border-color: var(--color-gold);
    background: rgba(255, 232, 31, 0.1);
    color: var(--color-gold);
  }

  .model-option-name {
    font-size: 0.8rem;
    font-family: var(--font-mono);
    word-break: break-word;
  }

  .model-empty {
    padding: var(--space-sm);
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  /* ── Option grid (style/tone) ────────────── */
  .field-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .field-section h3 {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
  }

  .option-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-md);
  }

  .option-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .option-card:hover { border-color: var(--color-gold); }
  .option-card.selected { border-color: var(--color-gold); background: rgba(255, 232, 31, 0.08); }

  .option-name { font-weight: 600; color: var(--color-text-primary); font-size: 0.875rem; }
  .option-desc { font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.4; }

  /* ── Toggle group ────────────────────────── */
  .btn-toggle-group {
    display: flex;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
    gap: 2px;
    width: fit-content;
  }

  .btn-toggle {
    padding: var(--space-sm) var(--space-lg);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .btn-toggle:hover { color: var(--color-text-primary); }
  .btn-toggle.active { background: var(--color-bg-elevated); color: var(--color-gold); font-weight: 600; }

  /* ── Toggle switch ───────────────────────── */
  .toggle {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
  }

  .toggle input { opacity: 0; width: 0; height: 0; }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--color-bg-tertiary);
    border-radius: 24px;
    transition: all var(--transition-fast);
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: var(--color-text-muted);
    border-radius: 50%;
    transition: all var(--transition-fast);
  }

  .toggle input:checked + .toggle-slider { background: var(--color-gold); }
  .toggle input:checked + .toggle-slider::before { transform: translateX(24px); background: var(--color-bg-primary); }

  /* ── Content modes ───────────────────────── */
  .content-mode-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .content-mode-card {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
    width: 100%;
  }

  .content-mode-card:hover { border-color: var(--color-gold); }
  .content-mode-card.selected { border-color: var(--color-gold); background: rgba(255, 232, 31, 0.06); }

  .mode-icon { font-size: 1.5rem; flex-shrink: 0; }
  .mode-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .mode-name { font-weight: 600; color: var(--color-text-primary); }
  .mode-desc { font-size: 0.8rem; color: var(--color-text-muted); }
  .mode-check { color: var(--color-gold); font-size: 1.1rem; font-weight: 700; }

  /* ── Data ────────────────────────────────── */
  .data-actions { display: flex; flex-direction: column; gap: var(--space-md); }

  .data-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .data-card.danger { border-color: rgba(255, 23, 68, 0.3); }

  .data-card-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .data-card-title { font-weight: 600; color: var(--color-text-primary); font-size: 0.9rem; }
  .data-card-desc { font-size: 0.75rem; color: var(--color-text-muted); }
  .danger-text { color: var(--color-red); }

  /* ── Profiles & shortcuts ────────────────── */
  .profiles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-md);
  }

  .profile-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .profile-icon-input {
    width: 44px;
    text-align: center;
    padding: var(--space-xs);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-size: 1.25rem;
  }

  .profile-name {
    flex: 1;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .profile-name:focus,
  .profile-icon-input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .profile-delete {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .profile-delete:hover {
    border-color: var(--color-red);
    color: var(--color-red);
    background: rgba(239, 68, 68, 0.08);
  }

  .profile-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .profile-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .profile-field label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--color-text-muted);
  }

  .profile-field .select {
    width: 100%;
  }

  .add-profile-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    min-height: 130px;
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: var(--font-display);
  }

  .add-profile-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .add-profile-btn svg {
    width: 18px;
    height: 18px;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .shortcut-action {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .shortcut-key {
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: nowrap;
  }

  /* ── Screen footer ───────────────────────── */
  .screen-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border);
    margin-top: auto;
  }

  .btn-next {
    padding: var(--space-sm) var(--space-xl);
    background: var(--color-gold);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-bg-primary);
    font-weight: 700;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: var(--font-display);
    letter-spacing: 0.5px;
  }

  .btn-next:hover { opacity: 0.9; transform: translateX(2px); }

  .btn-back {
    padding: var(--space-sm) var(--space-lg);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-back:hover { border-color: var(--color-gold); color: var(--color-text-primary); }

  .save-btn { gap: var(--space-sm); display: flex; align-items: center; }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-bg-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* ── Mobile ──────────────────────────────── */
  @media (max-width: 768px) {
    .wizard { flex-direction: column; }
    .wizard-nav {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
      padding: var(--space-sm);
      gap: 4px;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }
    .nav-btn {
      flex-direction: column;
      min-width: 64px;
      gap: 2px;
      padding: var(--space-xs) var(--space-sm);
      font-size: 0.65rem;
      text-align: center;
    }
    .nav-label { font-size: 0.6rem; flex: none; }
    .nav-dot { display: none; }
    .wizard-content { overflow-y: auto; }
    .screen { padding: var(--space-lg) var(--space-md); }
    .option-grid, .provider-grid { grid-template-columns: 1fr 1fr !important; }
    .profiles-grid { grid-template-columns: 1fr; }
    .shortcut-item { flex-direction: column; align-items: flex-start; }
  }
</style>
