<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { theme, uiLanguage, sidebarOpen, searchOpen, toggleSidebar, toasts } from '$lib/stores/ui';
  import { initializeDB, cleanupOldTrash } from '$lib/db';
  import Toast from '$lib/components/Toast.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';

  let initialized = false;

  onMount(async () => {
    await initializeDB();
    await theme.init();
    await uiLanguage.init();
    initialized = true;

    // Run trash cleanup in background — no await, non-blocking
    cleanupOldTrash(30).catch(() => {});

    // Close sidebar on mobile by default
    if (window.innerWidth < 769) {
      sidebarOpen.set(false);
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    switch (e.key) {
      case 'n':
        e.preventDefault();
        goto('/editor/new');
        break;
      case 'f':
        e.preventDefault();
        searchOpen.set(true);
        break;
      case 'b':
        e.preventDefault();
        toggleSidebar();
        break;
      case ',':
        e.preventDefault();
        goto('/settings');
        break;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

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
