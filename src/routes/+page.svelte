<script lang="ts">
  import { onMount } from 'svelte';
  import { stories, filteredStories } from '$lib/stores/stories';
  import { viewMode, uiLanguage, resetFilters, searchQuery, sortBy, sortDirection, filters } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';
  import { ERAS } from '$lib/editor/setupCatalog';
  import StoryCard from '$lib/components/StoryCard.svelte';

  let loading = true;

  const DASHBOARD_COPY = {
    fr: {
      title: 'Mes Histoires',
      loading: 'Chargement...',
      noStories: 'Aucune histoire',
      emptyText: 'Votre Holocron personnel est vide. Créez votre première aventure Star Wars.',
      create: 'Créer une histoire',
      countSingle: 'histoire',
      countPlural: 'histoires',
      searchPlaceholder: 'Rechercher dans vos histoires…',
      sortLabel: 'Trier par',
      sortUpdated: 'Dernière modification',
      sortCreated: 'Date de création',
      sortTitle: 'Titre',
      sortPlayed: 'Dernière lecture',
      allEras: 'Toutes les époques'
    },
    en: {
      title: 'My Stories',
      loading: 'Loading...',
      noStories: 'No stories yet',
      emptyText: 'Your personal Holocron is empty. Create your first Star Wars adventure.',
      create: 'Create a story',
      countSingle: 'story',
      countPlural: 'stories',
      searchPlaceholder: 'Search your stories…',
      sortLabel: 'Sort by',
      sortUpdated: 'Last modified',
      sortCreated: 'Date created',
      sortTitle: 'Title',
      sortPlayed: 'Last played',
      allEras: 'All eras'
    }
  } as const;

  onMount(async () => {
    resetFilters();
    await stories.load();
    loading = false;
  });

  $: currentLang = resolveUiLanguage($uiLanguage);
  $: copy = DASHBOARD_COPY[currentLang === 'fr' ? 'fr' : 'en'];

  let searchInput = '';
  $: searchQuery.set(searchInput);

  function setEraFilter(eraId: string | null) {
    filters.update(f => ({ ...f, era: eraId || undefined }));
  }

  function setSort(sort: 'updatedAt' | 'createdAt' | 'title' | 'lastPlayedAt') {
    sortBy.set(sort);
  }

  function toggleSortDir() {
    sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
  }

  $: currentSortLabel = {
    updatedAt: copy.sortUpdated,
    createdAt: copy.sortCreated,
    title: copy.sortTitle,
    lastPlayedAt: copy.sortPlayed
  }[$sortBy];

  $: activeEra = $filters.era;
</script>

<svelte:head>
  <title>Mes Histoires — Star Wars Story</title>
</svelte:head>

<div class="dashboard">
  <!-- Header bar -->
  <div class="dashboard-bar">
    <div class="bar-title">
      <h2>{copy.title}</h2>
      {#if !loading}
        <span class="story-count">{$filteredStories.length} {$filteredStories.length !== 1 ? copy.countPlural : copy.countSingle}</span>
      {/if}
    </div>

    <!-- Search -->
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        class="search-input"
        type="text"
        bind:value={searchInput}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.searchPlaceholder}
      />
      {#if searchInput}
        <button class="search-clear" on:click={() => searchInput = ''} aria-label="Effacer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Sort -->
    <div class="sort-wrap">
      <span class="sort-label">{copy.sortLabel}:</span>
      <button class="sort-btn" on:click={toggleSortDir} title="Inverser l'ordre">
        {currentSortLabel}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
          {#if $sortDirection === 'desc'}
            <polyline points="6 9 12 15 18 9"/>
          {:else}
            <polyline points="18 15 12 9 6 15"/>
          {/if}
        </svg>
      </button>
    </div>
  </div>

  <!-- Era filter chips -->
  {#if !loading && $filteredStories.length > 0 || true}
    <div class="era-chips" role="group" aria-label="Filtrer par époque">
      <button
        class="era-chip"
        class:active={!activeEra}
        on:click={() => setEraFilter(null)}
      >{copy.allEras}</button>
      {#each ERAS as era}
        <button
          class="era-chip"
          class:active={activeEra === era.id}
          on:click={() => setEraFilter(era.id)}
        >{era.name}</button>
      {/each}
    </div>
  {/if}

  <!-- Stories Grid -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>{copy.loading}</p>
    </div>
  {:else if $filteredStories.length === 0}
    <div class="empty-state">
      <div class="empty-holo">
        <div class="holo-ring"></div>
        <div class="holo-core">✨</div>
      </div>
      <h3>{copy.noStories}</h3>
      <p>{copy.emptyText}</p>
      <a href="/stories/new" class="btn btn-primary btn-lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {copy.create}
      </a>
    </div>
  {:else}
    <div class="stories-grid" class:list-view={$viewMode === 'list'}>
      {#each $filteredStories as story (story.id)}
        <StoryCard {story} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding-bottom: var(--space-2xl);
  }

  /* Bar */
  .dashboard-bar {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .bar-title {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .bar-title h2 {
    font-size: 1.25rem;
    color: var(--color-text-primary);
  }

  .story-count {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  /* Search */
  .search-wrap {
    flex: 1;
    min-width: 180px;
    max-width: 360px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    width: 15px;
    height: 15px;
    color: var(--color-text-muted);
    pointer-events: none;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    padding: 8px 34px 8px 32px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-family: var(--font-body);
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-gold);
    background: var(--color-bg-secondary);
  }

  .search-input::placeholder { color: var(--color-text-muted); }

  .search-clear {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: 50%;
    transition: color var(--transition-fast);
  }

  .search-clear:hover { color: var(--color-text-primary); }

  /* Sort */
  .sort-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .sort-label {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .sort-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--transition-fast);
    font-family: var(--font-body);
  }

  .sort-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  /* Era chips */
  .era-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .era-chip {
    padding: 4px 12px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: var(--font-body);
    white-space: nowrap;
  }

  .era-chip:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .era-chip.active {
    background: rgba(255, 232, 31, 0.12);
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  /* Stories grid */
  .stories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-lg);
  }

  .stories-grid.list-view {
    grid-template-columns: 1fr;
  }

  /* Loading */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-2xl);
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

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-2xl) var(--space-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    text-align: center;
    margin-top: var(--space-md);
  }

  .empty-holo {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .holo-ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(255, 232, 31, 0.3);
    border-radius: 50%;
    animation: holo-pulse 2s ease-in-out infinite;
  }

  .holo-ring::after {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(255, 232, 31, 0.2);
    border-radius: 50%;
    animation: holo-pulse 2s ease-in-out infinite 0.4s;
  }

  .holo-core {
    font-size: 2rem;
    z-index: 1;
  }

  @keyframes holo-pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }

  .empty-state h3 {
    font-size: 1.2rem;
    color: var(--color-text-primary);
  }

  .empty-state p {
    color: var(--color-text-muted);
    max-width: 380px;
    margin: 0;
  }

  .btn-lg {
    padding: 10px 20px;
    font-size: 0.95rem;
  }

  .empty-state .btn svg {
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .dashboard-bar {
      flex-direction: column;
      align-items: stretch;
    }
    .search-wrap { max-width: 100%; }
    .bar-title { justify-content: center; }
    .sort-wrap { justify-content: center; }
    .stories-grid { grid-template-columns: 1fr; }
  }
</style>
