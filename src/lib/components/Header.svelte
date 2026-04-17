<script lang="ts">
  import { goto } from '$app/navigation';
  import { sidebarOpen, toggleSidebar, searchOpen, searchQuery, uiLanguage, viewMode } from '$lib/stores/ui';
  import { UI_LANGUAGE_OPTIONS, type UiLanguageCode } from '$lib/config/languages';

  function handleNewStory() {
    goto('/editor/new');
  }

  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    uiLanguage.set(target.value as UiLanguageCode);
  }
</script>

<header class="header">
  <div class="header-left">
    {#if !$sidebarOpen}
      <button
        class="menu-toggle"
        type="button"
        on:click={toggleSidebar}
        aria-label="Ouvrir le menu latéral"
        aria-expanded="false"
        aria-controls="app-sidebar"
      >
        <span class="menu-toggle-box" aria-hidden="true">
          <span class="menu-toggle-inner"></span>
        </span>
      </button>
    {:else}
      <span class="menu-toggle-spacer" aria-hidden="true"></span>
    {/if}

    <div class="search-bar" class:open={$searchOpen}>
      <button class="search-toggle" on:click={() => searchOpen.update(v => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher une histoire..."
        bind:value={$searchQuery}
        on:blur={() => !$searchQuery && searchOpen.set(false)}
      />
      {#if $searchQuery}
        <button class="search-clear" on:click={() => searchQuery.set('')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="header-right">
    <label class="language-switcher" title="Langue de l'interface">
      <span class="language-switcher-label">Langue</span>
      <select class="language-select" value={$uiLanguage} on:change={handleLanguageChange} aria-label="Langue de l'interface">
        {#each UI_LANGUAGE_OPTIONS as language}
          <option value={language.code}>{language.name}</option>
        {/each}
      </select>
    </label>

    <div class="view-toggle hide-mobile">
      <button
        class="view-btn"
        class:active={$viewMode === 'grid'}
        on:click={() => viewMode.set('grid')}
        title="Vue grille"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button
        class="view-btn"
        class:active={$viewMode === 'list'}
        on:click={() => viewMode.set('list')}
        title="Vue liste"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
    </div>

    <button class="btn btn-primary new-story-btn" on:click={handleNewStory}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="hide-mobile">Nouvelle Histoire</span>
    </button>
  </div>
</header>


<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex: 1;
  }

  .menu-toggle {
    width: 40px;
    height: 40px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    position: relative;
    overflow: hidden;
  }

  .menu-toggle-spacer {
    width: 40px;
    height: 40px;
    display: inline-block;
    flex-shrink: 0;
  }

  .menu-toggle:hover {
    background: var(--color-bg-hover);
    color: var(--color-gold);
    border-color: var(--color-border-hover);
  }

  .menu-toggle:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 2px;
  }

  .menu-toggle-box {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    pointer-events: none;
  }

  .menu-toggle-inner,
  .menu-toggle-inner::before,
  .menu-toggle-inner::after {
    position: absolute;
    width: 18px;
    height: 2px;
    border-radius: 99px;
    background: currentColor;
    transition:
      transform var(--transition-normal),
      opacity var(--transition-fast),
      width var(--transition-fast),
      box-shadow var(--transition-normal),
      background-color var(--transition-fast);
  }

  .menu-toggle-inner {
    top: 11px;
    left: 3px;
    box-shadow: 0 0 8px rgba(255, 232, 31, 0.2);
  }

  .menu-toggle-inner::before,
  .menu-toggle-inner::after {
    content: '';
    left: 0;
  }

  .menu-toggle-inner::before {
    top: -6px;
  }

  .menu-toggle-inner::after {
    top: 6px;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-xs) var(--space-sm);
    max-width: 300px;
    width: 100%;
    transition: all var(--transition-fast);
  }

  .search-bar:focus-within {
    border-color: var(--color-gold);
    box-shadow: 0 0 0 3px rgba(255, 232, 31, 0.1);
  }

  .search-toggle {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .search-toggle svg {
    width: 20px;
    height: 20px;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .search-clear {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .search-clear svg {
    width: 16px;
    height: 16px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .language-switcher {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 0 var(--space-sm);
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .language-switcher-label {
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .language-select {
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font: inherit;
    outline: none;
    cursor: pointer;
    max-width: 110px;
  }

  .language-select option {
    color: var(--color-text-primary);
  }
  .view-toggle {
    display: flex;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .view-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .view-btn:hover {
    color: var(--color-text-primary);
  }

  .view-btn.active {
    background: var(--color-bg-hover);
    color: var(--color-gold);
  }

  .view-btn svg {
    width: 18px;
    height: 18px;
  }

  .new-story-btn {
    padding: var(--space-sm) var(--space-md);
  }

  .new-story-btn svg {
    width: 18px;
    height: 18px;
  }

  .hide-mobile {
    display: none;
  }

  @media (min-width: 769px) {
    .hide-mobile {
      display: flex;
    }
  }

  @media (max-width: 768px) {
    .header {
      padding: var(--space-sm) var(--space-md);
    }

    .language-switcher {
      height: 36px;
    }

    .language-switcher-label {
      display: none;
    }

    .language-select {
      max-width: 92px;
    }

    .search-bar {
      max-width: 200px;
    }
  }
</style>
