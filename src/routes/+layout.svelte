<script lang="ts">
  import '../app.css';
  import { browser, dev } from '$app/environment';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { showToast, theme, uiLanguage } from '$lib/stores/ui';
  import { initializeDB, cleanupOldTrash } from '$lib/db';
  import { logger } from '$lib/utils/logger';
  import Toast from '$lib/components/Toast.svelte';
  import TopNav from '$lib/components/TopNav.svelte';

  let initialized = false;

  // Full-screen surfaces (home + play) run edge-to-edge behind the overlay nav.
  // Other pages clear the nav with top padding.
  $: flush = $page.url.pathname === '/' || $page.url.pathname.startsWith('/editor/');

  function setupConnectivityMonitoring(): () => void {
    if (!browser) return () => {};
    const handleOffline = (): void => {
      showToast('Mode hors ligne activé. Les contenus déjà chargés restent disponibles.', 'warning', 5000);
    };
    const handleOnline = (): void => {
      showToast('Connexion rétablie.', 'success', 2500);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }

  function setupServiceWorkerLifecycle(): () => void {
    if (!browser || dev || !('serviceWorker' in navigator)) return () => {};
    let registrationRef: ServiceWorkerRegistration | null = null;
    let updateIntervalId: number | undefined;
    let refreshing = false;

    const applyWaitingWorker = (): boolean => {
      const waitingWorker = registrationRef?.waiting;
      if (!waitingWorker) return false;
      showToast('Mise à jour prête, application en cours…', 'info', 3000);
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return true;
    };
    const handleControllerChange = (): void => {
      if (refreshing) return;
      refreshing = true;
      showToast('Application mise à jour. Rechargement…', 'info', 1800);
      window.setTimeout(() => window.location.reload(), 700);
    };
    const handleUpdateFound = (): void => {
      const installingWorker = registrationRef?.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          applyWaitingWorker();
        }
      }, { once: true });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    void navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        registrationRef = registration;
        registration.addEventListener('updatefound', handleUpdateFound);
        if (registration.waiting) applyWaitingWorker();
        updateIntervalId = window.setInterval(() => {
          void registration.update().catch((error: unknown) => {
            logger.debug('layout: vérification MAJ service worker échouée.', error);
          });
        }, 60 * 60 * 1000);
      })
      .catch((error: unknown) => {
        logger.warn('layout: enregistrement service worker échoué.', error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      if (registrationRef) registrationRef.removeEventListener('updatefound', handleUpdateFound);
      if (updateIntervalId !== undefined) window.clearInterval(updateIntervalId);
    };
  }

  onMount(() => {
    const cleanupConnectivity = setupConnectivityMonitoring();
    const cleanupServiceWorker = setupServiceWorkerLifecycle();

    void (async () => {
      try { await initializeDB(); } catch (e) { logger.error('layout: initialisation DB échouée.', e); }
      try { await theme.init(); await uiLanguage.init(); } catch (e) { logger.error('layout: initialisation stores échouée.', e); }
      initialized = true;
      cleanupOldTrash(30).catch((error: unknown) => {
        logger.warn('layout: nettoyage corbeille échoué.', error);
      });
    })();

    return () => { cleanupConnectivity(); cleanupServiceWorker(); };
  });

  function handleKeydown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    switch (e.key) {
      case 'n': e.preventDefault(); goto('/stories/new'); break;
      case ',': e.preventDefault(); goto('/settings'); break;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app">
  <TopNav />
  <main class="main" class:flush>
    {#if initialized}
      <slot />
    {:else}
      <div class="boot">
        <div class="boot-spinner"></div>
      </div>
    {/if}
  </main>
  <Toast />
</div>

<style>
  .app {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--color-bg-primary);
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Content pages clear the overlay nav; full-screen pages run behind it */
  .main:not(.flush) {
    padding-top: var(--header-height);
  }

  .boot {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .boot-spinner {
    width: 34px;
    height: 34px;
    border: 1px solid var(--border-subtle);
    border-top-color: var(--color-text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
