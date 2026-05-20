<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { getPreferences, savePreferences, exportAllData, importAllData, emptyTrash, type UserPreferences } from '$lib/db';
  import { showToast, theme, uiLanguage } from '$lib/stores/ui';
  import { UI_LANGUAGE_OPTIONS, type UiLanguageCode } from '$lib/config/languages';
  import {
    DEFAULT_IMAGE_MODEL_ID,
    DEFAULT_IMAGE_PROVIDER_ID,
    DEFAULT_TEXT_MODEL_ID,
    DEFAULT_TEXT_PROVIDER_ID,
    IMAGE_PROVIDER_ALIAS_MAP,
    IMAGE_PROVIDERS,
    TEXT_PROVIDER_ALIAS_MAP,
    TEXT_PROVIDERS
  } from '$lib/config/providers';
  const REASONING_EFFORTS = ['xhigh', 'high', 'medium', 'low', 'minimal', 'none'] as const;
  import { AVATARS, CONTENT_MODES, WRITING_STYLES, WRITING_TONES } from '$lib/editor/setupCatalog';
  import { exportDiagnosticsLog, logger, recordDiagnosticEvent } from '$lib/utils/logger';
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
    ]
  };

  let dynamicTextModels: Record<string, string[]> = {};
  let dynamicImageModels: Record<string, string[]> = {};
  let reasoningCapableModels: Set<string> = new Set();
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

  $: activeModelSupportsReasoning = reasoningCapableModels.size > 0
    && reasoningCapableModels.has(preferences?.textModel ?? '');

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

      if (providerId === 'openrouter') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const optionalKey = preferences.textApiKey?.trim();
        if (optionalKey) headers.Authorization = `Bearer ${optionalKey}`;
        const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { data?: Array<{ id?: string; supported_parameters?: string[] }> };
        const entries = payload.data || [];
        const capable = new Set<string>();
        for (const entry of entries) {
          if (entry.id && entry.supported_parameters?.includes('reasoning')) capable.add(entry.id);
        }
        reasoningCapableModels = capable;
        models = uniqueSorted(entries.map(e => String(e?.id || '')).filter(Boolean))
          .filter(model => !IMAGE_MODEL_PATTERN.test(model));
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
      preferences.textApiKey || ''
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

    if (next.textProvider && TEXT_PROVIDER_ALIAS_MAP[next.textProvider]) {
      next.textProvider = TEXT_PROVIDER_ALIAS_MAP[next.textProvider];
    }

    if (next.imageProvider && IMAGE_PROVIDER_ALIAS_MAP[next.imageProvider]) {
      next.imageProvider = IMAGE_PROVIDER_ALIAS_MAP[next.imageProvider];
    }

    if (next.defaultImageProvider && IMAGE_PROVIDER_ALIAS_MAP[next.defaultImageProvider]) {
      next.defaultImageProvider = IMAGE_PROVIDER_ALIAS_MAP[next.defaultImageProvider];
    }

    const validTextProviderIds = new Set(TEXT_PROVIDERS.map(provider => provider.id));
    if (!next.textProvider || !validTextProviderIds.has(next.textProvider)) next.textProvider = DEFAULT_TEXT_PROVIDER_ID;

    if (next.textRuntimeMode !== 'structured-json' && next.textRuntimeMode !== 'agentic-subagents') {
      next.textRuntimeMode = 'agentic-subagents';
    }

    const textProvider = TEXT_PROVIDERS.find(p => p.id === next.textProvider);
    if (!next.textModel) {
      next.textModel = textProvider?.models[0] ?? DEFAULT_TEXT_MODEL_ID;
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
      next.imageProvider = next.defaultImageProvider || DEFAULT_IMAGE_PROVIDER_ID;
    }
    if (!validImageProviderIds.has(next.imageProvider)) {
      next.imageProvider = DEFAULT_IMAGE_PROVIDER_ID;
    }

    const imageProvider = IMAGE_PROVIDERS.find(p => p.id === next.imageProvider);
    if (!next.imageModel) {
      next.imageModel = next.defaultImgModel || imageProvider?.models[0] || DEFAULT_IMAGE_MODEL_ID;
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
      logger.error('settings: chargement des préférences échoué.', e);
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
      recordDiagnosticEvent({
        level: 'error',
        category: 'settings',
        stage: 'save',
        message: 'Échec de sauvegarde des paramètres.',
        validation: 'failed',
        meta: e
      });
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
    } catch (error) {
      recordDiagnosticEvent({
        level: 'error',
        category: 'settings',
        stage: 'export-data',
        message: "Échec d'export des données.",
        validation: 'failed',
        meta: error
      });
      showToast("Impossible d'exporter les données", 'error');
    }
  }

  async function handleExportDiagnostics() {
    try {
      const payload = exportDiagnosticsLog();
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `star-wars-story-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Journal de diagnostics exporté', 'success');
    } catch (error) {
      logger.error('settings: export diagnostics failed.', error);
      showToast("Impossible d'exporter les diagnostics", 'error');
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
      } catch (error) {
        recordDiagnosticEvent({
          level: 'error',
          category: 'settings',
          stage: 'import-data',
          message: "Échec d'import des données.",
          validation: 'failed',
          meta: error
        });
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
      } catch (error) {
        recordDiagnosticEvent({
          level: 'error',
          category: 'settings',
          stage: 'empty-trash',
          message: 'Échec du vidage de corbeille.',
          validation: 'failed',
          meta: error
        });
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
                  <label for="profile-first-name">Prénom</label>
                  <input
                    id="profile-first-name"
                    type="text"
                    class="input"
                    placeholder="Luke"
                    bind:value={preferences.firstName}
                  />
                </div>
                <div class="field">
                  <label for="profile-last-name">Nom</label>
                  <input
                    id="profile-last-name"
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
                <p>Moteur gelé: un seul provider texte supporté, OpenRouter. Le runtime fonctionne en orchestration à sous-agents, pas en roulette multi-provider.</p>
              </div>

              <div class="field-hint">Les anciens providers texte ont été retirés du scope supporté. Si tu veux de la stabilité, tu arrêtes de collectionner les branches mortes.</div>

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
                        <label for="text-model-search">Modèle</label>
                        <span class="model-count">{textProviderModels.length} disponibles</span>
                      </div>
                      <input
                        id="text-model-search"
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

                  {#if activeModelSupportsReasoning}
                    <div class="field">
                      <span class="field-label">Effort de raisonnement</span>
                      <div class="reasoning-effort-row">
                        {#each REASONING_EFFORTS as effort}
                          <button
                            type="button"
                            class="reasoning-effort-btn"
                            class:selected={preferences?.textReasoningEffort === effort}
                            on:click={() => {
                              if (!preferences) return;
                              preferences.textReasoningEffort = effort;
                              preferences = { ...preferences };
                            }}
                          >{effort}</button>
                        {/each}
                      </div>
                      {#if preferences?.textReasoningEffort}
                        <span class="field-hint">
                          <button type="button" class="reset-btn" on:click={() => {
                            if (!preferences) return;
                            preferences.textReasoningEffort = undefined;
                            preferences = { ...preferences };
                          }}>Laisser le modèle décider</button>
                        </span>
                      {:else}
                        <span class="field-hint">Laissé au modèle — sélectionne un niveau pour forcer</span>
                      {/if}
                    </div>
                  {/if}

                  <div class="field">
                    <span class="field-label">Mode de génération</span>
                    <div class="reasoning-effort-row">
                      <button
                        type="button"
                        class="reasoning-effort-btn"
                        class:selected={(preferences?.textRuntimeMode ?? 'agentic-subagents') === 'agentic-subagents'}
                        on:click={() => {
                          if (!preferences) return;
                          preferences.textRuntimeMode = 'agentic-subagents';
                          preferences = { ...preferences };
                        }}
                      >Qualité (4 agents)</button>
                      <button
                        type="button"
                        class="reasoning-effort-btn"
                        class:selected={preferences?.textRuntimeMode === 'structured-json'}
                        on:click={() => {
                          if (!preferences) return;
                          preferences.textRuntimeMode = 'structured-json';
                          preferences = { ...preferences };
                        }}
                      >Rapide (1 appel)</button>
                    </div>
                    <span class="field-hint">
                      « Rapide » génère chaque tour en un seul appel (moins cher, plus rapide) ; « Qualité » orchestre quatre sous-agents.
                    </span>
                  </div>

                  <div class="field">
                    <label for="text-api-key">Clé API OpenRouter</label>
                    <input
                      id="text-api-key"
                      type="password"
                      class="input"
                      placeholder="sk-or-..."
                      bind:value={preferences.textApiKey}
                    />
                    <span class="field-hint">Stockée localement, jamais envoyée à nos serveurs</span>
                  </div>

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
                        <label for="image-model-search">Modèle</label>
                        <span class="model-count">{imageProviderModels.length} disponibles</span>
                      </div>
                      <input
                        id="image-model-search"
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
                    <label for="image-api-key">Clé API</label>
                    <input
                      id="image-api-key"
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
                  <span class="field-label">Point de vue</span>
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
                  <span class="field-label">Longueur des passages</span>
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
                        <label for={`profile-era-${profile.id}`}>Ère par défaut</label>
                        <select
                          id={`profile-era-${profile.id}`}
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
                        <label for={`profile-faction-${profile.id}`}>Faction par défaut</label>
                        <select
                          id={`profile-faction-${profile.id}`}
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
                  <span class="field-label">Thème</span>
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
                  <label for="ui-language">Langue de l'interface</label>
                  <select
                    id="ui-language"
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
                  <span class="field-label">Sauvegarde automatique</span>
                  <label class="toggle">
                    <input type="checkbox" checked={preferences.autoSave}
                      on:change={(e) => { if (preferences) preferences.autoSave = getInputChecked(e); }} />
                    <span class="toggle-slider"></span>
                  </label>
                </div>

                {#if preferences.autoSave}
                  <div class="field">
                    <label for="auto-save-interval">Intervalle</label>
                    <select id="auto-save-interval" class="select" bind:value={preferences.autoSaveInterval}>
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

                <div class="data-card">
                  <div class="data-card-info">
                    <span class="data-card-title">Exporter les diagnostics</span>
                    <span class="data-card-desc">Téléchargez le journal local borné du story engine pour un bug report propre</span>
                  </div>
                  <button class="btn btn-secondary" on:click={handleExportDiagnostics}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Exporter
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

  .field label,
  .field .field-label {
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

  .reasoning-effort-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .reasoning-effort-btn {
    padding: 0.3rem 0.75rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.78rem;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .reasoning-effort-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-bg-hover, var(--color-bg-secondary));
  }

  .reasoning-effort-btn.selected {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-on-accent, #fff);
    font-weight: 600;
  }

  .reset-btn {
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    text-decoration: underline;
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
