<script lang="ts">
  import '../app.css';
  import { browser, dev } from '$app/environment';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { showToast, theme, uiLanguage, sidebarOpen, searchOpen, toggleSidebar } from '$lib/stores/ui';
  import { initializeDB, cleanupOldTrash } from '$lib/db';
  import { logger } from '$lib/utils/logger';
  import Toast from '$lib/components/Toast.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';

  let initialized = false;

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

        if (registration.waiting) {
          applyWaitingWorker();
        }

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

      if (registrationRef) {
        registrationRef.removeEventListener('updatefound', handleUpdateFound);
      }

      if (updateIntervalId !== undefined) {
        window.clearInterval(updateIntervalId);
      }
    };
  }

  onMount(() => {
    const cleanupConnectivity = setupConnectivityMonitoring();
    const cleanupServiceWorker = setupServiceWorkerLifecycle();

    void (async () => {
      try {
        await initializeDB();
      } catch (e) {
        logger.error('layout: initialisation DB échouée.', e);
      }

      try {
        await theme.init();
        await uiLanguage.init();
      } catch (e) {
        logger.error('layout: initialisation stores échouée.', e);
      }

      initialized = true;

      cleanupOldTrash(30).catch((error: unknown) => {
        logger.warn('layout: nettoyage corbeille échoué.', error);
      });

      if (window.innerWidth >= 769) {
        sidebarOpen.set(true);
      }
    })();

    return () => {
      cleanupConnectivity();
      cleanupServiceWorker();
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    switch (e.key) {
      case 'n':
        e.preventDefault();
        goto('/stories/new');
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
