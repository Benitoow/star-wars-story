<script lang="ts">
  import { ERAS, ROLES, eraBackdrop } from '$lib/content/catalog';
  import type { StoredStory } from '$lib/persistence';

  export let story: StoredStory;
  export let onDelete: (story: StoredStory) => void = () => {};

  $: backdrop = eraBackdrop(story.setup.era);
  $: eraName = ERAS.find((e) => e.id === story.setup.era)?.name ?? '';
  $: roleName = ROLES.find((r) => r.id === story.setup.role)?.name ?? '';
</script>

<div class="card-wrap">
  <a class="card" href="/play/{story.id}">
    <div class="thumb" style="background-image: url('/backdrops/{backdrop}.webp')"></div>
    <div class="scrim"></div>
    <div class="meta">
      {#if eraName}<span class="badge badge-gold">{eraName}</span>{/if}
      <h3 class="title">{story.title}</h3>
      <p class="sub">{roleName}{story.turnCount ? ` · ${story.turnCount} tour${story.turnCount > 1 ? 's' : ''}` : ''}</p>
    </div>
  </a>
  <button type="button" class="del" on:click={() => onDelete(story)} aria-label="Supprimer l'histoire">×</button>
</div>

<style>
  .card-wrap { position: relative; }
  .card {
    display: block;
    position: relative;
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    transition: transform var(--transition-normal), border-color var(--transition-fast);
  }
  .card:hover { transform: translateY(-4px); border-color: var(--color-gold-dim); }
  .card:focus-visible { outline: 1px solid var(--color-gold); outline-offset: 2px; }

  .thumb { position: absolute; inset: 0; background-size: cover; background-position: center; transition: transform var(--transition-slow); }
  .card:hover .thumb { transform: scale(1.06); }
  .scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(4,5,9,0.1) 0%, rgba(4,5,9,0.35) 50%, rgba(4,5,9,0.92) 100%); }

  .del {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    width: 28px; height: 28px; line-height: 1; font-size: 1.1rem;
    color: var(--color-text-secondary); background: rgba(7,8,12,0.6); backdrop-filter: blur(6px);
    border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; opacity: 0; transition: opacity var(--transition-fast);
  }
  .card-wrap:hover .del, .del:focus-visible { opacity: 1; }
  .del:hover { color: var(--color-red); border-color: rgba(215,107,107,0.5); }

  .meta { position: absolute; inset: auto 0 0 0; padding: var(--space-md); display: flex; flex-direction: column; gap: 4px; }
  .title { font-family: var(--font-display); font-size: 1.05rem; color: var(--color-text-primary); line-height: 1.2; text-wrap: balance; }
  .sub { font-size: 0.76rem; color: var(--color-text-secondary); }
  .badge-gold { align-self: flex-start; }
</style>
