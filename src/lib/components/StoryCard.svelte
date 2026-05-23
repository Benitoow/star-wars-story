<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Story } from '$db';
  import { stories } from '$lib/stores/stories';
  import { uiLanguage, toasts } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';

  export let story: Story;

  const dispatch = createEventDispatcher<{ updated: void }>();

  let showMenu = false;
  let menuEl: HTMLDivElement | null = null;
  let busy = false;

  const COPY = {
    fr: { delete: 'Supprimer', deleted: 'Aventure supprimée', undo: 'Annuler', menu: 'Options', updated: 'Modifié le' },
    en: { delete: 'Delete', deleted: 'Adventure deleted', undo: 'Undo', menu: 'Options', updated: 'Updated' }
  } as const;

  const ERA_NAMES: Record<string, Record<string, string>> = {
    fr: { old_republic: 'Anc. République', clone_wars: 'Guerres des Clones', imperial: 'Ère Impériale', new_republic: 'Nouv. République', first_order: 'Premier Ordre' },
    en: { old_republic: 'Old Republic', clone_wars: 'Clone Wars', imperial: 'Imperial Era', new_republic: 'New Republic', first_order: 'First Order' }
  };
  const FACTION_NAMES: Record<string, Record<string, string>> = {
    fr: { jedi: 'Ordre Jedi', sith: 'Ordre Sith', empire: 'Empire', rebels: 'Alliance Rebelle', republic: 'République', mandalore: 'Mandaloriens', first_order: 'Premier Ordre', hutt: 'Cartel Hutt', neutral: 'Indépendant' },
    en: { jedi: 'Jedi Order', sith: 'Sith Order', empire: 'Empire', rebels: 'Rebel Alliance', republic: 'Republic', mandalore: 'Mandalorians', first_order: 'First Order', hutt: 'Hutt Cartel', neutral: 'Independent' }
  };

  // Era → cinematic backdrop for the poster tile
  const ERA_BACKDROP: Record<string, string> = {
    old_republic: '/backdrops/desert.webp',
    clone_wars: '/backdrops/city-dusk.webp',
    imperial: '/backdrops/lava.webp',
    new_republic: '/backdrops/city-night.webp',
    first_order: '/backdrops/hyperspace.webp'
  };

  let lang: 'fr' | 'en' = 'fr';
  $: lang = resolveUiLanguage($uiLanguage) === 'fr' ? 'fr' : 'en';
  $: t = COPY[lang];
  $: eraLabel = ERA_NAMES[lang]?.[story.setup.era] ?? story.setup.era;
  $: factionLabel = FACTION_NAMES[lang]?.[story.setup.faction] ?? story.setup.faction;
  $: backdrop = ERA_BACKDROP[story.setup.era] ?? '/backdrops/city-night.webp';

  function fmtDate(d: Date): string {
    return new Date(d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function toggleMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    showMenu = !showMenu;
  }

  function onWindowClick(e: MouseEvent) {
    if (!showMenu) return;
    if (menuEl && menuEl.contains(e.target as Node)) return;
    showMenu = false;
  }

  async function del(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    showMenu = false;
    if (busy) return;
    busy = true;
    try {
      await stories.delete(story.id); // soft-delete; recoverable via undo
      dispatch('updated');
      toasts.add({
        type: 'info',
        message: t.deleted,
        duration: 6000,
        action: { label: t.undo, onClick: () => { void stories.restore(story.id); } }
      });
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window on:click={onWindowClick} />

<article class="tile" class:busy style={`--tile-bg: url('${backdrop}')`}>
  <a class="tile-link" href={`/editor/${story.id}`} aria-label={story.title}></a>
  <div class="tile-overlay"></div>

  <div class="tile-top">
    <div class="badges">
      <span class="badge era">{eraLabel}</span>
      <span class="badge faction">{factionLabel}</span>
    </div>

    <div class="menu-wrap" bind:this={menuEl}>
      <button class="menu-btn" on:click={toggleMenu} aria-label={t.menu} aria-haspopup="true" aria-expanded={showMenu}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {#if showMenu}
        <div class="dropdown" role="menu">
          <button class="drop-item danger" on:click={del} role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" aria-hidden="true">
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            {t.delete}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="tile-bottom">
    <h3 class="tile-title">{story.title}</h3>
    <div class="tile-meta">
      <span>{t.updated} {fmtDate(story.metadata.updatedAt)}</span>
      <span class="play-cue" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><polygon points="6,4 20,12 6,20" /></svg>
      </span>
    </div>
  </div>
</article>

<style>
  .tile {
    position: relative;
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-xl);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    background-color: var(--color-bg-secondary);
    background-image: var(--tile-bg);
    background-size: cover;
    background-position: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .tile:hover {
    transform: translateY(-4px);
    border-color: var(--color-gold);
    box-shadow: var(--shadow-lg), 0 0 24px rgba(255, 232, 31, 0.12);
  }

  .tile.busy { opacity: 0.5; pointer-events: none; }

  .tile-link {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .tile-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(4, 5, 9, 0.55) 0%, rgba(4, 5, 9, 0.15) 35%, rgba(4, 5, 9, 0.78) 100%);
    pointer-events: none;
  }

  .tile-top,
  .tile-bottom {
    position: relative;
    z-index: 2;
    padding: var(--space-md);
  }

  .tile-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    pointer-events: none;
  }

  .badge {
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .badge.era {
    background: rgba(8, 9, 14, 0.6);
    color: var(--color-text-secondary);
    border: 1px solid var(--border-subtle);
  }

  .badge.faction {
    background: rgba(255, 232, 31, 0.16);
    color: var(--color-gold);
    border: 1px solid rgba(255, 232, 31, 0.3);
  }

  .menu-wrap { position: relative; flex-shrink: 0; }

  .menu-btn {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-sm);
    background: rgba(8, 9, 14, 0.55);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color var(--transition-fast), background var(--transition-fast);
  }

  .menu-btn:hover { color: var(--color-gold); background: rgba(8, 9, 14, 0.8); }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 150px;
    background: var(--surface-glass-strong);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 4px;
    animation: pop-in 0.12s ease;
  }

  @keyframes pop-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .drop-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: 8px var(--space-sm);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .drop-item.danger { color: #f87171; }
  .drop-item.danger:hover { background: rgba(248, 113, 113, 0.12); }

  .tile-bottom {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tile-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1.25;
    color: #fff;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tile-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.8);
  }

  .play-cue {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-gold);
    color: #0a0a0a;
    opacity: 0;
    transform: scale(0.8);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }

  .tile:hover .play-cue { opacity: 1; transform: scale(1); }
</style>
