<script lang="ts">
  /* Story seed. Picking a trame used to silently overwrite a premise the player
     had already written; it now asks before discarding their words. */
  import { TRAMES } from '$lib/content/catalog';

  export let trameId: string;
  export let premise: string;

  let dirty = false;
  let pending: string | null = null;

  $: current = TRAMES.find((t) => t.id === trameId);

  function apply(id: string): void {
    trameId = id;
    const t = TRAMES.find((tr) => tr.id === id);
    if (t && t.id !== 'custom') premise = t.premise;
    if (id === 'custom') premise = '';
    dirty = false;
    pending = null;
  }

  function pick(id: string): void {
    if (id === trameId) return;
    // Only guard text the player actually authored.
    const canned = TRAMES.some((t) => t.premise && t.premise === premise);
    if (dirty && premise.trim() && !canned) {
      pending = id;
      return;
    }
    apply(id);
  }
</script>

<h1>Quel point de départ ?</h1>
<p class="lede">Une trame donne le ton de l'ouverture. Tu pourras l'ajuster juste en dessous.</p>

<div class="grid">
  {#each TRAMES as t, i}
    <button
      type="button"
      class="tile"
      class:selected={trameId === t.id}
      style="--stagger: {i * 35}ms"
      aria-pressed={trameId === t.id}
      on:click={() => pick(t.id)}
    >
      <span class="icon">{t.icon}</span>
      <span class="name">{t.name}</span>
    </button>
  {/each}
</div>

{#if pending}
  <div class="guard" role="alertdialog">
    <p>Tu as écrit ta propre prémisse. Changer de trame va la remplacer.</p>
    <div class="guard-actions">
      <button type="button" class="btn btn-ghost" on:click={() => (pending = null)}>Garder mon texte</button>
      <button type="button" class="btn btn-secondary" on:click={() => apply(pending!)}>Remplacer</button>
    </div>
  </div>
{/if}

<label class="label mt" for="premise">Prémisse{#if current && current.id !== 'custom'}<span class="from">&nbsp;— d'après « {current.name} »</span>{/if}</label>
<textarea
  id="premise"
  class="input premise"
  bind:value={premise}
  on:input={() => (dirty = true)}
  rows="4"
  placeholder="Décris le point de départ de ton aventure…"
></textarea>
<p class="hint">La genèse s'appuiera dessus pour écrire ton personnage.</p>

<style>
  .lede { margin-bottom: var(--space-lg); color: var(--color-text-muted); font-size: 0.88rem; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-sm); }
  .tile {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: var(--space-md) var(--space-sm);
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.02);
    color: var(--color-text-secondary); cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
    animation: rise 360ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--stagger);
  }
  .tile:hover { border-color: var(--color-border-hover); transform: translateY(-2px); }
  .tile.selected {
    border-color: var(--color-gold-dim);
    background: rgba(216, 185, 119, 0.08);
    color: var(--color-text-primary);
  }
  .tile.selected .icon { transform: scale(1.12); }
  .icon { font-size: 1.5rem; transition: transform var(--transition-normal); }
  .name { font-family: var(--font-display); font-size: 0.85rem; }

  .guard {
    margin-top: var(--space-md); padding: var(--space-md);
    border: 1px solid rgba(216, 185, 119, 0.4); border-radius: var(--radius-md);
    background: rgba(216, 185, 119, 0.07);
    animation: fade 260ms ease both;
  }
  .guard p { font-size: 0.84rem; color: var(--color-text-secondary); }
  .guard-actions { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }

  .from { color: var(--color-text-muted); font-weight: normal; }
  .premise { width: 100%; resize: vertical; }
  .hint { margin-top: 6px; font-size: 0.75rem; color: var(--color-text-muted); }

  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  @media (prefers-reduced-motion: reduce) {
    .tile, .guard { animation: none; }
    .tile:hover { transform: none; }
  }
</style>
