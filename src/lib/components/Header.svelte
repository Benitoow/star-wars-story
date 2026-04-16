<script lang="ts">
  import { goto } from '$app/navigation';
  import { toggleSidebar, searchOpen, searchQuery, uiLanguage, viewMode, toasts } from '$lib/stores/ui';
  import { stories } from '$lib/stores/stories';
  import { UI_LANGUAGE_OPTIONS, getLanguageLabel, type UiLanguageCode } from '$lib/config/languages';

  let showNewStoryModal = false;
  let newStoryTitle = '';

  async function handleCreateStory() {
    if (!newStoryTitle.trim()) return;

    try {
      const story = await stories.create({
        title: newStoryTitle,
        content: '',
        setup: {
          era: 'imperial',
          faction: 'neutral',
          role: 'pilot',
          premise: 'chosen'
        }
      });
      toasts.add({ type: 'success', message: 'Histoire créée avec succès' });
      showNewStoryModal = false;
      newStoryTitle = '';
      goto(`/editor/${story.id}`);
    } catch (e) {
      toasts.add({ type: 'error', message: 'Erreur lors de la création' });
    }
  }

  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    uiLanguage.set(target.value as UiLanguageCode);
  }
</script>

<header class="header">
  <div class="header-left">
    <button class="menu-toggle hide-desktop" on:click={toggleSidebar}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <div class="search-bar" class:open={$searchOpen}>
      <button class="search-toggle" on:click={() => searchOpen.update(v => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher une histoire..."
        bind:value={$searchQuery}
        on:blur={() => !$searchQuery && searchOpen.set(false)}
      />
      {#if $searchQuery}
        <button class="search-clear" on:click={() => searchQuery.set('')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="header-right">
    <label class="language-switcher" title="Langue de l'interface">
      <span class="language-switcher-label">{getLanguageLabel($uiLanguage)}</span>
      <select class="language-select" value={$uiLanguage} on:change={handleLanguageChange}>
        {#each UI_LANGUAGE_OPTIONS as language}
          <option value={language.code}>{language.name}</option>
        {/each}
      </select>
    </label>

    <div class="view-toggle hide-mobile">
      <button
        class="view-btn"
        class:active={$viewMode === 'grid'}
        on:click={() => viewMode.set('grid')}
        title="Vue grille"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button
        class="view-btn"
        class:active={$viewMode === 'list'}
        on:click={() => viewMode.set('list')}
        title="Vue liste"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
    </div>

    <button class="btn btn-primary new-story-btn" on:click={() => showNewStoryModal = true}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span class="hide-mobile">Nouvelle Histoire</span>
    </button>
  </div>
</header>

<!-- New Story Modal -->
{#if showNewStoryModal}
  <div class="modal-overlay" on:click={() => showNewStoryModal = false}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Créer une nouvelle histoire</h2>
        <button class="modal-close" on:click={() => showNewStoryModal = false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <form class="modal-body" on:submit|preventDefault={handleCreateStory}>
        <div class="form-group">
          <label class="label" for="story-title">Titre de l'histoire</label>
          <input
            id="story-title"
            type="text"
            class="input"
            placeholder="Mon aventure Star Wars..."
            bind:value={newStoryTitle}
            required
          />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" on:click={() => showNewStoryModal = false}>
            Annuler
          </button>
          <button type="submit" class="btn btn-primary">
            Créer
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex: 1;
  }

  .menu-toggle {
    width: 40px;
    height: 40px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .menu-toggle:hover {
    background: var(--color-bg-hover);
    color: var(--color-gold);
  }

  .menu-toggle svg {
    width: 24px;
    height: 24px;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-xs) var(--space-sm);
    max-width: 300px;
    width: 100%;
    transition: all var(--transition-fast);
  }

  .search-bar:focus-within {
    border-color: var(--color-gold);
    box-shadow: 0 0 0 3px rgba(255, 232, 31, 0.1);
  }

  .search-toggle {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .search-toggle svg {
    width: 20px;
    height: 20px;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .search-clear {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .search-clear svg {
    width: 16px;
    height: 16px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .language-switcher {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 0 var(--space-sm);
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .language-switcher-label {
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .language-select {
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font: inherit;
    outline: none;
    cursor: pointer;
    max-width: 110px;
  }

  .language-select option {
    color: var(--color-text-primary);
  }
  .view-toggle {
    display: flex;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .view-btn {
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

  .view-btn:hover {
    color: var(--color-text-primary);
  }

  .view-btn.active {
    background: var(--color-bg-hover);
    color: var(--color-gold);
  }

  .view-btn svg {
    width: 18px;
    height: 18px;
  }

  .new-story-btn {
    padding: var(--space-sm) var(--space-md);
  }

  .new-story-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: var(--space-lg);
    animation: fadeIn 0.2s ease;
  }

  .modal {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 480px;
    animation: slideUp 0.3s ease;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    font-size: 1.125rem;
    color: var(--color-gold);
  }

  .modal-close {
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

  .modal-close:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .modal-close svg {
    width: 20px;
    height: 20px;
  }

  .modal-body {
    padding: var(--space-lg);
  }

  .form-group {
    margin-bottom: var(--space-lg);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .hide-mobile {
    display: none;
  }

  @media (min-width: 769px) {
    .hide-mobile {
      display: flex;
    }
  }

  @media (max-width: 768px) {
    .header {
      padding: var(--space-sm) var(--space-md);
    }

    .language-switcher {
      height: 36px;
    }

    .language-switcher-label {
      display: none;
    }

    .language-select {
      max-width: 92px;
    }

    .search-bar {
      max-width: 200px;
    }
  }
</style>
