<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { preferences } from '$lib/stores/preferences';
  import { UI_LANGUAGE_OPTIONS } from '$lib/content/languages';
  import {
    MIMO_MODELS,
    getModelDisplayName,
    getModelPlaceholder,
    getProviderDisplayName
  } from '$lib/content/providers';
  import { toasts } from '$lib/stores/ui';
  import { APP_NAME, APP_VERSION_LABEL } from '$lib/version';
  import { fetchContextLengths, TRANSCRIPT_SHARE } from '$lib/engine';
  import type { Preferences } from '$lib/persistence';

  const REASONING = [
    { id: 'auto', name: 'Auto (le modèle décide)' },
    { id: 'minimal', name: 'Minimal' },
    { id: 'low', name: 'Low' },
    { id: 'medium', name: 'Medium' },
    { id: 'high', name: 'High' },
    { id: 'extra-high', name: 'Extra High' },
    { id: 'max', name: 'Max' }
  ];

  const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter', hint: 'Accès à des centaines de modèles via une seule clé.' },
    { id: 'mimo', name: 'Xiaomi MiMo', hint: 'MiMo V2.5 — rapide, bon marché, pensée activée par défaut.' }
  ];

  // Local editable copy
  let form = {
    textProvider: 'openrouter' as string,
    textApiKey: '',
    textModel: '',
    uiLanguage: 'auto' as Preferences['uiLanguage'],
    runtimeMode: 'agentic-subagents' as Preferences['runtimeMode'],
    reasoningEffort: 'auto',
    memoryEmbeddings: false
  };
  let showAdvanced = false;
  let saving = false;

  let lengths: Record<string, number> = {};

  async function loadLengths(apiKey: string, providerId: string) {
    if (!apiKey && providerId !== 'mimo') return;
    try {
      lengths = await fetchContextLengths(apiKey, providerId);
    } catch {
      // fallback
    }
  }

  // Re-fetch context lengths when provider or key changes
  $: if (form.textProvider || form.textApiKey) {
    void loadLengths(form.textApiKey.trim(), form.textProvider);
  }

  $: contextLimit = lengths[form.textModel.trim()] ?? null;
  $: contextBudget = contextLimit ? Math.floor(contextLimit * TRANSCRIPT_SHARE) : null;

  // MiMo models available for the current provider
  $: providerModels = form.textProvider === 'mimo' ? [...MIMO_MODELS] : [];

  onMount(() => {
    const p = get(preferences);
    form = {
      textProvider: p.textProvider || 'openrouter',
      textApiKey: p.textApiKey,
      textModel: p.textModel,
      uiLanguage: p.uiLanguage,
      runtimeMode: p.runtimeMode,
      reasoningEffort: p.reasoningEffort,
      memoryEmbeddings: p.memoryEmbeddings === true
    };
  });

  $: dirty =
    form.textProvider !== ($preferences.textProvider || 'openrouter') ||
    form.textApiKey.trim() !== $preferences.textApiKey ||
    form.textModel.trim() !== $preferences.textModel ||
    form.uiLanguage !== $preferences.uiLanguage ||
    form.runtimeMode !== $preferences.runtimeMode ||
    form.reasoningEffort !== $preferences.reasoningEffort ||
    form.memoryEmbeddings !== ($preferences.memoryEmbeddings === true);

  /** When the user switches provider, pre-fill a sensible default model. */
  function onProviderChange(providerId: string) {
    form.textProvider = providerId;
    if (providerId === 'mimo') {
      form.textModel = 'mimo-v2.5-pro';
    } else if (providerId === 'openrouter') {
      form.textModel = 'qwen/qwen3.5-9b';
    }
  }

  async function save() {
    if (!dirty || saving) return;
    saving = true;
    try {
      await preferences.update({
        textProvider: form.textProvider,
        textApiKey: form.textApiKey.trim(),
        textModel: form.textModel.trim(),
        uiLanguage: form.uiLanguage,
        runtimeMode: form.runtimeMode,
        reasoningEffort: form.reasoningEffort,
        memoryEmbeddings: form.memoryEmbeddings
      });
      toasts.show('Réglages enregistrés.', 'success', 2000);
    } catch {
      toasts.show("Échec de l'enregistrement.", 'error');
    } finally {
      saving = false;
    }
  }

  function setTheme(theme: Preferences['theme']) {
    void preferences.update({ theme });
  }
</script>

<svelte:head><title>Réglages — Star Wars Story</title></svelte:head>

