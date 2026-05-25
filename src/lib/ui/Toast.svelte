<script lang="ts">
  import { toasts } from '$lib/stores/ui';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast-{toast.kind}">
      <button type="button" class="toast-message" on:click={() => toasts.dismiss(toast.id)}>
        {toast.message}
      </button>
      {#if toast.action}
        <button
          type="button"
          class="toast-action"
          on:click={() => {
            toast.action?.run();
            toasts.dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    z-index: 1000;
    width: min(460px, calc(100vw - 2 * var(--space-lg)));
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 12px 16px;
    background: var(--surface-glass-strong);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border);
    border-left-width: 3px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    animation: slideUp var(--transition-normal) ease forwards;
  }

  .toast-message {
    flex: 1;
    text-align: left;
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--color-text-primary);
    background: none;
    cursor: pointer;
  }

  .toast-action {
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-gold);
    background: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
  }
  .toast-action:hover { background: var(--color-bg-hover); }

  .toast-success { border-left-color: var(--color-green); }
  .toast-warning { border-left-color: var(--color-gold); }
  .toast-error { border-left-color: var(--color-red); }
  .toast-info { border-left-color: var(--color-blue); }
</style>
