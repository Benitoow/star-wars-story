<script lang="ts">
  import { toasts } from '$lib/stores/ui';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <button
      type="button"
      class="toast toast-{toast.kind}"
      on:click={() => toasts.dismiss(toast.id)}
    >
      {toast.message}
    </button>
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
    pointer-events: none;
    width: min(440px, calc(100vw - 2 * var(--space-lg)));
  }

  .toast {
    pointer-events: auto;
    text-align: left;
    padding: 12px 16px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--color-text-primary);
    background: var(--surface-glass-strong);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border);
    border-left-width: 3px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    animation: slideUp var(--transition-normal) ease forwards;
  }

  .toast-success { border-left-color: var(--color-green); }
  .toast-warning { border-left-color: var(--color-gold); }
  .toast-error { border-left-color: var(--color-red); }
  .toast-info { border-left-color: var(--color-blue); }
</style>
