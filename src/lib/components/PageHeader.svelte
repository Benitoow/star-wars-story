<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let showBack = false;

  const dispatch = createEventDispatcher<{ back: void }>();
</script>

<div class="page-header">
  <div class="page-header-left">
    {#if showBack}
      <button class="back-btn" on:click={() => dispatch('back')} aria-label="Retour">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Retour
      </button>
    {/if}
    {#if title}
      <h1 class="page-title">{title}</h1>
    {/if}
  </div>
  <div class="page-header-right">
    <slot />
  </div>
</div>

<style>
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 40;
  }

  .page-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .back-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .back-btn svg {
    width: 16px;
    height: 16px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .page-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
</style>
