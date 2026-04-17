<script lang="ts">
  import { goto } from '$app/navigation';
  import { sidebarOpen, toggleSidebar, searchOpen, searchQuery, uiLanguage, viewMode } from '$lib/stores/ui';
  import { UI_LANGUAGE_OPTIONS, type UiLanguageCode } from '$lib/config/languages';

  let langOpen = false;
  let langBtnEl: HTMLButtonElement | null = null;

  function handleNewStory() { goto('/editor/new'); }

  function selectLang(code: UiLanguageCode) {
    uiLanguage.set(code);
    langOpen = false;
  }

  function toggleLang(e: MouseEvent) {
    e.stopPropagation();
    langOpen = !langOpen;
  }

  function onWindowClick(e: MouseEvent) {
    if (!langOpen) return;
    if (langBtnEl?.parentElement?.contains(e.target as Node)) return;
    langOpen = false;
  }

  $: currentLang = UI_LANGUAGE_OPTIONS.find(l => l.code === $uiLanguage)?.name ?? 'Auto';
</script>

<svelte:window on:click={onWindowClick} />

<header class="header">
  <!-- Left -->
  <div class="header-left">
    {#if !$sidebarOpen}
      <button class="menu-toggle" type="button" on:click={toggleSidebar}
        aria-label="Ouvrir le menu" aria-expanded="false">
        <span class="burger" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>
    {:else}
      <span class="menu-spacer" aria-hidden="true"></span>
    {/if}

    <div class="search-bar" class:open={$searchOpen}>
      <button class="search-toggle" on:click={() => searchOpen.update(v => !v)} aria-label="Recherche">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher…"
        bind:value={$searchQuery}
        on:blur={() => !$searchQuery && searchOpen.set(false)}
      />
      {#if $searchQuery}
        <button class="search-clear" on:click={() => searchQuery.set('')} aria-label="Effacer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Right -->
  <div class="header-right">

    <!-- Language picker (custom dropdown) -->
    <div class="lang-picker">
      <button
        class="lang-btn"
        bind:this={langBtnEl}
        on:click={toggleLang}
        aria-haspopup="listbox"
        aria-expanded={langOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
        </svg>
        <span class="lang-label">{currentLang}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"
          style="transition: transform 0.15s; transform: rotate({langOpen ? 180 : 0}deg)">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      {#if langOpen}
        <ul class="lang-dropdown" role="listbox">
          {#each UI_LANGUAGE_OPTIONS as lang}
            <li role="option" aria-selected={$uiLanguage === lang.code}>
              <button
                class="lang-option"
                class:active={$uiLanguage === lang.code}
                on:click={() => selectLang(lang.code)}
              >
                {lang.name}
                {#if $uiLanguage === lang.code}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    width="13" height="13" style="flex-shrink:0">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- View toggle -->
    <div class="view-toggle hide-mobile">
      <button class="view-btn" class:active={$viewMode === 'grid'}
        on:click={() => viewMode.set('grid')} title="Vue grille">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button class="view-btn" class:active={$viewMode === 'list'}
        on:click={() => viewMode.set('list')} title="Vue liste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="8" y1="6"  x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="3" cy="6"  r="1" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </div>

    <!-- New story -->
    <button class="btn btn-primary new-btn" on:click={handleNewStory}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="hide-mobile">Nouvelle Histoire</span>
    </button>
  </div>
</header>

<style>
  /* ── Shell ─────────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 200;
    height: 56px;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .header-left { flex: 1; }
  .header-right { flex-shrink: 0; }

  /* ── Burger ────────────────────────────────── */
  .menu-toggle {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }

  .menu-toggle:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border);
  }

  .menu-spacer {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .burger {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .burger span {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
  }

  /* ── Search ────────────────────────────────── */
  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 0 var(--space-sm);
    height: 36px;
    max-width: 280px;
    width: 100%;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .search-bar:focus-within {
    border-color: var(--color-gold);
    box-shadow: 0 0 0 3px rgba(255, 232, 31, 0.08);
  }

  .search-toggle {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    outline: none;
    min-width: 0;
  }

  .search-input::placeholder { color: var(--color-text-muted); }

  .search-clear {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  /* ── Language picker ───────────────────────── */
  .lang-picker {
    position: relative;
  }

  .lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 10px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color var(--transition-fast), color var(--transition-fast);
    white-space: nowrap;
  }

  .lang-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-text-primary);
  }

  .lang-label {
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Dropdown list */
  .lang-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 160px;
    background: var(--color-bg-elevated, var(--color-bg-secondary));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    z-index: 300;
    padding: 4px;
    list-style: none;
    margin: 0;
    animation: dropdown-in 0.12s ease;
  }

  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }

  .lang-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 10px;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .lang-option:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .lang-option.active {
    color: var(--color-gold);
    font-weight: 600;
  }

  /* ── View toggle ───────────────────────────── */
  .view-toggle {
    display: flex;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .view-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .view-btn:hover  { color: var(--color-text-primary); }
  .view-btn.active { background: var(--color-bg-hover); color: var(--color-gold); }

  /* ── New button ────────────────────────────── */
  .new-btn {
    height: 36px;
    padding: 0 var(--space-md);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    font-size: 0.85rem;
  }

  /* ── Utilities ─────────────────────────────── */
  .hide-mobile { display: none; }

  @media (min-width: 769px) {
    .hide-mobile { display: flex; }
  }

  @media (max-width: 768px) {
    .header { padding: var(--space-xs) var(--space-md); }
    .search-bar { max-width: 180px; }
    .lang-label { max-width: 60px; }
  }
</style>
