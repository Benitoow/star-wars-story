<script lang="ts">
  import { onMount } from 'svelte';
  import { stories, filteredStories, recentStories, loadRecentStories } from '$lib/stores/stories';
  import { viewMode, filters, sortBy, sortDirection, uiLanguage } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';
  import StoryCard from '$lib/components/StoryCard.svelte';

  let loading = true;

  const ERAS = [
    { id: 'old_republic', fr: 'Ancienne République', en: 'Old Republic' },
    { id: 'clone_wars', fr: 'Guerres des Clones', en: 'Clone Wars' },
    { id: 'imperial', fr: 'Ère Impériale', en: 'Imperial Era' },
    { id: 'new_republic', fr: 'Nouvelle République', en: 'New Republic' },
    { id: 'first_order', fr: 'Premier Ordre', en: 'First Order' }
  ];

  const FACTIONS = [
    { id: 'jedi', fr: 'Ordre Jedi', en: 'Jedi Order' },
    { id: 'sith', fr: 'Ordre Sith', en: 'Sith Order' },
    { id: 'empire', fr: 'Empire', en: 'Empire' },
    { id: 'rebels', fr: 'Alliance Rebelle', en: 'Rebel Alliance' },
    { id: 'republic', fr: 'République', en: 'Republic' },
    { id: 'mandalore', fr: 'Mandalorians', en: 'Mandalorians' },
    { id: 'first_order', fr: 'Premier Ordre', en: 'First Order' },
    { id: 'hutt', fr: 'Cartel Hutt', en: 'Hutt Cartel' },
    { id: 'neutral', fr: 'Indépendant', en: 'Independent' }
  ];

  const DASHBOARD_COPY = {
    fr: {
      title: 'Dashboard — Star Wars Story Manager',
      era: 'Ère:',
      faction: 'Faction:',
      clear: 'Effacer les filtres',
      myStories: 'Mes Histoires',
      loading: 'Chargement de vos histoires...',
      noStories: 'Aucune histoire',
      emptyText: 'Commencez votre aventure en créant votre première histoire Star Wars!',
      create: 'Créer une histoire',
      countSingle: 'histoire',
      countPlural: 'histoires'
    },
    en: {
      title: 'Dashboard — Star Wars Story Manager',
      era: 'Era:',
      faction: 'Faction:',
      clear: 'Clear filters',
      myStories: 'My Stories',
      loading: 'Loading your stories...',
      noStories: 'No stories yet',
      emptyText: 'Start your adventure by creating your first Star Wars story!',
      create: 'Create a story',
      countSingle: 'story',
      countPlural: 'stories'
    }
  } as const;

  function pickText(entry: { fr?: string; en?: string }) {
    return currentLang === 'fr' ? (entry.fr || entry.en || '') : (entry.en || entry.fr || '');
  }

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
  $: currentLang = resolveUiLanguage($uiLanguage);
  $: copy = DASHBOARD_COPY[currentLang === 'fr' ? 'fr' : 'en'];
</script>

<svelte:head>
  <title>{copy.title}</title>
</svelte:head>

<div class="dashboard">
  <!-- Filters -->
  <section class="filters-section">
    <div class="filter-group">
      <span class="filter-label">{copy.era}</span>
      <div class="filter-chips">
        {#each ERAS as era}
          <button
            class="chip"
            class:active={$filters.era === era.id}
            on:click={() => toggleEraFilter(era.id)}
          >
            {pickText(era)}
          </button>
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="filter-label">{copy.faction}</span>
      <div class="filter-chips">
        {#each FACTIONS as faction}
          <button
            class="chip"
            class:active={$filters.faction === faction.id}
            on:click={() => toggleFactionFilter(faction.id)}
          >
            {pickText(faction)}
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
        {copy.clear}
      </button>
    {/if}
  </section>

  <!-- Stories Grid -->
  <section class="stories-section">
    <div class="section-header">
      <h2>{copy.myStories}</h2>
      <span class="story-count">
        {$filteredStories.length} {$filteredStories.length !== 1 ? copy.countPlural : copy.countSingle}
      </span>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>{copy.loading}</p>
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
        <h3>{copy.noStories}</h3>
        <p>{copy.emptyText}</p>
        <a href="/stories/new" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
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
  </section>
</div>

<style>
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
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
