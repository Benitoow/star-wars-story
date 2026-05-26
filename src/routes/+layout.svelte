<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { initDB } from '$lib/persistence';
  import { preferences } from '$lib/stores/preferences';
  import { logger } from '$lib/logger';
  import Toast from '$lib/ui/Toast.svelte';
  import TopNav from '$lib/ui/TopNav.svelte';

  let ready = false;

  // Immersive routes (play, creation) hide the global nav.
  $: immersive = $page.url.pathname.startsWith('/play') || $page.url.pathname.startsWith('/new');

  onMount(() => {
    void (async () => {
      try {
        await initDB();
        await preferences.load();
      } catch (error) {
        logger.error('boot failed', error);
      }
      ready = true;
    })();
  });
</script>

<div class="app">
  {#if ready && !immersive}<TopNav />{/if}
  <main class="main">
    {#if ready}
      <slot />
    {:else}
      <div class="boot"><div class="boot-spinner"></div></div>
    {/if}
  </main>
  <Toast />
</div>

<style>
  .app {
    position: relative;
    min-height: 100vh;
    background: var(--color-bg-primary);
  }
  .main {
    min-height: 100vh;
  }
  .boot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .boot-spinner {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-subtle);
    border-top-color: var(--color-text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
