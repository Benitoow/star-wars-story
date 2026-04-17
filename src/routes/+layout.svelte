<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { theme, uiLanguage, sidebarOpen, searchOpen, toggleSidebar } from '$lib/stores/ui';
  import { initializeDB, cleanupOldTrash } from '$lib/db';
  import Toast from '$lib/components/Toast.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';

  let initialized = false;

  onMount(async () => {
    try {
      await initializeDB();
    } catch (e) {
      console.error('DB init failed:', e);
    }
    try {
      await theme.init();
      await uiLanguage.init();
    } catch (e) {
      console.error('Store init failed:', e);
    }
    initialized = true;

    cleanupOldTrash(30).catch(() => {});

    if (window.innerWidth >= 769) {
      sidebarOpen.set(true);
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
    margin-left: 0;
    transition: margin-left var(--transition-normal);
  }

  /* push content when sidebar is open on desktop */
  @media (min-width: 769px) {
    .app.sidebar-open .main-content {
      margin-left: var(--sidebar-width);
    }
  }

  .page-content {
    flex: 1;
    padding: var(--space-xl) var(--space-xl);
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .page-content {
      padding: var(--space-md);
    }
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
