<script lang="ts">
  import { onMount } from 'svelte';
  import { folders } from '$lib/stores/stories';
  import { uiLanguage } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';

  let loading = true;

  const COPY = {
    fr: {
      title: 'Dossiers — Star Wars Story Manager',
      heading: 'Dossiers',
      subtitle: 'Organisez vos histoires par univers, campagne ou arc narratif.',
      loading: 'Chargement des dossiers...',
      emptyTitle: 'Aucun dossier',
      emptyText: 'Créez d’abord des histoires puis assignez-les à des dossiers pour les retrouver plus vite.',
      createStory: 'Créer une histoire',
      storySingle: 'histoire',
      storyPlural: 'histoires',
      open: 'Ouvrir'
    },
    en: {
      title: 'Folders — Star Wars Story Manager',
      heading: 'Folders',
      subtitle: 'Organize your stories by universe, campaign, or narrative arc.',
      loading: 'Loading folders...',
      emptyTitle: 'No folders yet',
      emptyText: 'Create stories first, then assign them to folders to find them faster.',
      createStory: 'Create a story',
      storySingle: 'story',
      storyPlural: 'stories',
      open: 'Open'
    }
  } as const;

  onMount(async () => {
    await folders.load();
    loading = false;
  });

  $: currentLang = resolveUiLanguage($uiLanguage);
  $: copy = COPY[currentLang === 'fr' ? 'fr' : 'en'];
</script>

<svelte:head>
  <title>{copy.title}</title>
</svelte:head>

<section class="folders-page">
  <header class="page-header">
    <h1>{copy.heading}</h1>
    <p>{copy.subtitle}</p>
  </header>

  {#if loading}
    <div class="state-box">
      <div class="loading-spinner"></div>
      <p>{copy.loading}</p>
    </div>
  {:else if $folders.length === 0}
    <div class="state-box">
      <h2>{copy.emptyTitle}</h2>
      <p>{copy.emptyText}</p>
      <a class="btn btn-primary" href="/stories/new">{copy.createStory}</a>
    </div>
  {:else}
    <div class="folders-grid">
      {#each $folders as folder}
        <a class="folder-card" href={`/folders/${folder.id}`} style={`--folder-color: ${folder.color}`}>
          <div class="folder-card-header">
            <span class="folder-dot"></span>
            <h3>{folder.name}</h3>
          </div>
          <div class="folder-card-footer">
            <span>
              {folder.storyCount || 0} {(folder.storyCount || 0) === 1 ? copy.storySingle : copy.storyPlural}
            </span>
            <span class="folder-open">{copy.open} →</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>

<style>
  .folders-page {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .page-header h1 {
    font-size: 1.5rem;
    margin-bottom: var(--space-xs);
  }

  .page-header p {
    color: var(--color-text-muted);
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

  .folders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-md);
  }

  .folder-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    text-decoration: none;
    color: inherit;
    border: 1px solid var(--color-border);
    border-left: 4px solid var(--folder-color, var(--color-gold));
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    padding: var(--space-lg);
    transition: all var(--transition-fast);
  }

  .folder-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--folder-color, var(--color-gold)) 45%, var(--color-border));
  }

  .folder-card-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .folder-card-header h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .folder-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--folder-color, var(--color-gold));
    flex-shrink: 0;
  }

  .folder-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .folder-open {
    color: var(--color-gold);
    font-weight: 600;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
