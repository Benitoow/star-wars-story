<script lang="ts">
  /* Provider credentials + model pick: API key, model chooser (chips for MiMo,
     free text for OpenRouter) and the detected context window. `form` is bound
     so the parent's reactive statements (dirty flag, context lookup) still fire. */
  import { getModelDisplayName, getModelPlaceholder } from '$lib/content/providers';
  import { TRANSCRIPT_SHARE } from '$lib/engine';

  export let form: { textProvider: string; textApiKey: string; textModel: string };
  export let providerModels: string[] = [];
  export let contextLimit: number | null = null;
  export let contextBudget: number | null = null;
</script>

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

<style>
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

  .hint a { color: var(--color-gold); text-decoration: underline; }
  .label.mt { margin-top: var(--space-md); }
</style>