<div class="settings">
  <header class="head">
    <p class="eyebrow">Réglages</p>
    <h1>Ton studio</h1>
  </header>

  <!-- ─── Provider selector ──────────────────────── -->
  <section class="card">
    <h2>Fournisseur IA</h2>
    <p class="hint">Choisis le service qui alimente le Maître du Jeu.</p>
    <div class="provider-grid">
      {#each PROVIDERS as p}
        <button
          type="button"
          class="provider-card"
          class:selected={form.textProvider === p.id}
          on:click={() => onProviderChange(p.id)}
        >
          <span class="provider-name">{p.name}</span>
          <span class="provider-hint">{p.hint}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- ─── API key + model ────────────────────────── -->
  <section class="card">
    <h2>Intelligence narrative</h2>
    <p class="hint">
      {#if form.textProvider === 'mimo'}
        Renseigne ta clé <strong>MiMo</strong> pour activer la génération.
        <a href="https://platform.xiaomimimo.com/#/console/api-keys" target="_blank" rel="noopener">Obtenir une clé</a>
      {:else}
        L'app utilise <strong>OpenRouter</strong>. Colle ta clé pour donner vie au Maître du Jeu.
      {/if}
    </p>

    <label class="label" for="key">
      {#if form.textProvider === 'mimo'}Clé API MiMo{:else}Clé API OpenRouter{/if}
    </label>
    <input
      id="key"
      class="input"
      type="password"
      autocomplete="off"
      placeholder={form.textProvider === 'mimo' ? 'sk-…' : 'sk-or-…'}
      bind:value={form.textApiKey}
    />

    <label class="label mt" for="model">Modèle</label>

    {#if providerModels.length}
      <!-- MiMo: clickable model chips -->
      <div class="model-chips">
        {#each providerModels as m}
          <button
            type="button"
            class="chip"
            class:active={form.textModel === m}
            on:click={() => (form.textModel = m)}
          >
            {getModelDisplayName(m)}
          </button>
        {/each}
      </div>
    {:else}
      <!-- OpenRouter: free-form text input -->
      <input
        id="model"
        class="input"
        placeholder={getModelPlaceholder(form.textProvider)}
        bind:value={form.textModel}
      />
      <p class="hint">Identifiant de modèle OpenRouter (provider/modèle).</p>
    {/if}

    {#if form.textModel && contextLimit && contextBudget}
      <div class="model-info-badge">
        <span>Limite de Contexte : <strong>{contextLimit.toLocaleString()}</strong> tokens</span>
        <span>Budget Écrivain ({Math.round(TRANSCRIPT_SHARE * 100)}%) : <strong>{contextBudget.toLocaleString()}</strong> tokens</span>
      </div>
    {:else if form.textModel && form.textProvider !== 'mimo'}
      <p class="hint">Fenêtre de contexte détectée automatiquement via OpenRouter une fois la clé renseignée.</p>
    {/if}
  </section>

  <!-- ─── Language + theme ────────────────────────── -->
  <section class="card">
    <h2>Langue & thème</h2>
    <div class="row">
      <div class="field">
        <label class="label" for="lang">Langue des récits</label>
        <select id="lang" class="input" bind:value={form.uiLanguage}>
          {#each UI_LANGUAGE_OPTIONS as o}<option value={o.code}>{o.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <span class="label">Thème</span>
        <div class="toggle">
          <button type="button" class:on={$preferences.theme === 'dark'} on:click={() => setTheme('dark')}>Sombre</button>
          <button type="button" class:on={$preferences.theme === 'light'} on:click={() => setTheme('light')}>Clair</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ─── Advanced ────────────────────────────────── -->
  <section class="card">
    <button type="button" class="disclosure" on:click={() => (showAdvanced = !showAdvanced)} aria-expanded={showAdvanced}>
      <span>Réglages avancés</span><span>{showAdvanced ? '−' : '+'}</span>
    </button>
    {#if showAdvanced}
      <div class="field mt">
        <label class="label" for="mode">Moteur narratif</label>
        <select id="mode" class="input" bind:value={form.runtimeMode}>
          <option value="agentic-subagents">Agentique — multi-agents, plus riche</option>
          <option value="structured-json">Direct — un seul appel, plus rapide</option>
        </select>
        <p class="hint">L'agentique enchaîne Directeur → Écrivain → Relecteur → Cerveau (4 appels/tour, plus riche mais plus lent).</p>
      </div>
      <div class="field mt">
        <label class="label" for="reason">Effort de raisonnement</label>
        <select id="reason" class="input" bind:value={form.reasoningEffort}>
          {#each REASONING as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
        <p class="hint">« Auto » laisse chaque modèle gérer son raisonnement (recommandé). Les autres niveaux (Minimal → Max) transmettent l'effort demandé aux modèles qui le supportent.</p>
      </div>
      <div class="field mt">
        <label class="check">
          <input type="checkbox" bind:checked={form.memoryEmbeddings} disabled={form.textProvider === 'mimo'} />
          <span>
            <strong>Mémoire sémantique</strong>
            <span class="hint">Embeddings OpenRouter pour rappeler les faits pertinents à la scène (repli automatique sur la recherche par mots-clés en cas d'échec).</span>
          </span>
        </label>
        <p class="hint">Coûte un petit appel d'embedding par tour ; les vecteurs sont mis en cache localement.</p>
      </div>
    {/if}
  </section>

  <p class="version">{APP_NAME} · {APP_VERSION_LABEL}</p>

  <div class="savebar">
    <span class="save-status">{dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}</span>
    <button type="button" class="btn btn-primary" disabled={!dirty || saving} on:click={save}>
      {saving ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  </div>
</div>

<style>
  .settings { max-width: 720px; margin: 0 auto; padding: calc(var(--header-height) + var(--space-xl)) var(--space-lg) calc(var(--space-2xl) + 64px + var(--sab)); display: flex; flex-direction: column; gap: var(--space-lg); }
  .head h1 { font-size: 2rem; }
  .card { display: flex; flex-direction: column; }
  .card h2 { font-size: 1.1rem; margin-bottom: var(--space-sm); }
  .hint { font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: var(--space-sm); }
  .hint a { color: var(--color-gold); text-decoration: underline; }
  .model-info-badge {
    margin-top: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-sm);
    font-size: 0.74rem;
    color: var(--color-text-secondary);
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
    font-family: var(--font-mono);
  }
  .model-info-badge strong { color: var(--color-gold); }
  .label.mt, .field.mt { margin-top: var(--space-md); }
  .row { display: flex; gap: var(--space-md); flex-wrap: wrap; }
  .field { flex: 1; min-width: 200px; }
  .toggle { display: flex; gap: var(--space-xs); }
  .toggle button {
    flex: 1; padding: 10px; font-family: var(--font-display); font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--color-text-secondary); background: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;
  }
  .toggle button.on { color: var(--color-text-primary); border-color: var(--color-gold); background: rgba(216,185,119,0.08); }
  .disclosure { display: flex; align-items: center; justify-content: space-between; width: 100%; font-family: var(--font-display); font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-secondary); background: none; cursor: pointer; }
  .disclosure:hover { color: var(--color-text-primary); }
  .check { display: flex; gap: var(--space-sm); align-items: flex-start; cursor: pointer; }
  .check input { margin-top: 3px; accent-color: var(--color-gold); }
  .check span { display: flex; flex-direction: column; gap: 2px; }
  .check strong { color: var(--color-text-primary); font-family: var(--font-body); font-size: 0.9rem; }

  /* ── Provider grid ──────────────────────────────── */
  .provider-grid { display: flex; gap: var(--space-sm); }
  .provider-card {
    flex: 1; display: flex; flex-direction: column; gap: 2px;
    padding: var(--space-md) var(--space-sm);
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }
  .provider-card:hover { border-color: rgba(255,255,255,0.12); }
  .provider-card.selected { border-color: var(--color-gold); background: rgba(216,185,119,0.08); }
  .provider-name { font-family: var(--font-display); font-size: 0.82rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-primary); }
  .provider-card.selected .provider-name { color: var(--color-gold); }
  .provider-hint { font-size: 0.72rem; color: var(--color-text-muted); line-height: 1.35; }

  /* ── Model chips (MiMo) ─────────────────────────── */
  .model-chips { display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-bottom: var(--space-sm); }
  .chip {
    padding: 8px 14px;
    font-family: var(--font-mono); font-size: 0.78rem;
    color: var(--color-text-secondary);
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .chip:hover { border-color: rgba(255,255,255,0.12); color: var(--color-text-primary); }
  .chip.active { border-color: var(--color-gold); background: rgba(216,185,119,0.08); color: var(--color-gold); }

  /* ── Save bar ───────────────────────────────────── */
  .savebar {
    position: fixed; inset: auto 0 0 0; z-index: 40;
    display: flex; align-items: center; justify-content: flex-end; gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    padding-bottom: calc(var(--space-md) + var(--sab));
    background: var(--surface-glass-strong); backdrop-filter: blur(14px);
    border-top: 1px solid var(--color-border);
  }
  .save-status { font-size: 0.82rem; color: var(--color-text-muted); }
  .version { text-align: center; font-size: 0.74rem; letter-spacing: 0.1em; color: var(--color-text-muted); }

  @media (max-width: 768px) {
    .settings { padding: calc(var(--header-height) + var(--space-md)) var(--space-md) calc(var(--space-2xl) + 64px + var(--sab)); gap: var(--space-md); }
    .head h1 { font-size: 1.6rem; }
    .row { flex-direction: column; }
    .field { min-width: 100%; }
    .provider-grid { flex-direction: column; }
    .toggle button { padding: 14px; }
    .savebar { padding: var(--space-sm) var(--space-md); padding-bottom: calc(var(--space-sm) + var(--sab)); }
    .savebar .btn { flex: 1; }
    .save-status { font-size: 0.75rem; }
  }
</style>
