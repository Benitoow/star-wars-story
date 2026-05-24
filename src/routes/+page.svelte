<script lang="ts">
  import { onMount } from 'svelte';
  import { stories, filteredStories } from '$lib/stores/stories';
  import { uiLanguage, resetFilters, searchQuery, filters } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';
  import { ERAS } from '$lib/editor/setupCatalog';
  import StoryCard from '$lib/components/StoryCard.svelte';

  let loading = true;

  const COPY = {
    fr: {
      eyebrow: 'Fiction interactive',
      title: 'Écris ta légende',
      sub: 'Des aventures Star Wars menées par l’IA, où chaque choix t’appartient.',
      enter: 'Commencer',
      scroll: 'Vos aventures',
      library: 'Vos aventures',
      search: 'Rechercher…',
      allEras: 'Toutes les époques',
      empty: 'Aucune aventure',
      emptyText: 'Votre saga reste à écrire.',
      create: 'Créer une aventure'
    },
    en: {
      eyebrow: 'Interactive fiction',
      title: 'Write your legend',
      sub: 'AI-driven Star Wars adventures where every choice is yours.',
      enter: 'Begin',
      scroll: 'Your adventures',
      library: 'Your adventures',
      search: 'Search…',
      allEras: 'All eras',
      empty: 'No adventures yet',
      emptyText: 'Your saga is still unwritten.',
      create: 'Create an adventure'
    }
  } as const;

  onMount(async () => {
    resetFilters();
    await stories.load();
    loading = false;
  });

  $: copy = resolveUiLanguage($uiLanguage) === 'fr' ? COPY.fr : COPY.en;

  let searchInput = '';
  $: searchQuery.set(searchInput);
  function setEraFilter(eraId: string | null) {
    filters.update((f) => ({ ...f, era: eraId || undefined }));
  }
  $: activeEra = $filters.era;
</script>

<svelte:head>
  <title>Star Wars Story</title>
</svelte:head>

<div class="home">
  <!-- Entrance — full-screen immersive -->
  <section class="hero">
    <div class="hero-bg"></div>
    <div class="hero-scrim"></div>
    <div class="hero-inner">
      <p class="eyebrow hero-eyebrow">{copy.eyebrow}</p>
      <h1 class="hero-title">{copy.title}</h1>
      <p class="hero-sub">{copy.sub}</p>
      <a class="btn btn-primary hero-cta" href="/stories/new">{copy.enter}</a>
    </div>
    <a class="hero-scroll" href="#library" aria-label={copy.scroll}>
      <span>{copy.scroll}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </a>
  </section>

  <!-- Library -->
  <section class="library" id="library">
    <header class="lib-head">
      <h2 class="lib-title">{copy.library}</h2>
      <div class="lib-tools">
        <input class="lib-search input" type="text" bind:value={searchInput} placeholder={copy.search} aria-label={copy.search} />
      </div>
    </header>

    <div class="era-row" role="group" aria-label={copy.allEras}>
      <button class="era-chip" class:active={!activeEra} on:click={() => setEraFilter(null)}>{copy.allEras}</button>
      {#each ERAS as era}
        <button class="era-chip" class:active={activeEra === era.id} on:click={() => setEraFilter(era.id)}>{era.name}</button>
      {/each}
    </div>

    {#if loading}
      <div class="lib-state"><div class="lib-spinner"></div></div>
    {:else if $filteredStories.length === 0}
      <div class="lib-empty">
        <h3>{copy.empty}</h3>
        <p>{copy.emptyText}</p>
        <a href="/stories/new" class="btn btn-primary">{copy.create}</a>
      </div>
    {:else}
      <div class="tiles">
        {#each $filteredStories as story (story.id)}
          <StoryCard {story} />
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .home { display: flex; flex-direction: column; }

  /* ── Entrance ─────────────────────────────── */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--header-height) var(--space-lg) var(--space-2xl);
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    background: url('/backdrops/city-night.webp') center / cover no-repeat;
    transform: scale(1.06);
    animation: heroDrift 32s ease-in-out infinite alternate;
  }

  @keyframes heroDrift {
    from { transform: scale(1.06) translateY(0); }
    to { transform: scale(1.12) translateY(-1.5%); }
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim-image), var(--scrim-center);
  }

  .hero-inner {
    position: relative;
    z-index: 1;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    animation: fadeIn 1.2s ease both;
  }

  .hero-eyebrow { color: var(--color-text-secondary); }

  .hero-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(2.6rem, 1.8rem + 4vw, 5rem);
    line-height: 1.04;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
    text-shadow: 0 4px 40px rgba(0, 0, 0, 0.7);
    margin: 0;
  }

  .hero-sub {
    font-family: var(--font-body);
    font-size: clamp(1rem, 0.95rem + 0.4vw, 1.2rem);
    line-height: 1.7;
    color: var(--color-text-secondary);
    max-width: 44ch;
    margin: 0;
  }

  .hero-cta { margin-top: var(--space-md); }

  .hero-scroll {
    position: absolute;
    bottom: var(--space-xl);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    text-decoration: none;
  }
  .hero-scroll svg { animation: bob 2.4s ease-in-out infinite; }
  .hero-scroll:hover { color: var(--color-text-primary); }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(4px); } }

  /* ── Library ──────────────────────────────── */
  .library {
    position: relative;
    z-index: 1;
    background: var(--color-bg-primary);
    padding: var(--space-2xl) clamp(var(--space-lg), 5vw, var(--space-2xl)) var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
  }

  .lib-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-lg);
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: var(--space-md);
  }

  .lib-title {
    font-family: var(--font-display);
    font-size: clamp(1.4rem, 1.1rem + 1.2vw, 2rem);
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-primary);
    margin: 0;
  }

  .lib-search { max-width: 280px; border-radius: 999px; }

  .era-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .era-chip {
    padding: 5px 16px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }
  .era-chip:hover { border-color: var(--color-border-hover); color: var(--color-text-primary); }
  .era-chip.active { border-color: var(--color-text-primary); color: var(--color-text-primary); }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: var(--space-lg);
    margin-top: var(--space-sm);
  }

  .lib-state { display: flex; justify-content: center; padding: var(--space-2xl); }
  .lib-spinner {
    width: 32px; height: 32px;
    border: 1px solid var(--border-subtle);
    border-top-color: var(--color-text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .lib-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    text-align: center;
    padding: var(--space-2xl);
    color: var(--color-text-muted);
  }
  .lib-empty h3 {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin: 0;
  }
  .lib-empty p { margin: 0; }
  .lib-empty .btn { margin-top: var(--space-sm); text-decoration: none; }

  @media (max-width: 600px) {
    .tiles { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-md); }
    .lib-head { flex-direction: column; align-items: stretch; }
    .lib-search { max-width: none; }
  }
</style>
