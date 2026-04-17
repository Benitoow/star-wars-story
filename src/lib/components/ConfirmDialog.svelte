<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let message = '';
  export let confirmLabel = 'Confirmer';
  export let cancelLabel = 'Annuler';
  export let danger = false;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('cancel');
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="overlay" role="dialog" aria-modal="true">
  <div class="dialog">
    <p class="message">{message}</p>
    <div class="actions">
      <button class="btn btn-secondary" on:click={() => dispatch('cancel')}>{cancelLabel}</button>
      <button class="btn" class:btn-danger={danger} class:btn-primary={!danger} on:click={() => dispatch('confirm')}>
        {confirmLabel}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .dialog {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    max-width: 420px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .message {
    color: var(--color-text-primary);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
  }
</style>
