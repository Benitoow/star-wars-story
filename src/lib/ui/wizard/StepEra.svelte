<script lang="ts">
  /* Era pick. The catalog carried an emblem and a one-line mood for every era
     and the wizard showed neither — just a name and a date range. */
  import { ERAS, ERA_CONTEXT } from '$lib/content/catalog';
  import Emblem from '../Emblem.svelte';

  export let era: string;

  $: context = ERA_CONTEXT[era] ?? '';
</script>

<h1>Choisis ton ère</h1>
<p class="lede">Elle décide qui règne, qui se cache, et ce qui peut exister autour de toi.</p>

<div class="grid">
  {#each ERAS as e, i}
    <button
      type="button"
      class="tile"
      class:selected={era === e.id}
      style="--stagger: {i * 45}ms"
      aria-pressed={era === e.id}
      on:click={() => (era = e.id)}
    >
      <Emblem icon={e.icon} tint="var(--color-gold)" size="40px" />
      <span class="name">{e.name}</span>
      <span class="years">{e.years}</span>
    </button>
  {/each}
</div>

{#key era}
  <p class="context">{context}</p>
{/key}

<style>
  .lede {
    margin-bottom: var(--space-lg);
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-sm);
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: var(--space-lg) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.02);
    color: var(--color-text-secondary);
    cursor: pointer;
    text-align: center;
    transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
    animation: rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--stagger);
  }
  .tile:hover { border-color: var(--color-border-hover); transform: translateY(-2px); }
  .tile:hover :global(.emblem) { opacity: 1; }

  .tile.selected {
    border-color: var(--color-gold-dim);
    background: rgba(216, 185, 119, 0.08);
    color: var(--color-text-primary);
  }
  .tile.selected :global(.emblem) {
    opacity: 1;
    filter: drop-shadow(0 0 10px rgba(216, 185, 119, 0.5));
  }

  .name { font-family: var(--font-display); font-size: 0.95rem; letter-spacing: 0.02em; }
  .years { font-size: 0.72rem; color: var(--color-text-muted); }

  .context {
    margin-top: var(--space-lg);
    padding-left: var(--space-md);
    border-left: 2px solid var(--color-gold-dim);
    font-family: var(--font-narrative);
    font-style: italic;
    line-height: 1.6;
    color: var(--color-text-secondary);
    animation: fade 380ms ease both;
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile, .context { animation: none; }
    .tile:hover { transform: none; }
  }
</style>
