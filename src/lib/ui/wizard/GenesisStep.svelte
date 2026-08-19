<script lang="ts">
  /* Wizard step 5 — the character, generated and shown BEFORE the story starts.
     Creation used to hand the engine only catalog ids, leaving turn 1 to invent
     the protagonist mid-scene. Here the player sees who they are, can reroll,
     and can start without one if the call fails. */
  import { onMount } from 'svelte';
  import { getPreferences } from '$lib/persistence';
  import { generateCharacterGenesis, retrieveCodex, buildMemoryQuery, type CharacterGenesis, type StorySetup } from '$lib/engine';

  export let setup: StorySetup;
  export let trameLabel: string | null = null;
  export let genesis: CharacterGenesis | null = null;

  let busy = false;
  let failed = false;
  let started = false;

  // Fired here rather than by the parent: `bind:this` is still undefined at the
  // moment the step changes, so a parent-driven call silently did nothing.
  onMount(() => { if (!genesis) void generate(); });

  export async function generate(): Promise<void> {
    if (busy) return;
    busy = true;
    failed = false;
    started = true;
    try {
      const p = await getPreferences();
      const refs = retrieveCodex(setup.era, buildMemoryQuery([setup.premise, setup.faction, setup.role]), 4);
      const result = await generateCharacterGenesis(
        setup,
        trameLabel,
        refs.map((r) => r.text),
        { providerId: p.textProvider, model: p.textModel, apiKey: p.textApiKey, reasoningEffort: p.reasoningEffort }
      );
      genesis = result;
      failed = result === null;
    } catch {
      genesis = null;
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

<h1>Ton personnage</h1>

{#if busy}
  <div class="center">
    <div class="spinner"></div>
    <p class="hint">La galaxie écrit ton passé…</p>
  </div>
{:else if genesis}
  <div class="sheet">
    <section>
      <span class="eyebrow">Passé</span>
      <p>{genesis.background}</p>
    </section>
    {#if genesis.motivation}
      <section><span class="eyebrow">Ce qui te pousse</span><p>{genesis.motivation}</p></section>
    {/if}
    {#if genesis.flaw}
      <section class="flaw"><span class="eyebrow">Ta faille</span><p>{genesis.flaw}</p></section>
    {/if}
    <div class="row">
      {#if genesis.ally?.name}
        <section class="half">
          <span class="eyebrow">Lien</span>
          <p><strong>{genesis.ally.name}</strong>{genesis.ally.note ? ` — ${genesis.ally.note}` : ''}</p>
        </section>
      {/if}
      {#if genesis.location}
        <section class="half"><span class="eyebrow">Point de départ</span><p>{genesis.location}</p></section>
      {/if}
    </div>
    {#if genesis.items.length}
      <section>
        <span class="eyebrow">Équipement</span>
        <p>{genesis.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(' · ')}</p>
      </section>
    {/if}
    <section><span class="eyebrow">Situation</span><p>{genesis.premise}</p></section>
  </div>
  <button type="button" class="btn btn-ghost reroll" on:click={generate}>↻ Régénérer</button>
{:else if failed}
  <div class="center">
    <p class="hint">
      Le personnage n'a pas pu être généré (clé API, réseau ou modèle indisponible).
      Tu peux réessayer, ou lancer quand même — l'aventure t'introduira dans la première scène.
    </p>
    <button type="button" class="btn btn-secondary" on:click={generate}>Réessayer</button>
  </div>
{:else if !started}
  <div class="center"><p class="hint">Prêt à faire naître ton personnage.</p></div>
{/if}

<style>
  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-md); padding: var(--space-xl) 0; text-align: center; }
  .sheet { display: flex; flex-direction: column; gap: var(--space-md); }
  .sheet section {
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-left: 2px solid var(--color-gold-dim);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.03);
  }
  .sheet .flaw { border-left-color: var(--color-red); }
  .sheet p { margin-top: 6px; color: var(--color-text-secondary); font-family: var(--font-narrative); line-height: 1.6; }
  .sheet strong { color: var(--color-gold); }
  .row { display: flex; gap: var(--space-md); }
  .half { flex: 1; }
  .reroll { margin-top: var(--space-md); }
  .spinner {
    width: 34px; height: 34px;
    border: 2px solid var(--color-border); border-top-color: var(--color-gold);
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .row { flex-direction: column; }
  }
</style>
