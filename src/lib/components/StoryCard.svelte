<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Story } from '$db';
  import { stories } from '$lib/stores/stories';
  import { uiLanguage } from '$lib/stores/ui';
  import { resolveUiLanguage } from '$lib/config/languages';
  import { goto } from '$app/navigation';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  export let story: Story;

  const dispatch = createEventDispatcher<{ updated: void }>();

  let showMenu      = false;
  let menuEl: HTMLDivElement | null = null;
  let busy          = false;
  let confirmMsg    = '';
  let confirmDanger = false;
  let pendingAction: (() => Promise<void>) | null = null;

  const COPY = {
    fr: {
      edit:           'Modifier',
      play:           'Jouer',
      archive:        'Archiver',
      delete:         'Supprimer',
      confirmDelete:  'Supprimer cette histoire ? Elle ira dans la corbeille.',
      confirmArchive: 'Archiver cette histoire ? Elle n\'apparaîtra plus dans la liste.',
      deleted:        'Histoire déplacée dans la corbeille',
      archived:       'Histoire archivée',
      errDelete:      'Impossible de supprimer',
      errArchive:     'Impossible d\'archiver',
      noContent:      'Aucun contenu…',
      words:          'mots',
    },
    en: {
      edit:           'Edit',
      play:           'Play',
      archive:        'Archive',
      delete:         'Delete',
      confirmDelete:  'Delete this story? It will be moved to trash.',
      confirmArchive: 'Archive this story? It will no longer appear in the list.',
      deleted:        'Story moved to trash',
      archived:       'Story archived',
      errDelete:      'Could not delete story',
      errArchive:     'Could not archive story',
      noContent:      'No content…',
      words:          'words',
    },
  } as const;

  // ── i18n ──────────────────────────────────────
  let lang: keyof typeof COPY = 'fr';
  let t: (typeof COPY)[keyof typeof COPY] = COPY[lang];

  $: lang = resolveUiLanguage($uiLanguage) === 'fr' ? 'fr' : 'en';
  $: t = COPY[lang];

  const ERA_NAMES: Record<string, Record<string, string>> = {
    fr: {
      old_republic:  'Anc. République',
      clone_wars:    'Guerres des Clones',
      imperial:      'Ère Impériale',
      new_republic:  'Nouv. République',
      first_order:   'Premier Ordre',
    },
    en: {
      old_republic:  'Old Republic',
      clone_wars:    'Clone Wars',
      imperial:      'Imperial Era',
      new_republic:  'New Republic',
      first_order:   'First Order',
    },
  };

  const FACTION_NAMES: Record<string, Record<string, string>> = {
    fr: {
      jedi:        'Ordre Jedi',
      sith:        'Ordre Sith',
      empire:      'Empire',
      rebels:      'Alliance Rebelle',
      republic:    'République',
      mandalore:   'Mandalorians',
      first_order: 'Premier Ordre',
      hutt:        'Cartel Hutt',
      neutral:     'Indépendant',
    },
    en: {
      jedi:        'Jedi Order',
      sith:        'Sith Order',
      empire:      'Empire',
      rebels:      'Rebel Alliance',
      republic:    'Republic',
      mandalore:   'Mandalorians',
      first_order: 'First Order',
      hutt:        'Hutt Cartel',
      neutral:     'Independent',
    },
  };

  // ── Helpers ────────────────────────────────────
  function era(id: string)     { return ERA_NAMES[lang]?.[id]     ?? id; }
  function faction(id: string) { return FACTION_NAMES[lang]?.[id] ?? id; }

  function preview(content: string, max = 120): string {
    if (!content) return t.noContent;
    const plain = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return plain.length <= max ? plain : plain.slice(0, max) + '…';
  }

  function fmtDate(d: Date): string {
    return new Date(d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // ── Menu ───────────────────────────────────────
  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    showMenu = !showMenu;
  }

  function onWindowClick(e: MouseEvent) {
    if (!showMenu) return;
    if (menuEl && menuEl.contains(e.target as Node)) return;
    showMenu = false;
  }

  // ── Actions ────────────────────────────────────
  function requestConfirm(msg: string, danger: boolean, action: () => Promise<void>) {
    confirmMsg    = msg;
    confirmDanger = danger;
    pendingAction = action;
    showMenu      = false;
  }

  async function runConfirmed() {
    if (!pendingAction || busy) return;
    busy = true;
    try {
      await pendingAction();
      dispatch('updated');
    } finally {
      busy          = false;
      pendingAction = null;
    }
  }

  function cancelConfirm() {
    pendingAction = null;
  }

  function askDelete() {
    requestConfirm(t.confirmDelete, true, async () => {
      await stories.delete(story.id);   // soft-delete → corbeille, met à jour le store
    });
  }

  function askArchive() {
    requestConfirm(t.confirmArchive, false, async () => {
      await stories.archive(story.id);  // archive + retire du store
    });
  }

  function goEdit() {
    showMenu = false;
    goto(`/editor/${story.id}`);
  }

  function goPlay() {
    showMenu = false;
    goto(`/editor/${story.id}`);
  }
</script>

<svelte:window on:click={onWindowClick} />

{#if pendingAction}
  <ConfirmDialog
    message={confirmMsg}
    danger={confirmDanger}
    confirmLabel={confirmDanger ? t.delete : t.archive}
    on:confirm={runConfirmed}
    on:cancel={cancelConfirm}
  />
{/if}

<article class="story-card" class:busy>
  <!-- Header -->
  <div class="card-header">
    <div class="badges">
      <span class="badge">{era(story.setup.era)}</span>
      <span class="badge badge-gold">{faction(story.setup.faction)}</span>
    </div>

    <div class="menu-wrapper" bind:this={menuEl}>
      <button class="icon-btn" on:click={toggleMenu} aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <circle cx="12" cy="5"  r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="19" r="2"/>
        </svg>
      </button>

      {#if showMenu}
        <div class="dropdown" role="menu">
          <button class="drop-item" on:click={goEdit} role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t.edit}
          </button>
          <button class="drop-item" on:click={goPlay} role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            {t.play}
          </button>
          <button class="drop-item" on:click={askArchive} role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="21,8 21,21 3,21 3,8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            {t.archive}
          </button>
          <hr class="drop-sep" />
          <button class="drop-item danger" on:click={askDelete} role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            {t.delete}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Body -->
  <button class="card-body" on:click={goEdit}>
    <h3 class="story-title">{story.title}</h3>
    <p class="story-preview">{preview(story.content)}</p>
  </button>

  <!-- Footer -->
  <div class="card-footer">
    <div class="meta">
      <span class="meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
        {fmtDate(story.metadata.updatedAt)}
      </span>
      <span class="meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
        </svg>
        {story.metadata.wordCount} {t.words}
      </span>
    </div>
    <button class="play-btn" on:click={goPlay} title={t.play}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    </button>
  </div>

  {#if story.tags.length > 0}
    <div class="tags">
      {#each story.tags.slice(0, 3) as tag}
        <span class="tag">{tag}</span>
      {/each}
      {#if story.tags.length > 3}
        <span class="tag tag-more">+{story.tags.length - 3}</span>
      {/if}
    </div>
  {/if}
</article>

<style>
  /* ── Card ─────────────────────────────────── */
  .story-card {
    position: relative;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
  }

  .story-card:hover {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .story-card.busy {
    opacity: 0.6;
    pointer-events: none;
  }

  /* ── Header ───────────────────────────────── */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    gap: var(--space-sm);
  }

  .badges {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
    min-width: 0;
  }

  /* ── Menu ─────────────────────────────────── */
  .menu-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .icon-btn {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .icon-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 170px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    padding: 4px;
    animation: pop-in 0.12s ease;
  }

  @keyframes pop-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)     scale(1); }
  }

  .drop-sep {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 4px 0;
  }

  .drop-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: 7px var(--space-sm);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .drop-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .drop-item.danger         { color: var(--color-red); }
  .drop-item.danger:hover   { background: rgba(255, 23, 68, 0.1); }

  /* ── Body ─────────────────────────────────── */
  .card-body {
    display: block;
    width: 100%;
    padding: var(--space-md) var(--space-lg);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
  }

  .story-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-xs);
    transition: color var(--transition-fast);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-body:hover .story-title {
    color: var(--color-gold);
  }

  .story-preview {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Footer ───────────────────────────────── */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--color-border);
  }

  .meta {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  .play-btn {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-gold-dim, #b8960a), var(--color-gold));
    color: #0a0a0a;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  .play-btn svg { margin-left: 2px; }

  .play-btn:hover {
    transform: scale(1.12);
    box-shadow: 0 0 12px rgba(255, 232, 31, 0.5);
  }

  /* ── Tags ─────────────────────────────────── */
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    padding: 0 var(--space-md) var(--space-sm);
  }

  .tag-more {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
  }
</style>
