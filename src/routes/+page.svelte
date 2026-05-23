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
      heroTitle: 'Ta saga commence ici',
      heroSub: 'Des aventures Star Wars interactives écrites par l’IA, où chaque choix t’appartient.',
      cta: 'Nouvelle aventure',
      section: 'Tes aventures',
      loading: 'Chargement…',
      noStories: 'Aucune aventure pour l’instant',
      emptyText: 'Lance ta première histoire et écris ta légende dans la galaxie.',
      searchPlaceholder: 'Rechercher une aventure…',
      allEras: 'Toutes les époques',
      countSingle: 'aventure',
      countPlural: 'aventures'
    },
    en: {
      heroTitle: 'Your saga starts here',
      heroSub: 'AI-driven interactive Star Wars adventures where every choice is yours.',
      cta: 'New adventure',
      section: 'Your adventures',
      loading: 'Loading…',
      noStories: 'No adventures yet',
      emptyText: 'Start your first story and write your legend across the galaxy.',
      searchPlaceholder: 'Search an adventure…',
      allEras: 'All eras',
      countSingle: 'adventure',
      countPlural: 'adventures'
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
  <title>Star Wars Story — {copy.section}</title>
</svelte:head>

<div class="home">
  <!-- Hero -->
  <section class="hero">
    <div class="hero-bg"></div>
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <p class="hero-eyebrow">Star Wars · Interactive Fiction</p>
      <h1 class="hero-title">{copy.heroTitle}</h1>
      <p class="hero-sub">{copy.heroSub}</p>
      <a class="btn btn-primary hero-cta" href="/stories/new">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="17" height="17" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {copy.cta}
      </a>
    </div>
  </section>

  <!-- Library -->
  <section class="library">
    <div class="library-head">
      <h2 class="library-title">
        {copy.section}
        {#if !loading}<span class="count">{$filteredStories.length} {$filteredStories.length !== 1 ? copy.countPlural : copy.countSingle}</span>{/if}
      </h2>
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input class="search-input" type="text" bind:value={searchInput} placeholder={copy.searchPlaceholder} aria-label={copy.searchPlaceholder} />
      </div>
    </div>

    <div class="era-chips" role="group" aria-label={copy.allEras}>
      <button class="era-chip" class:active={!activeEra} on:click={() => setEraFilter(null)}>{copy.allEras}</button>
      {#each ERAS as era}
        <button class="era-chip" class:active={activeEra === era.id} on:click={() => setEraFilter(era.id)}>{era.name}</button>
      {/each}
    </div>

    {#if loading}
      <div class="state">
        <div class="spinner"></div>
        <p>{copy.loading}</p>
      </div>
    {:else if $filteredStories.length === 0}
      <div class="state empty">
        <div class="empty-holo"><div class="holo-ring"></div><span>✦</span></div>
        <h3>{copy.noStories}</h3>
        <p>{copy.emptyText}</p>
        <a href="/stories/new" class="btn btn-primary">{copy.cta}</a>
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
  .home {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
  }

  /* ── Hero ─────────────────────────────────── */
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-subtle);
    min-height: 300px;
    display: flex;
    align-items: center;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    background: url('/backdrops/hyperspace.webp') center / cover no-repeat;
    transform: scale(1.05);
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(4, 5, 9, 0.92) 0%, rgba(4, 5, 9, 0.72) 45%, rgba(4, 5, 9, 0.35) 100%),
      radial-gradient(120% 120% at 0% 50%, transparent 40%, rgba(4, 5, 9, 0.6) 100%);
  }

  .hero-content {
    position: relative;
    z-index: 1;
    padding: clamp(var(--space-lg), 4vw, var(--space-2xl));
    max-width: 600px;
  }

  .hero-eyebrow {
    margin: 0 0 var(--space-sm);
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--color-gold);
  }

  .hero-title {
    margin: 0 0 var(--space-sm);
    font-family: var(--font-display);
    font-size: clamp(2rem, 1.5rem + 2.5vw, 3.2rem);
    font-weight: 700;
    line-height: 1.08;
    color: #fff;
    text-shadow: 0 2px 30px rgba(0, 0, 0, 0.7);
  }

  .hero-sub {
    margin: 0 0 var(--space-lg);
    font-family: var(--font-narrative);
    font-size: clamp(1rem, 0.95rem + 0.4vw, 1.2rem);
    line-height: 1.6;
    color: var(--color-text-secondary);
    max-width: 46ch;
  }

  .hero-cta {
    text-decoration: none;
    padding: 11px 22px;
    font-size: 0.95rem;
  }

  /* ── Library ──────────────────────────────── */
  .library {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .library-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .library-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--color-text-primary);
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .count {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--color-text-muted);
    font-family: var(--font-body);
  }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
    max-width: 340px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    width: 16px;
    height: 16px;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 9px 14px 9px 36px;
    background: var(--surface-glass);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-family: var(--font-body);
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .search-input::placeholder { color: var(--color-text-muted); }

  .era-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .era-chip {
    padding: 5px 14px;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: var(--font-body);
    white-space: nowrap;
  }

  .era-chip:hover { border-color: var(--color-gold); color: var(--color-gold); }

  .era-chip.active {
    background: rgba(255, 232, 31, 0.12);
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  /* ── Tiles grid ───────────────────────────── */
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-lg);
  }

  /* ── States ───────────────────────────────── */
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-2xl) var(--space-lg);
    color: var(--color-text-muted);
    text-align: center;
  }

  .state.empty {
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-xl);
    background: var(--surface-glass);
  }

  .state.empty h3 { color: var(--color-text-primary); font-size: 1.2rem; margin: 0; }
  .state.empty p { margin: 0; max-width: 380px; }
  .state.empty .btn { text-decoration: none; margin-top: var(--space-xs); }

  .empty-holo {
    position: relative;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gold);
    font-size: 1.8rem;
  }

  .holo-ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(255, 232, 31, 0.3);
    border-radius: 50%;
    animation: holo-pulse 2s ease-in-out infinite;
  }

  @keyframes holo-pulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.06); }
  }

  .spinner {
    width: 38px;
    height: 38px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 600px) {
    .tiles { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-md); }
    .library-head { flex-direction: column; align-items: stretch; }
    .search-wrap { max-width: none; }
  }
</style>
