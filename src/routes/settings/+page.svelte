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
    { id: 'profile',    label: 'Profil',       icon: '👤' },
    { id: 'ai_text',   label: 'IA Texte',      icon: '🤖' },
    { id: 'ai_image',  label: 'IA Images',     icon: '🎨' },
    { id: 'style',     label: 'Style',         icon: '✍️' },
    { id: 'content',   label: 'Contenu',       icon: '🔒' },
    { id: 'profiles',  label: 'Profils',       icon: '🧩' },
    { id: 'shortcuts', label: 'Raccourcis',    icon: '⌨️' },
    { id: 'appearance',label: 'Apparence',     icon: '🌙' },
    { id: 'data',      label: 'Données',       icon: '💾' },
  ];

  let currentScreen = 'profile';
  let slideDir = 1;

  function goTo(id: string) {
    const from = SCREENS.findIndex(s => s.id === currentScreen);
    const to   = SCREENS.findIndex(s => s.id === id);
    slideDir = to >= from ? 1 : -1;
    currentScreen = id;
  }

  // ── Config data ───────────────────────────
  const TEXT_PROVIDERS = [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      models: [
        'openai/gpt-5-mini',
        'anthropic/claude-sonnet-4.5',
        'google/gemini-2.5-pro',
        'meta-llama/llama-3.3-70b-instruct'
      ]
    },
    { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { id: 'anthropic', name: 'Anthropic', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
    { id: 'mistral', name: 'Mistral AI', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mixtral-8x7b'] },
    { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
    {
      id: 'together',
      name: 'Together AI',
      models: [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'mistralai/Mixtral-8x7B-Instruct-v0.1'
      ]
    },
    { id: 'ollama', name: 'Ollama (local)', models: ['llama3.3', 'mistral', 'gemma3', 'qwen2.5'] },
    { id: 'none', name: 'Aucun (texte manuel)', models: [] },
  ];

  const IMAGE_PROVIDERS = [
    {
      id: 'openrouter_img',
      name: 'OpenRouter Images',
      models: [
        'google/gemini-2.5-flash-image',
        'openai/gpt-5-image-mini',
        'openai/gpt-5-image',
        'google/gemini-3.1-flash-image-preview',
        'google/gemini-3-pro-image-preview',
        'black-forest-labs/flux.2-max',
        'black-forest-labs/flux.2-pro',
        'black-forest-labs/flux.2-flex',
        'black-forest-labs/flux.2-klein-4b'
      ]
    },
    {
      id: 'fal_img',
      name: 'fal.ai',
      models: [
        'fal-ai/flux/schnell',
        'fal-ai/flux/dev',
        'fal-ai/flux-pro/v1.1',
        'fal-ai/recraft-v3',
        'fal-ai/ideogram/v2'
      ]
    },
    {
      id: 'together_img',
      name: 'Together AI Images',
      models: [
        'black-forest-labs/FLUX.1-schnell',
        'black-forest-labs/FLUX.1-dev',
        'stabilityai/stable-diffusion-xl-base-1.0',
        'stabilityai/stable-diffusion-3-medium'
      ]
    },
    { id: 'openai_img', name: 'DALL-E (OpenAI)', models: ['dall-e-3', 'dall-e-2'] },
    { id: 'stability', name: 'Stability AI', models: ['ultra', 'core'] },
    { id: 'none', name: 'Aucun (texte uniquement)', models: [] },
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
  $: activeTextProvider = TEXT_PROVIDERS.find(p => p.id === preferences?.textProvider);
  $: activeImageProvider = IMAGE_PROVIDERS.find(p => p.id === preferences?.imageProvider);
  $: textProviderModels = activeTextProvider?.models ?? [];
  $: imageProviderModels = activeImageProvider?.models ?? [];

  function applyPreferenceDefaults(input: UserPreferences): UserPreferences {
    const next = { ...input };

    next.profiles = Array.isArray(next.profiles) ? next.profiles : [];
    if (!next.avatarEmoji) next.avatarEmoji = AVATARS[0];

    const textProviderAlias: Record<string, string> = {
      gemini: 'openrouter'
    };
    const imageProviderAlias: Record<string, string> = {
      openai: 'openai_img',
      flux: 'openrouter_img'
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

    if (!next.textProvider) next.textProvider = 'openrouter';

    const textProvider = TEXT_PROVIDERS.find(p => p.id === next.textProvider);
    if (!next.textModel || (textProvider?.models.length && !textProvider.models.includes(next.textModel))) {
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

    if (!next.imageProvider) {
      next.imageProvider = next.defaultImageProvider || 'none';
    }

    const imageProvider = IMAGE_PROVIDERS.find(p => p.id === next.imageProvider);
    if (!next.imageModel || (imageProvider?.models.length && !imageProvider.models.includes(next.imageModel))) {
      next.imageModel = next.defaultImgModel || imageProvider?.models[0] || '';
    }

    next.defaultImageProvider = next.imageProvider;
    next.defaultImgModel = next.imageModel;
    return next;
  }

  function selectTextProvider(providerId: string) {
    if (!preferences) return;
    preferences.textProvider = providerId;

    const provider = TEXT_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    if (!provider.models.includes(preferences.textModel || '')) {
      preferences.textModel = provider.models[0] ?? '';
    }

    if (providerId === 'none') {
      preferences.textModel = '';
      preferences.textApiKey = '';
    }

    if (providerId === 'ollama' && !preferences.ollamaUrl) {
      preferences.ollamaUrl = 'http://localhost:11434';
    }
  }

  function selectImageProvider(providerId: string) {
    if (!preferences) return;
    preferences.imageProvider = providerId;

    const provider = IMAGE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    if (!provider.models.includes(preferences.imageModel || '')) {
      preferences.imageModel = provider.models[0] ?? '';
    }

    if (providerId === 'none') {
      preferences.imageModel = '';
      preferences.imageApiKey = '';
    }

    preferences.defaultImageProvider = preferences.imageProvider;
    preferences.defaultImgModel = preferences.imageModel;
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
                <p>Choisissez l'IA qui générera vos histoires</p>
              </div>

              <div class="provider-grid">
                {#each TEXT_PROVIDERS as p}
                  <button
                    class="provider-card"
                    class:selected={preferences.textProvider === p.id}
                    on:click={() => selectTextProvider(p.id)}
                  >
                    <span class="provider-name">{p.name}</span>
                    {#if p.models.length}<span class="provider-models">{p.models.length} modèles</span>{/if}
                  </button>
                {/each}
              </div>

              {#if preferences.textProvider && preferences.textProvider !== 'none'}
                <div class="field-group">
                  {#if textProviderModels.length}
                    <div class="field">
                      <label>Modèle</label>
                      <select class="select" bind:value={preferences.textModel}>
                        {#each textProviderModels as m}
                          <option value={m}>{m}</option>
                        {/each}
                      </select>
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
                </div>
              {/if}

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('profile')}>← Retour</button>
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
                    <span class="provider-name">{p.name}</span>
                    {#if p.models.length}<span class="provider-models">{p.models.length} modèles</span>{/if}
                  </button>
                {/each}
              </div>

              {#if preferences.imageProvider && preferences.imageProvider !== 'none'}
                <div class="field-group">
                  {#if imageProviderModels.length}
                    <div class="field">
                      <label>Modèle</label>
                      <select class="select" bind:value={preferences.imageModel}>
                        {#each imageProviderModels as m}
                          <option value={m}>{m}</option>
                        {/each}
                      </select>
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
                </div>
              {/if}

              <div class="screen-footer">
                <button class="btn-back" on:click={() => goTo('ai_text')}>← Retour</button>
                <button class="btn-next" on:click={() => goTo('style')}>Suivant : Style →</button>
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
                <button class="btn-back" on:click={() => goTo('shortcuts')}>← Retour</button>
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

  .provider-name {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .provider-models {
    font-size: 0.75rem;
    color: var(--color-text-muted);
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
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }
    .nav-btn { flex-direction: column; gap: 2px; padding: var(--space-xs) var(--space-sm); font-size: 0.75rem; }
    .nav-dot { display: none; }
    .screen { padding: var(--space-lg); }
    .option-grid, .provider-grid { grid-template-columns: 1fr 1fr; }
    .profiles-grid { grid-template-columns: 1fr; }
    .shortcut-item { flex-direction: column; align-items: flex-start; }
  }
</style>
