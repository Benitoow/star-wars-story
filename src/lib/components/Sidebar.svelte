<script lang="ts">
  import { page } from '$app/stores';
  import { sidebarOpen, toggleSidebar } from '$lib/stores/ui';
  import { folders } from '$lib/stores/stories';

  const navItems = [
    { href: '/', label: 'Dashboard', icon: 'home' },
    { href: '/stories', label: 'Mes Histoires', icon: 'book' },
    { href: '/folders', label: 'Dossiers', icon: 'folder' },
    { href: '/trash', label: 'Corbeille', icon: 'trash' },
    { href: '/settings', label: 'Paramètres', icon: 'settings' }
  ];

  $: currentPath = $page.url.pathname;

  async function loadFolders() {
    await folders.load();
  }

  loadFolders();
</script>

<aside class="sidebar" class:open={$sidebarOpen}>
  <div class="sidebar-header">
    <a href="/" class="logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z"/>
      </svg>
      <span class="logo-text">Star Wars</span>
    </a>
    <button class="sidebar-close hide-desktop" on:click={toggleSidebar}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  <nav class="sidebar-nav">
    {#each navItems as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))}
      >
        <span class="nav-icon">
          {#if item.icon === 'home'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          {:else if item.icon === 'book'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
          {:else if item.icon === 'folder'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/>
            </svg>
          {:else if item.icon === 'trash'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          {:else if item.icon === 'settings'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          {/if}
        </span>
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  {#if $folders.length > 0}
    <div class="sidebar-section">
      <h3 class="section-title">Mes Dossiers</h3>
      <div class="folder-list">
        {#each $folders.slice(0, 5) as folder}
          <a href="/folders/{folder.id}" class="folder-item" style="--folder-color: {folder.color}">
            <span class="folder-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/>
              </svg>
            </span>
            <span class="folder-name">{folder.name}</span>
            {#if folder.storyCount}
              <span class="folder-count">{folder.storyCount}</span>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <div class="sidebar-footer">
    <a href="/settings" class="footer-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
      <span>Français</span>
    </a>
  </div>
</aside>

<!-- Mobile overlay -->
{#if $sidebarOpen}
  <div class="sidebar-overlay hide-desktop" on:click={toggleSidebar}></div>
{/if}

<style>
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform var(--transition-normal);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  @media (min-width: 769px) {
    .sidebar {
      transform: translateX(0);
    }
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--color-gold);
    text-decoration: none;
  }

  .logo-icon {
    width: 28px;
    height: 28px;
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .sidebar-close {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .sidebar-close svg {
    width: 100%;
    height: 100%;
  }

  .sidebar-nav {
    flex: 1;
    padding: var(--space-md);
    overflow-y: auto;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    margin-bottom: var(--space-xs);
    color: var(--color-text-secondary);
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .nav-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .nav-item.active {
    background: rgba(255, 232, 31, 0.1);
    color: var(--color-gold);
  }

  .nav-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .nav-icon svg {
    width: 100%;
    height: 100%;
  }

  .nav-label {
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .sidebar-section {
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--color-border);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: var(--space-sm);
  }

  .folder-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .folder-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    color: var(--color-text-secondary);
    text-decoration: none;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    transition: all var(--transition-fast);
  }

  .folder-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .folder-icon {
    width: 16px;
    height: 16px;
    color: var(--folder-color, var(--color-gold));
  }

  .folder-icon svg {
    width: 100%;
    height: 100%;
  }

  .folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-count {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .sidebar-footer {
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--color-border);
  }

  .footer-link {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 0.875rem;
    transition: color var(--transition-fast);
  }

  .footer-link:hover {
    color: var(--color-text-primary);
  }

  .footer-link svg {
    width: 16px;
    height: 16px;
  }

  .hide-desktop {
    display: block;
  }

  @media (min-width: 769px) {
    .hide-desktop {
      display: none;
    }
  }
</style>
