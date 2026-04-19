<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let showBack = false;
  export let breadcrumbs: Array<{ label: string; href?: string }> = [];

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

    {#if breadcrumbs.length > 0}
      <nav class="breadcrumb" aria-label="Fil d'Ariane">
        {#each breadcrumbs as crumb, i}
          {#if crumb.href && i < breadcrumbs.length - 1}
            <a href={crumb.href} class="crumb-link">{crumb.label}</a>
            <span class="crumb-sep" aria-hidden="true">›</span>
          {:else}
            <span class="crumb-current" aria-current="page">{crumb.label}</span>
          {/if}
        {/each}
      </nav>
    {:else if title}
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
    flex-wrap: wrap;
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
    min-width: 0;
    flex: 1;
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
    flex-shrink: 0;
    font-family: var(--font-body);
  }

  .back-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .back-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Breadcrumb */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }

  .crumb-link {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    text-decoration: none;
    white-space: nowrap;
    transition: color var(--transition-fast);
    flex-shrink: 0;
  }

  .crumb-link:hover { color: var(--color-gold); }

  .crumb-sep {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    flex-shrink: 0;
    opacity: 0.5;
  }

  .crumb-current {
    font-size: 0.82rem;
    color: var(--color-text-primary);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
    min-width: 0;
  }

  .page-header-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
</style>
