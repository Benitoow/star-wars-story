<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getAllStories, deleteStory, restoreStory, emptyTrash } from '$lib/db';
  import { showToast } from '$lib/stores/ui';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import type { Story } from '$lib/db';

  let trashedStories: Story[] = [];
  let loading = true;
  let selectedIds: Set<string> = new Set();
  let showEmptyTrashModal = false;

  onMount(async () => {
    await loadTrash();
  });

  async function loadTrash() {
    loading = true;
    const all = await getAllStories({ includeDeleted: true, includeArchived: true });
    trashedStories = all.filter(s => s.isDeleted);
    loading = false;
  }

  function toggleSelect(id: string) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = selectedIds; // trigger reactivity
  }

  function selectAll() {
    if (selectedIds.size === trashedStories.length) {
      selectedIds.clear();
    } else {
      trashedStories.forEach(s => selectedIds.add(s.id));
    }
    selectedIds = selectedIds;
  }

  async function handleRestore(id: string) {
    try {
      await restoreStory(id);
      showToast('Histoire restaurée', 'success');
      await loadTrash();
    } catch (e) {
      showToast('Erreur lors de la restauration', 'error');
    }
  }

  async function handleRestoreSelected() {
    for (const id of selectedIds) {
      await restoreStory(id);
    }
    selectedIds.clear();
    showToast('Histoires restaurées', 'success');
    await loadTrash();
  }

  async function handleDelete(id: string) {
    try {
      await deleteStory(id, true);
      showToast('Histoire supprimée définitivement', 'success');
      await loadTrash();
    } catch (e) {
      showToast('Erreur lors de la suppression', 'error');
    }
  }

  async function handleDeleteSelected(permanent = false) {
    for (const id of selectedIds) {
      await deleteStory(id, true);
    }
    selectedIds.clear();
    showToast('Histoires supprimées', 'success');
    await loadTrash();
  }

  async function handleEmptyTrash() {
    try {
      await emptyTrash();
      showEmptyTrashModal = false;
      showToast('Corbeille vidée', 'success');
      await loadTrash();
    } catch (e) {
      showToast('Erreur lors du vidage de la corbeille', 'error');
    }
  }

  function formatDate(date?: Date): string {
    if (!date) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  function getDaysUntilDeletion(date?: Date): number {
    if (!date) return 30;
    const deletedAt = new Date(date);
    const daysSinceDeleted = Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysSinceDeleted);
  }

  $: allSelected = trashedStories.length > 0 && selectedIds.size === trashedStories.length;
  $: someSelected = selectedIds.size > 0 && selectedIds.size < trashedStories.length;
</script>

<svelte:head>
  <title>Corbeille — Star Wars Story Manager</title>
</svelte:head>

