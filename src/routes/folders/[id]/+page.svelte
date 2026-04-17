<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getAllStories, getFolders, type Folder, type Story } from '$lib/db';
  import { uiLanguage } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';
  import StoryCard from '$lib/components/StoryCard.svelte';

  let loading = true;
  let mounted = false;
  let folder: Folder | null = null;
  let stories: Story[] = [];

  const COPY = {
    fr: {
      titlePrefix: 'Dossier',
      subtitle: 'Histoires dans ce dossier',
      loading: 'Chargement du dossier...',
      notFound: 'Dossier introuvable',
      notFoundDesc: 'Ce dossier n’existe pas ou a été supprimé.',
      empty: 'Aucune histoire dans ce dossier pour le moment.',
      back: '← Retour aux dossiers',
      countSingle: 'histoire',
      countPlural: 'histoires'
    },
    en: {
      titlePrefix: 'Folder',
      subtitle: 'Stories in this folder',
      loading: 'Loading folder...',
      notFound: 'Folder not found',
      notFoundDesc: 'This folder does not exist or was removed.',
      empty: 'No stories in this folder yet.',
      back: '← Back to folders',
      countSingle: 'story',
      countPlural: 'stories'
    }
  } as const;

  async function loadFolderData(folderId: string) {
    loading = true;

    const allFolders = await getFolders();
    folder = allFolders.find(item => item.id === folderId) || null;

    if (!folder) {
      stories = [];
      loading = false;
      return;
    }

    stories = await getAllStories({ folderId });
    loading = false;
  }

  onMount(() => {
    mounted = true;
  });

  $: currentLang = resolveUiLanguage($uiLanguage);
  $: copy = COPY[currentLang === 'fr' ? 'fr' : 'en'];

  $: if (mounted && $page.params.id) {
    void loadFolderData($page.params.id);
  }
</script>

<svelte:head>
  <title>{folder ? `${folder.name} — Star Wars Story Manager` : `${copy.titlePrefix} — Star Wars Story Manager`}</title>
</svelte:head>

<section class="folder-detail-page">
  <a class="back-link" href="/folders">{copy.back}</a>

  {#if loading}
    <div class="state-box">
      <div class="loading-spinner"></div>
      <p>{copy.loading}</p>
    </div>
  {:else if !folder}
    <div class="state-box">
      <h2>{copy.notFound}</h2>
      <p>{copy.notFoundDesc}</p>
    </div>
  {:else}
    <header class="folder-header" style={`--folder-color: ${folder.color}`}>
      <h1>{folder.name}</h1>
      <p>{copy.subtitle}</p>
      <span class="story-count">
        {stories.length} {stories.length !== 1 ? copy.countPlural : copy.countSingle}
      </span>
    </header>

    {#if stories.length === 0}
      <div class="state-box">
        <p>{copy.empty}</p>
      </div>
    {:else}
      <div class="stories-grid">
        {#each stories as story (story.id)}
          <StoryCard {story} />
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .folder-detail-page {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .back-link {
    width: fit-content;
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: 0.875rem;
    transition: color var(--transition-fast);
  }

  .back-link:hover {
    color: var(--color-gold);
  }

  .folder-header {
    position: relative;
    border: 1px solid var(--color-border);
    border-left: 4px solid var(--folder-color, var(--color-gold));
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .folder-header h1 {
    font-size: 1.45rem;
  }

  .folder-header p {
    color: var(--color-text-muted);
  }

  .story-count {
    margin-top: var(--space-xs);
    font-size: 0.825rem;
    color: var(--color-text-secondary);
  }

  .stories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-lg);
  }

  .state-box {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    padding: var(--space-2xl);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }

  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .stories-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
