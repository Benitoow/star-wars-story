<script lang="ts">
  import { onMount } from 'svelte';
  import { stories, filteredStories } from '$lib/stores/stories';
  import { viewMode, uiLanguage, resetFilters } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';
  import StoryCard from '$lib/components/StoryCard.svelte';

  let loading = true;

  const DASHBOARD_COPY = {
    fr: {
      title: 'Dashboard — Star Wars Story Manager',
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
      myStories: 'My Stories',
      loading: 'Loading your stories...',
      noStories: 'No stories yet',
      emptyText: 'Start your adventure by creating your first Star Wars story!',
      create: 'Create a story',
      countSingle: 'story',
      countPlural: 'stories'
    }
  } as const;

  onMount(async () => {
    resetFilters();
    await stories.load();
    loading = false;
  });
  $: currentLang = resolveUiLanguage($uiLanguage);
  $: copy = DASHBOARD_COPY[currentLang === 'fr' ? 'fr' : 'en'];
</script>

<svelte:head>
  <title>{copy.title}</title>
</svelte:head>

<div class="dashboard">
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
    .stories-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
