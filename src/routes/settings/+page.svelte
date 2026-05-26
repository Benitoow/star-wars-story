<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { preferences } from '$lib/stores/preferences';
  import { UI_LANGUAGE_OPTIONS } from '$lib/content/languages';
  import { toasts } from '$lib/stores/ui';
  import type { Preferences } from '$lib/persistence';

  const REASONING = [
    { id: 'auto', name: 'Auto (le modèle décide)' },
    { id: 'low', name: 'Faible' },
    { id: 'medium', name: 'Moyen' },
    { id: 'high', name: 'Élevé' }
  ];

  // Local editable copy — saved explicitly so the user always sees a clear save.
  let form = {
    textApiKey: '',
    textModel: '',
    uiLanguage: 'auto' as Preferences['uiLanguage'],
    runtimeMode: 'agentic-subagents' as Preferences['runtimeMode'],
    reasoningEffort: 'auto'
  };
  let showAdvanced = false;
  let saving = false;

  onMount(() => {
    const p = get(preferences); // settings render after boot, so this is the persisted value
    form = {
      textApiKey: p.textApiKey,
      textModel: p.textModel,
      uiLanguage: p.uiLanguage,
      runtimeMode: p.runtimeMode,
      reasoningEffort: p.reasoningEffort
    };
  });

  $: dirty =
    form.textApiKey.trim() !== $preferences.textApiKey ||
    form.textModel.trim() !== $preferences.textModel ||
    form.uiLanguage !== $preferences.uiLanguage ||
    form.runtimeMode !== $preferences.runtimeMode ||
    form.reasoningEffort !== $preferences.reasoningEffort;

  async function save() {
    if (!dirty || saving) return;
    saving = true;
    try {
      await preferences.update({
        textApiKey: form.textApiKey.trim(),
        textModel: form.textModel.trim(),
        uiLanguage: form.uiLanguage,
        runtimeMode: form.runtimeMode,
        reasoningEffort: form.reasoningEffort
      });
      toasts.show('Réglages enregistrés.', 'success', 2000);
    } catch {
      toasts.show("Échec de l'enregistrement.", 'error');
    } finally {
      saving = false;
    }
  }

  // Theme is a live toggle — applies and persists instantly.
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

  <section class="card">
    <h2>Intelligence narrative</h2>
    <p class="hint">L'app utilise <strong>OpenRouter</strong>. Colle ta clé pour donner vie au Maître du Jeu.</p>
    <label class="label" for="key">Clé API OpenRouter</label>
    <input id="key" class="input" type="password" autocomplete="off" placeholder="sk-or-…" bind:value={form.textApiKey} />
    <label class="label mt" for="model">Modèle</label>
    <input id="model" class="input" placeholder="ex : qwen/qwen3.5-9b" bind:value={form.textModel} />
    <p class="hint">Identifiant de modèle OpenRouter (provider/modèle).</p>
  </section>

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
        <p class="hint">L'agentique enchaîne Directeur → Écrivain → Cerveau (3 appels/tour).</p>
      </div>
      <div class="field mt">
        <label class="label" for="reason">Effort de raisonnement</label>
        <select id="reason" class="input" bind:value={form.reasoningEffort}>
          {#each REASONING as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
        <p class="hint">« Auto » laisse chaque modèle gérer son raisonnement (recommandé).</p>
      </div>
    {/if}
  </section>

  <div class="savebar">
    <span class="save-status">{dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}</span>
    <button type="button" class="btn btn-primary" disabled={!dirty || saving} on:click={save}>
      {saving ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  </div>
</div>

<style>
  .settings { max-width: 720px; margin: 0 auto; padding: calc(var(--header-height) + var(--space-xl)) var(--space-lg) calc(var(--space-2xl) + 64px); display: flex; flex-direction: column; gap: var(--space-lg); }
  .head h1 { font-size: 2rem; }
  .card { display: flex; flex-direction: column; }
  .card h2 { font-size: 1.1rem; margin-bottom: var(--space-sm); }
  .hint { font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: var(--space-sm); }
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

  .savebar {
    position: fixed; inset: auto 0 0 0; z-index: 40;
    display: flex; align-items: center; justify-content: flex-end; gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--surface-glass-strong); backdrop-filter: blur(14px);
    border-top: 1px solid var(--color-border);
  }
  .save-status { font-size: 0.82rem; color: var(--color-text-muted); }
</style>
