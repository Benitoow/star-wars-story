<script lang="ts">
  import { toasts } from '$lib/stores/ui';
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}" role="alert">
      <div class="toast-icon">
        {#if toast.type === 'success'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        {:else if toast.type === 'error'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        {:else if toast.type === 'warning'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        {/if}
      </div>
      <span class="toast-message">{toast.message}</span>
      {#if toast.action}
        <button class="toast-action" on:click={() => { toast.action?.onClick(); toasts.remove(toast.id); }}>
          {toast.action.label}
        </button>
      {/if}
      <button class="toast-close" aria-label="Fermer la notification" on:click={() => toasts.remove(toast.id)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: var(--space-lg);
    right: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    z-index: 1000;
    max-width: 400px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.3s ease;
  }

  .toast-success {
    border-left: 3px solid var(--color-green);
  }

  .toast-error {
    border-left: 3px solid var(--color-red);
  }

  .toast-warning {
    border-left: 3px solid var(--color-gold);
  }

  .toast-info {
    border-left: 3px solid var(--color-blue);
  }

  .toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .toast-icon svg {
    width: 100%;
    height: 100%;
  }

  .toast-success .toast-icon {
    color: var(--color-green);
  }

  .toast-error .toast-icon {
    color: var(--color-red);
  }

  .toast-warning .toast-icon {
    color: var(--color-gold);
  }

  .toast-info .toast-icon {
    color: var(--color-blue);
  }

  .toast-message {
    flex: 1;
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .toast-action {
    flex-shrink: 0;
    padding: 4px 12px;
    background: rgba(255, 232, 31, 0.12);
    border: 1px solid var(--color-gold);
    border-radius: var(--radius-sm);
    color: var(--color-gold);
    font-family: var(--font-display);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .toast-action:hover {
    background: rgba(255, 232, 31, 0.22);
  }

  .toast-close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .toast-close:hover {
    color: var(--color-text-primary);
  }

  .toast-close svg {
    width: 100%;
    height: 100%;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 480px) {
    .toast-container {
      left: var(--space-md);
      right: var(--space-md);
      bottom: var(--space-md);
      max-width: none;
    }
  }
</style>
