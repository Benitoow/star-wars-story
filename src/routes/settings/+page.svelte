<script lang="ts">
  import { preferences } from '$lib/stores/preferences';
  import { UI_LANGUAGE_OPTIONS } from '$lib/content/languages';
  import { WRITING_STYLES, WRITING_TONES, WRITING_POVS, WRITING_LENGTHS, CONTENT_MODES } from '$lib/content/catalog';
  import { toasts } from '$lib/stores/ui';
  import type { Preferences } from '$lib/persistence';

  let showAdvanced = false;

  const REASONING = [
    { id: 'auto', name: 'Auto (le modèle décide)' },
    { id: 'low', name: 'Faible' },
    { id: 'medium', name: 'Moyen' },
    { id: 'high', name: 'Élevé' }
  ];

  async function set(patch: Partial<Preferences>, toast = false) {
    await preferences.update(patch);
    if (toast) toasts.show('Réglage enregistré.', 'success', 1500);
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
    <input
      id="key" class="input" type="password" autocomplete="off" placeholder="sk-or-…"
      value={$preferences.textApiKey}
      on:change={(e) => set({ textApiKey: e.currentTarget.value.trim() }, true)}
    />
    <label class="label mt" for="model">Modèle</label>
    <input
      id="model" class="input" placeholder="ex : qwen/qwen3.5-9b"
      value={$preferences.textModel}
      on:change={(e) => set({ textModel: e.currentTarget.value.trim() })}
    />
    <p class="hint">Identifiant de modèle OpenRouter (provider/modèle).</p>
  </section>

  <section class="card">
    <h2>Apparence</h2>
    <div class="row">
      <div class="field">
        <label class="label" for="lang">Langue</label>
        <select id="lang" class="input" value={$preferences.uiLanguage} on:change={(e) => set({ uiLanguage: e.currentTarget.value as Preferences['uiLanguage'] })}>
          {#each UI_LANGUAGE_OPTIONS as o}<option value={o.code}>{o.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <span class="label">Thème</span>
        <div class="toggle">
          <button type="button" class:on={$preferences.theme === 'dark'} on:click={() => set({ theme: 'dark' })}>Sombre</button>
          <button type="button" class:on={$preferences.theme === 'light'} on:click={() => set({ theme: 'light' })}>Clair</button>
        </div>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Narration par défaut</h2>
    <p class="hint">Appliquée aux nouvelles histoires (modifiable à la création).</p>
    <div class="row wrap">
      <div class="field">
        <label class="label" for="style">Style</label>
        <select id="style" class="input" value={$preferences.writingStyle} on:change={(e) => set({ writingStyle: e.currentTarget.value })}>
          {#each WRITING_STYLES as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label class="label" for="tone">Ton</label>
        <select id="tone" class="input" value={$preferences.writingTone} on:change={(e) => set({ writingTone: e.currentTarget.value })}>
          {#each WRITING_TONES as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label class="label" for="pov">Point de vue</label>
        <select id="pov" class="input" value={$preferences.writingPov} on:change={(e) => set({ writingPov: e.currentTarget.value })}>
          {#each WRITING_POVS as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label class="label" for="len">Longueur</label>
        <select id="len" class="input" value={$preferences.writingLength} on:change={(e) => set({ writingLength: e.currentTarget.value })}>
          {#each WRITING_LENGTHS as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label class="label" for="content">Contenu</label>
        <select id="content" class="input" value={$preferences.contentMode} on:change={(e) => set({ contentMode: e.currentTarget.value })}>
          {#each CONTENT_MODES as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </div>
    </div>
  </section>

  <section class="card">
    <button type="button" class="disclosure" on:click={() => (showAdvanced = !showAdvanced)} aria-expanded={showAdvanced}>
      <span>Réglages avancés</span><span>{showAdvanced ? '−' : '+'}</span>
    </button>
    {#if showAdvanced}
      <div class="field mt">
        <label class="label" for="reason">Effort de raisonnement</label>
        <select id="reason" class="input" value={$preferences.reasoningEffort} on:change={(e) => set({ reasoningEffort: e.currentTarget.value })}>
          {#each REASONING as o}<option value={o.id}>{o.name}</option>{/each}
        </select>
        <p class="hint">« Auto » laisse chaque modèle gérer son raisonnement (recommandé).</p>
      </div>
    {/if}
  </section>
</div>

<style>
  .settings { max-width: 720px; margin: 0 auto; padding: calc(var(--header-height) + var(--space-xl)) var(--space-lg) var(--space-2xl); display: flex; flex-direction: column; gap: var(--space-lg); }
  .head h1 { font-size: 2rem; }
  .card { display: flex; flex-direction: column; }
  .card h2 { font-size: 1.1rem; margin-bottom: var(--space-sm); }
  .hint { font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: var(--space-sm); }
  .label.mt, .field.mt { margin-top: var(--space-md); }
  .row { display: flex; gap: var(--space-md); }
  .row.wrap { flex-wrap: wrap; }
  .field { flex: 1; min-width: 160px; }
  .toggle { display: flex; gap: var(--space-xs); }
  .toggle button {
    flex: 1; padding: 10px; font-family: var(--font-display); font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--color-text-secondary); background: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;
  }
  .toggle button.on { color: var(--color-text-primary); border-color: var(--color-gold); background: rgba(216,185,119,0.08); }
  .disclosure { display: flex; align-items: center; justify-content: space-between; width: 100%; font-family: var(--font-display); font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-secondary); background: none; cursor: pointer; }
  .disclosure:hover { color: var(--color-text-primary); }
</style>
