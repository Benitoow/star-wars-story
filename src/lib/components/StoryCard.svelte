<script lang="ts">
  import type { Story } from '$db';
  import { deleteStory, archiveStory } from '$lib/stores/stories';
  import { toasts } from '$lib/stores/ui';
  import { goto } from '$app/navigation';

  export let story: Story;

  let showMenu = false;
  let isDeleting = false;

  const ERA_NAMES: Record<string, string> = {
    old_republic: 'Ancienne République',
    clone_wars: 'Guerres des Clones',
    imperial: 'Ère Impériale',
    new_republic: 'Nouvelle République',
    first_order: 'Premier Ordre',
    high_republic: 'Haute République'
  };

  const FACTION_NAMES: Record<string, string> = {
    jedi: 'Ordre Jedi',
    sith: 'Ordre Sith',
    empire: 'Empire',
    rebels: 'Alliance Rebelle',
    republic: 'République',
    mandalore: 'Mandalorians',
    first_order: 'Premier Ordre',
    hutt: 'Cartel Hutt',
    neutral: 'Indépendant'
  };

  function formatDate(date: Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function getPreview(content: string, maxLength = 120): string {
    if (!content) return 'Aucune contenu...';
    const stripped = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
  }

  async function handleDelete() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette histoire?')) return;
    
    isDeleting = true;
    try {
      await deleteStory(story.id);
      toasts.add({ type: 'success', message: 'Histoire supprimée' });
    } catch (e) {
      toasts.add({ type: 'error', message: 'Erreur lors de la suppression' });
    } finally {
      isDeleting = false;
      showMenu = false;
    }
  }

  async function handleArchive() {
    try {
      await archiveStory(story.id);
      toasts.add({ type: 'success', message: 'Histoire archivée' });
    } catch (e) {
      toasts.add({ type: 'error', message: 'Erreur lors de l\'archivage' });
    }
    showMenu = false;
  }

  function handlePlay() {
    goto(`/story/${story.id}/play`);
  }

  function handleEdit() {
    goto(`/story/${story.id}/edit`);
  }
</script>

<article class="story-card">
  <div class="card-header">
    <div class="badges">
      <span class="badge">{ERA_NAMES[story.setup.era] || story.setup.era}</span>
      <span class="badge badge-gold">{FACTION_NAMES[story.setup.faction] || story.setup.faction}</span>
    </div>
    <div class="menu-wrapper">
      <button class="menu-btn" on:click|stopPropagation={() => showMenu = !showMenu}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="6" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="12" cy="18" r="2"/>
        </svg>
      </button>
      {#if showMenu}
        <div class="dropdown-menu">
          <button class="menu-item" on:click={handleEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Modifier
          </button>
          <button class="menu-item" on:click={handlePlay}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Jouer
          </button>
          <button class="menu-item" on:click={handleArchive}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="21,8 21,21 3,21 3,8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            Archiver
          </button>
          <hr />
          <button class="menu-item danger" on:click={handleDelete} disabled={isDeleting}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <button class="card-body" on:click={handleEdit}>
    <h3 class="story-title">{story.title}</h3>
    <p class="story-preview">{getPreview(story.content)}</p>
  </button>

  <div class="card-footer">
    <div class="meta">
      <span class="meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {formatDate(story.metadata.createdAt)}
      </span>
      <span class="meta-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
        </svg>
        {story.metadata.wordCount} mots
      </span>
    </div>
    <button class="play-btn" on:click={handlePlay}>
      <svg viewBox="0 0 24 24" fill="currentColor">
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

<!-- Click outside to close menu -->
{#if showMenu}
  <div class="click-outside" on:click={() => showMenu = false}></div>
{/if}

<style>
  .story-card {
    position: relative;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all var(--transition-normal);
  }

  .story-card:hover {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .badges {
    display: flex;
    gap: var(--space-xs);
  }

  .menu-wrapper {
    position: relative;
  }

  .menu-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .menu-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .menu-btn svg {
    width: 20px;
    height: 20px;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 160px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 50;
    padding: var(--space-xs);
    animation: fadeIn 0.15s ease;
  }

  .dropdown-menu hr {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: var(--space-xs) 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .menu-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .menu-item.danger {
    color: var(--color-red);
  }

  .menu-item.danger:hover {
    background: rgba(255, 23, 68, 0.1);
  }

  .menu-item svg {
    width: 16px;
    height: 16px;
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .card-body {
    display: block;
    width: 100%;
    padding: var(--space-lg);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
  }

  .story-title {
    font-size: 1.125rem;
    color: var(--color-text-primary);
    margin-bottom: var(--space-sm);
    transition: color var(--transition-fast);
  }

  .card-body:hover .story-title {
    color: var(--color-gold);
  }

  .story-preview {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--color-border);
  }

  .meta {
    display: flex;
    gap: var(--space-md);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .meta-item svg {
    width: 14px;
    height: 14px;
  }

  .play-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    background: linear-gradient(135deg, var(--color-gold-dim), var(--color-gold));
    border: none;
    border-radius: 50%;
    color: var(--color-bg-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-btn:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-glow);
  }

  .play-btn svg {
    width: 14px;
    height: 14px;
    margin-left: 2px;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    padding: 0 var(--space-lg) var(--space-md);
  }

  .tag {
    font-size: 0.625rem;
    padding: 2px 8px;
  }

  .tag-more {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
  }

  .click-outside {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
