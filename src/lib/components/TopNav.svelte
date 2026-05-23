<script lang="ts">
  import { page } from '$app/stores';
  import { uiLanguage } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';

  $: lang = resolveUiLanguage($uiLanguage) === 'fr' ? 'fr' : 'en';
  $: t = lang === 'fr'
    ? { newAdventure: 'Nouvelle aventure', settings: 'Paramètres', home: 'Accueil' }
    : { newAdventure: 'New adventure', settings: 'Settings', home: 'Home' };

  $: path = $page.url.pathname;
  // Keep the chrome out of the way during immersive play.
  $: immersive = path.startsWith('/editor/');
</script>

{#if !immersive}
  <header class="topnav">
    <a class="brand" href="/" aria-label={t.home}>
      <svg class="brand-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z" />
      </svg>
      <span class="brand-text">STAR&nbsp;WARS</span>
      <span class="brand-sub">Story</span>
    </a>

    <nav class="topnav-actions" aria-label={t.home}>
      <a class="btn btn-primary new-btn" href="/stories/new">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="15" height="15" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span class="new-btn-label">{t.newAdventure}</span>
      </a>
      <a class="settings-link" class:active={path.startsWith('/settings')} href="/settings" aria-label={t.settings} title={t.settings}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </a>
    </nav>
  </header>
{/if}

<style>
  .topnav {
    position: sticky;
    top: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    height: var(--header-height);
    padding: 0 clamp(var(--space-md), 4vw, var(--space-2xl));
    background: rgba(7, 7, 12, 0.72);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border-subtle);
  }

  .brand {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    color: var(--color-text-primary);
    text-decoration: none;
  }

  .brand-mark {
    width: 22px;
    height: 22px;
    color: var(--color-gold);
    align-self: center;
  }

  .brand-text {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 2px;
  }

  .brand-sub {
    font-family: var(--font-narrative);
    font-style: italic;
    font-size: 0.95rem;
    color: var(--color-gold);
  }

  .topnav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .new-btn {
    text-decoration: none;
  }

  .settings-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    transition: color var(--transition-fast), background var(--transition-fast);
  }

  .settings-link:hover,
  .settings-link.active {
    color: var(--color-gold);
    background: var(--color-bg-hover);
  }

  @media (max-width: 560px) {
    .brand-sub { display: none; }
    .new-btn-label { display: none; }
    .new-btn { padding: var(--space-sm); }
  }
</style>