<div class="trash-layout">
  <PageHeader
    title="Corbeille"
    showBack={true}
    on:back={() => goto('/')}
  />
  <main class="trash-main">

    <div class="trash-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Chargement de la corbeille...</p>
        </div>
      {:else}
        <div class="trash-header">
          <div class="trash-info">
            <p class="trash-description">
              Les histoires supprimées sont conservées pendant 30 jours avant d'être supprimées définitivement.
            </p>
          </div>
          
          {#if trashedStories.length > 0}
            <div class="trash-actions">
              {#if selectedIds.size > 0}
                <button class="btn btn-secondary" on:click={handleRestoreSelected}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1,4 1,10 7,10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                  </svg>
                  Restaurer ({selectedIds.size})
                </button>
                <button class="btn btn-danger" on:click={() => handleDeleteSelected(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  Supprimer ({selectedIds.size})
                </button>
              {/if}
              <button class="btn btn-danger-outline" on:click={() => showEmptyTrashModal = true}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
                Vider la corbeille
              </button>
            </div>
          {/if}
        </div>

        {#if trashedStories.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <h3>Corbeille vide</h3>
            <p>Aucune histoire supprimée. Les histoires que vous supprimez apparaîtront ici.</p>
            <a href="/" class="btn btn-primary">
              Retour au tableau de bord
            </a>
          </div>
        {:else}
          <div class="trash-list">
            <div class="list-header">
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  indeterminate={someSelected}
                  on:change={selectAll}
                />
                <span class="checkmark"></span>
              </label>
              <span class="col-title">Titre</span>
              <span class="col-date">Supprimée le</span>
              <span class="col-days">Jours restants</span>
              <span class="col-actions">Actions</span>
            </div>

            {#each trashedStories as story (story.id)}
              <div class="trash-item" class:selected={selectedIds.has(story.id)}>
                <label class="checkbox-wrapper">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(story.id)}
                    on:change={() => toggleSelect(story.id)}
                  />
                  <span class="checkmark"></span>
                </label>
                
                <div class="col-title">
                  <span class="story-title">{story.title}</span>
                  <span class="story-meta">
                    {story.setup.era} • {story.setup.faction}
                  </span>
                </div>
                
                <span class="col-date">
                  {formatDate(story.deletedAt)}
                </span>
                
                <span class="col-days" class:urgent={getDaysUntilDeletion(story.deletedAt) <= 7}>
                  {getDaysUntilDeletion(story.deletedAt)} jours
                </span>
                
                <div class="col-actions">
                  <button 
                    class="action-btn restore" 
                    title="Restaurer"
                    on:click={() => handleRestore(story.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="1,4 1,10 7,10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                  </button>
                  <button 
                    class="action-btn delete" 
                    title="Supprimer définitivement"
                    on:click={() => handleDelete(story.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </main>
</div>

<!-- Empty Trash Confirmation Modal -->
{#if showEmptyTrashModal}
  <button class="modal-overlay" on:click={() => showEmptyTrashModal = false} aria-label="Fermer">
    <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>Vider la corbeille</h2>
        <button class="modal-close" on:click={() => showEmptyTrashModal = false}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="modal-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Cette action est irréversible.
        </p>
        <p>
          Toutes les {trashedStories.length} histoire{trashedStories.length !== 1 ? 's' : ''} de la corbeille seront supprimée{trashedStories.length !== 1 ? 's' : ''} définitivement.
        </p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={() => showEmptyTrashModal = false}>
          Annuler
        </button>
        <button class="btn btn-danger" on:click={handleEmptyTrash}>
          Vider la corbeille
        </button>
      </div>
    </div>
  </button>
{/if}

<style>
  .trash-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .trash-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .trash-content {
    flex: 1;
    padding: var(--space-xl);
    overflow-y: auto;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .trash-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-xl);
    margin-bottom: var(--space-xl);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .trash-description {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    max-width: 500px;
  }

  .trash-actions {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    margin-bottom: var(--space-lg);
    color: var(--color-text-muted);
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-state h3 {
    font-size: 1.125rem;
    margin-bottom: var(--space-sm);
  }

  .empty-state p {
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
    max-width: 400px;
  }

  .trash-list {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .list-header {
    display: grid;
    grid-template-columns: 40px 1fr 160px 100px 100px;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .trash-item {
    display: grid;
    grid-template-columns: 40px 1fr 160px 100px 100px;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
    align-items: center;
    transition: background var(--transition-fast);
  }

  .trash-item:last-child {
    border-bottom: none;
  }

  .trash-item:hover {
    background: var(--color-bg-hover);
  }

  .trash-item.selected {
    background: rgba(255, 232, 31, 0.05);
  }

  .col-title {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
  }

  .story-title {
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .story-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .col-date {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .col-days {
    font-size: 0.875rem;
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
  }

  .col-days.urgent {
    color: var(--color-red);
    font-weight: 600;
  }

  .col-actions {
    display: flex;
    gap: var(--space-xs);
  }

  .action-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .action-btn.delete:hover {
    border-color: var(--color-red);
    color: var(--color-red);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Checkbox styles */
  .checkbox-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .checkbox-wrapper input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkmark {
    width: 18px;
    height: 18px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    transition: all var(--transition-fast);
    position: relative;
  }

  .checkbox-wrapper:hover .checkmark {
    border-color: var(--color-gold);
  }

  .checkbox-wrapper input:checked ~ .checkmark {
    background: var(--color-gold);
    border-color: var(--color-gold);
  }

  .checkbox-wrapper input:indeterminate ~ .checkmark {
    background: var(--color-gold);
    border-color: var(--color-gold);
  }

  .checkbox-wrapper input:checked ~ .checkmark::after,
  .checkbox-wrapper input:indeterminate ~ .checkmark::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 2px;
    width: 5px;
    height: 9px;
    border: solid var(--color-bg-primary);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .checkbox-wrapper input:indeterminate ~ .checkmark::after {
    transform: rotate(0deg);
    left: 3px;
    top: 6px;
    width: 8px;
    height: 0;
    border-width: 0 0 2px 0;
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
    color: var(--color-text-primary);
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

  .modal-body p {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-md);
  }

  .modal-warning {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-red) !important;
    font-weight: 500;
  }

  .modal-warning svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-lg);
    border-top: 1px solid var(--color-border);
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

  @media (max-width: 768px) {
    .trash-header {
      flex-direction: column;
    }

    .trash-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .list-header,
    .trash-item {
      grid-template-columns: 40px 1fr 80px;
    }

    .col-date,
    .col-days {
      display: none;
    }
  }
</style>