<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listStories, softDeleteStory, restoreStory, type StoredStory } from '$lib/persistence';
  import { toasts } from '$lib/stores/ui';
  import SceneBackdrop from '$lib/ui/SceneBackdrop.svelte';
  import StoryCard from '$lib/ui/StoryCard.svelte';

  let stories: StoredStory[] = [];
  let loading = true;

  onMount(async () => {
    stories = await listStories();
    loading = false;
  });

  async function handleDelete(story: StoredStory) {
    await softDeleteStory(story.id);
    stories = stories.filter((s) => s.id !== story.id);
    toasts.show(`« ${story.title} » supprimée.`, 'info', 6000, {
      label: 'Annuler',
      run: async () => {
        await restoreStory(story.id);
        stories = await listStories();
      }
    });
  }

  $: hasStories = stories.length > 0;
</script>

<svelte:head><title>Star Wars — Écris ta légende</title></svelte:head>

<section class="hero" class:full={!hasStories}>
  <SceneBackdrop backdrop="city-night" variant="hero" />
  <div class="hero-content animate-fade-in">
    <p class="eyebrow">Une galaxie lointaine, très lointaine</p>
    <h1 class="hero-title">Écris ta légende</h1>
    <p class="hero-sub text-pretty">Une aventure interactive où chaque choix façonne un monde vivant.</p>
    <button class="btn btn-primary hero-cta" on:click={() => goto('/new')}>Nouvelle histoire</button>
  </div>
</section>

{#if hasStories}
  <section class="library">
    <h2 class="lib-title">Tes histoires</h2>
    <div class="grid">
      {#each stories as story (story.id)}
        <StoryCard {story} onDelete={handleDelete} />
      {/each}
    </div>
  </section>
{:else if loading}
  <!-- hero stays full-screen while loading -->
{/if}

<style>
  .hero {
    position: relative;
    min-height: 62vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .hero.full { min-height: 100vh; }

  .hero-content { position: relative; z-index: 2; text-align: center; padding: var(--space-2xl) var(--space-lg); max-width: 760px; }
  .hero-title {
    font-size: clamp(2.6rem, 1.5rem + 5.5vw, 5.5rem);
    font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    line-height: 1.05; margin: var(--space-md) 0;
    text-shadow: 0 2px 40px rgba(0, 0, 0, 0.6);
  }
  .hero-sub { font-size: clamp(1rem, 0.9rem + 0.5vw, 1.2rem); color: var(--color-text-secondary); max-width: 46ch; margin: 0 auto var(--space-xl); }
  .hero-cta { font-size: 0.85rem; padding: 13px 28px; }

  .library { max-width: 1200px; margin: 0 auto; padding: var(--space-2xl) var(--space-lg); }
  .lib-title { font-size: 1.4rem; margin-bottom: var(--space-lg); color: var(--color-text-secondary); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: var(--space-lg); }

  @media (max-width: 600px) { .grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } }
</style>
