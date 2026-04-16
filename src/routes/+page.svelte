<script lang="ts">
  import { onMount } from 'svelte';
  import { stories, filteredStories, recentStories, loadRecentStories } from '$lib/stores/stories';
  import { viewMode, filters, sortBy, sortDirection } from '$lib/stores/ui';
  import StoryCard from '$lib/components/StoryCard.svelte';

  let loading = true;

  const ERAS = [
    { id: 'old_republic', name: 'Ancienne République' },
    { id: 'clone_wars', name: 'Guerres des Clones' },
    { id: 'imperial', name: 'Ère Impériale' },
    { id: 'new_republic', name: 'Nouvelle République' },
    { id: 'first_order', name: 'Premier Ordre' },
    { id: 'high_republic', name: 'Haute République' }
  ];

  const FACTIONS = [
    { id: 'jedi', name: 'Ordre Jedi' },
    { id: 'sith', name: 'Ordre Sith' },
    { id: 'empire', name: 'Empire' },
    { id: 'rebels', name: 'Alliance Rebelle' },
    { id: 'republic', name: 'République' },
    { id: 'mandalore', name: 'Mandalorians' },
    { id: 'first_order', name: 'Premier Ordre' },
    { id: 'hutt', name: 'Cartel Hutt' },
    { id: 'neutral', name: 'Indépendant' }
  ];

  onMount(async () => {
    await stories.load();
    await loadRecentStories();
    loading = false;
  });

  function toggleEraFilter(eraId: string) {
    filters.update(f => ({
      ...f,
      era: f.era === eraId ? undefined : eraId
    }));
  }

  function toggleFactionFilter(factionId: string) {
    filters.update(f => ({
      ...f,
      faction: f.faction === factionId ? undefined : factionId
    }));
  }

  function clearFilters() {
    filters.set({ tags: [] });
  }

  $: hasFilters = $filters.era || $filters.faction || $filters.tags.length > 0;
</script>

<svelte:head>
  <title>Dashboard — Star Wars Story Manager</title>
</svelte:head>

<div class="dashboard">
  <!-- Stats Overview -->
  <section class="stats-section">
    <div class="stat-card">
      <div class="stat-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
        </svg>
      </div>
      <div class="stat-content">
        <span class="stat-value">{$stories.length}</span>
        <span class="stat-label">Histoires</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon gold">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      </div>
      <div class="stat-content">
        <span class="stat-value">{$recentStories.length}</span>
        <span class="stat-label">Récents</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon purple">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
      </div>
      <div class="stat-content">
        <span class="stat-value">0</span>
        <span class="stat-label">Heures jouées</span>
      </div>
    </div>
  </section>

  <!-- Filters -->
  <section class="filters-section">
    <div class="filter-group">
      <span class="filter-label">Ère:</span>
      <div class="filter-chips">
        {#each ERAS as era}
          <button
            class="chip"
            class:active={$filters.era === era.id}
            on:click={() => toggleEraFilter(era.id)}
          >
            {era.name}
          </button>
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="filter-label">Faction:</span>
      <div class="filter-chips">
        {#each FACTIONS as faction}
          <button
            class="chip"
            class:active={$filters.faction === faction.id}
            on:click={() => toggleFactionFilter(faction.id)}
          >
            {faction.name}
          </button>
        {/each}
      </div>
    </div>

    {#if hasFilters}
      <button class="clear-filters" on:click={clearFilters}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Effacer les filtres
      </button>
    {/if}
  </section>

  <!-- Stories Grid -->
  <section class="stories-section">
    <div class="section-header">
      <h2>Mes Histoires</h2>
      <span class="story-count">{$filteredStories.length} histoire{$filteredStories.length !== 1 ? 's' : ''}</span>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Chargement de vos histoires...</p>
      </div>
    {:else if $filteredStories.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            <line x1="12" y1="8" x2="12" y2="14"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
          </svg>
        </div>
        <h3>Aucune histoire</h3>
        <p>Commencez votre aventure en créant votre première histoire Star Wars!</p>
        <a href="/stories/new" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Créer une histoire
        </a>
      </div>
    {:else}
      <div class="stories-grid" class:list-view={$viewMode === 'list'}>
        {#each $filteredStories as story (story.id)}
          <StoryCard {story} />
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Stats Section */
  .stats-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    padding: var(--space-sm);
    background: rgba(79, 195, 247, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-blue);
  }

  .stat-icon.gold {
    background: rgba(255, 232, 31, 0.1);
    color: var(--color-gold);
  }

  .stat-icon.purple {
    background: rgba(206, 147, 216, 0.1);
    color: var(--color-purple);
  }

  .stat-icon svg {
    width: 100%;
    height: 100%;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-top: var(--space-xs);
  }

  /* Filters Section */
  .filters-section {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-xl);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .filter-label {
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .chip {
    padding: var(--space-xs) var(--space-sm);
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.5px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .chip:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .chip.active {
    background: rgba(255, 232, 31, 0.15);
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .clear-filters {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: color var(--transition-fast);
    margin-left: auto;
    align-self: flex-end;
  }

  .clear-filters:hover {
    color: var(--color-red);
  }

  .clear-filters svg {
    width: 14px;
    height: 14px;
  }

  /* Stories Section */
  .stories-section {
    margin-bottom: var(--space-2xl);
  }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .section-header h2 {
    font-size: 1.25rem;
    color: var(--color-text-primary);
  }

  .story-count {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .stories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-lg);
  }

  .stories-grid.list-view {
    grid-template-columns: 1fr;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    margin-bottom: var(--space-lg);
    color: var(--color-text-muted);
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-state h3 {
    font-size: 1.125rem;
    margin-bottom: var(--space-sm);
  }

  .empty-state p {
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
    max-width: 400px;
  }

  .empty-state .btn {
    display: inline-flex;
  }

  .empty-state .btn svg {
    width: 18px;
    height: 18px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .stats-section {
      grid-template-columns: 1fr;
    }

    .filters-section {
      flex-direction: column;
    }

    .clear-filters {
      margin-left: 0;
    }

    .stories-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
