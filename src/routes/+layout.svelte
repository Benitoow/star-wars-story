<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme, sidebarOpen, toasts } from '$lib/stores/ui';
  import { initializeDB } from '$lib/db';
  import Toast from '$lib/components/Toast.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';

  let initialized = false;

  onMount(async () => {
    await initializeDB();
    await theme.init();
    initialized = true;
  });
</script>

<div class="app" class:sidebar-open={$sidebarOpen}>
  <Sidebar />
  
  <main class="main-content">
    <Header />
    <div class="page-content">
      {#if initialized}
        <slot />
      {:else}
        <div class="loading-screen">
          <div class="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      {/if}
    </div>
  </main>

  <Toast />
</div>

<style>
  .app {
    display: flex;
    min-height: 100vh;
    background: var(--color-bg-primary);
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition: margin-left var(--transition-normal);
  }

  @media (max-width: 768px) {
    .main-content {
      margin-left: 0;
    }
  }

  .page-content {
    flex: 1;
    padding: var(--space-lg);
    overflow-y: auto;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-md);
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
