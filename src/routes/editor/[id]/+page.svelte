<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { story, saveStory, createStory, loadStory, currentSetup, updateSetupField, updateContent } from '$lib/stores/editor';
  import { showToast } from '$lib/stores/ui';
  import SvgIcon from '$lib/components/SvgIcon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let loading = true;
  let saving = false;
  let step: 'setup' | 'edit' = 'setup';
  let storyId: string | null = null;

  const ERAS = [
    { id: 'old_republic', name: 'Ancienne République', years: '25 000 - 1000 AVBY', icon: 'AncientRepublic.svg' },
    { id: 'clone_wars', name: 'Guerres des Clones', years: '22 - 19 AVBY', icon: 'jedi-order-svgrepo-com.svg' },
    { id: 'imperial', name: 'Ère Impériale', years: '19 - 4 AVBY', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
    { id: 'new_republic', name: 'Nouvelle République', years: '4 - 28 APBY', icon: 'NR_Seal.svg' },
    { id: 'first_order', name: 'Premier Ordre', years: '28 - 35 APBY', icon: 'Emblem_of_the_First_Order.svg' }
  ];

  const FACTIONS = [
    { id: 'jedi', name: 'Ordre Jedi', color: '#4ec9b0', icon: 'jedi-order-svgrepo-com.svg' },
    { id: 'sith', name: 'Ordre Sith', color: '#e51414', icon: 'starwars-sith-svgrepo-com.svg' },
    { id: 'empire', name: 'Empire Galactique', color: '#c41e3a', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
    { id: 'rebels', name: 'Alliance Rebelle', color: '#f39c12', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'republic', name: 'République Galactique', color: '#3498db', icon: 'brand-galactic-republic-svgrepo-com.svg' },
    { id: 'mandalore', name: 'Mandalorians', color: '#9b59b6', icon: 'mandalorian-svgrepo-com.svg' },
    { id: 'first_order', name: 'Premier Ordre', color: '#1a1a2e', icon: 'Emblem_of_the_First_Order.svg' },
    { id: 'hutt', name: 'Cartel Hutt', color: '#27ae60', icon: 'Desilijic_clan_vector.svg' },
    { id: 'neutral', name: 'Indépendant', color: '#95a5a6', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
  ];

  const ROLES = [
    { id: 'jedi_knight', name: 'Chevalier Jedi', faction: 'jedi', icon: 'luke-skywalker-lightsaber-svgrepo-com.svg' },
    { id: 'jedi_master', name: 'Maître Jedi', faction: 'jedi', icon: 'jedi-order-svgrepo-com.svg' },
    { id: 'padawan', name: 'Padawan', faction: 'jedi', icon: 'lightsaber-svgrepo-com.svg' },
    { id: 'sith_lord', name: 'Seigneur Sith', faction: 'sith', icon: 'SithEmblem-Traced-TORkit.svg' },
    { id: 'sith_apprentice', name: 'Apprenti Sith', faction: 'sith', icon: 'starwars-sith-svgrepo-com.svg' },
    { id: 'imperial_officer', name: 'Officier Impérial', faction: 'empire', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
    { id: 'stormtrooper', name: 'Stormtrooper', faction: 'empire', icon: 'noun-storm-trooper-49992.svg' },
    { id: 'rebel_pilot', name: 'Pilote Rebelle', faction: 'rebels', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'rebel_leader', name: 'Leader Rebelle', faction: 'rebels', icon: 'brand-galactic-republic-svgrepo-com.svg' },
    { id: 'senator', name: 'Sénateur', faction: 'republic', icon: 'brand-galactic-republic-svgrepo-com.svg' },
    { id: 'clone_trooper', name: 'Clone Trooper', faction: 'republic', icon: 'noun-storm-trooper-49992.svg' },
    { id: 'mandalorian_warrior', name: 'Guerrier Mandalorien', faction: 'mandalore', icon: 'mandalorian-svgrepo-com.svg' },
    { id: 'bounty_hunter', name: 'Chasseur de Primes', faction: 'neutral', icon: 'scifi-starwars-boba-fett-svgrepo-com.svg' },
    { id: 'smuggler', name: 'Contrebandier', faction: 'neutral', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'scavenger', name: 'Éclaireur', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' },
    { id: 'force_sensitive', name: 'Sensible à la Force', faction: 'neutral', icon: 'luke-skywalker-lightsaber-svgrepo-com.svg' },
    { id: 'first_order_trooper', name: 'Soldat du Premier Ordre', faction: 'first_order', icon: 'Emblem_of_the_First_Order.svg' },
    { id: 'resistance_member', name: 'Membre de la Résistance', faction: 'rebels', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'hutt_enforcer', name: 'Main du Hutt', faction: 'hutt', icon: 'Desilijic_clan_vector.svg' },
    { id: 'jedi_exile', name: ' Jedi Banni', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
  ];

  onMount(async () => {
    const id = $page.params.id;
    if (id && id !== 'new') {
      storyId = id;
      await loadStory(id);
      step = 'edit';
    }
    loading = false;
  });

  function selectEra(eraId: string) {
    updateSetupField('era', eraId);
  }

  function selectFaction(factionId: string) {
    updateSetupField('faction', factionId);
    updateSetupField('role', '');
  }

  function selectRole(roleId: string) {
    updateSetupField('role', roleId);
  }

  function handlePremiseInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    updateSetupField('premise', target.value);
  }

  function canProceedToEdit(): boolean {
    const setup = get(currentSetup);
    return !!(setup.era && setup.faction && setup.role && setup.premise);
  }

  function proceedToEdit() {
    if (canProceedToEdit()) {
      step = 'edit';
    }
  }

  function goBackToSetup() {
    step = 'setup';
  }

  async function handleSave() {
    saving = true;
    try {
      if (storyId) {
        await saveStory();
        showToast('Histoire sauvegardée', 'success');
      } else {
        const newStory = await createStory(currentSetup);
        storyId = newStory.id;
        goto(`/editor/${newStory.id}`, { replaceState: true });
        showToast('Histoire créée', 'success');
      }
    } catch (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
      console.error(error);
    }
    saving = false;
  }

  function addSection(type: 'narration' | 'dialogue' | 'action' | 'reflection') {
    const appended = get(story).content + `\n[${type.toUpperCase()}]\n\n[/${type.toUpperCase()}]\n`;
    updateContent(appended);
  }

  function getCurrentEra() {
    return ERAS.find(e => e.id === $currentSetup.era);
  }

  function getCurrentFaction() {
    return FACTIONS.find(f => f.id === $currentSetup.faction);
  }

  function getCurrentRole() {
    return ROLES.find(r => r.id === $currentSetup.role);
  }

  function getFilteredRoles() {
    if (!$currentSetup.faction) return ROLES;
    return ROLES.filter(r => r.faction === $currentSetup.faction);
  }
</script>

<svelte:head>
  <title>{storyId ? 'Modifier l\'histoire' : 'Nouvelle histoire'} — Star Wars Story Manager</title>
</svelte:head>

<div class="editor-layout">
  <main class="editor-main">
    <PageHeader
      title={storyId ? 'Modifier l\'histoire' : 'Nouvelle histoire'}
      showBack={true}
      on:back={() => goto('/')}
    >
      <button class="btn btn-secondary" on:click={handleSave} disabled={saving}>
        {#if saving}
          <span class="spinner"></span>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17,21 17,13 7,13 7,21"/>
            <polyline points="7,3 7,8 15,8"/>
          </svg>
        {/if}
        Sauvegarder
      </button>
    </PageHeader>

    <div class="editor-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      {:else if step === 'setup'}
        <div class="setup-container">
          <div class="setup-header">
            <h1>Configurez votre histoire</h1>
            <p>Choisissez le contexte de votre aventure dans l'univers Star Wars</p>
          </div>

          <!-- Era Selection -->
          <section class="setup-section">
            <h2>
              <span class="step-number">1</span>
              Choisissez l'ère
            </h2>
            <div class="era-grid">
              {#each ERAS as era}
                <button
                  class="era-card"
                  class:selected={$currentSetup.era === era.id}
                  on:click={() => selectEra(era.id)}
                >
                  <span class="era-icon">
                    <SvgIcon filename={era.icon} size={40} color="currentColor" alt={era.name} />
                  </span>
                  <span class="era-name">{era.name}</span>
                  <span class="era-years">{era.years}</span>
                </button>
              {/each}
            </div>
          </section>

          <!-- Faction Selection -->
          <section class="setup-section">
            <h2>
              <span class="step-number">2</span>
              Choisissez votre faction
            </h2>
            <div class="faction-grid">
              {#each FACTIONS as faction}
                <button
                  class="faction-card"
                  class:selected={$currentSetup.faction === faction.id}
                  style="--faction-color: {faction.color}"
                  on:click={() => selectFaction(faction.id)}
                >
                  <span class="faction-icon">
                    <SvgIcon filename={faction.icon} size={36} color="currentColor" alt={faction.name} />
                  </span>
                  <span class="faction-name">{faction.name}</span>
                </button>
              {/each}
            </div>
          </section>

          <!-- Role Selection -->
          <section class="setup-section">
            <h2>
              <span class="step-number">3</span>
              Choisissez votre personnage
            </h2>
            {#if !$currentSetup.faction}
              <p class="hint">Sélectionnez d'abord une faction</p>
            {:else}
              <div class="role-grid">
                {#each getFilteredRoles() as role}
                  <button
                    class="role-card"
                    class:selected={$currentSetup.role === role.id}
                    on:click={() => selectRole(role.id)}
                  >
                    <span class="role-icon">
                      <SvgIcon filename={role.icon} size={28} color="currentColor" alt={role.name} />
                    </span>
                    <span class="role-name">{role.name}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </section>

          <!-- Premise -->
          <section class="setup-section">
            <h2>
              <span class="step-number">4</span>
              Décrivez votre histoire
            </h2>
            <textarea
              class="premise-input"
              placeholder="Ex: Vous êtes un Jedi exilé qui découvre une menace cachée au cœur de la galaxie..."
              value={$currentSetup.premise}
              on:input={handlePremiseInput}
              rows="4"
            ></textarea>
          </section>

          <div class="setup-actions">
            <button
              class="btn btn-primary btn-large"
              disabled={!canProceedToEdit()}
              on:click={proceedToEdit}
            >
              Commencer à écrire
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12,5 19,12 12,19"/>
              </svg>
            </button>
          </div>
        </div>
      {:else}
        <div class="edit-container">
          <!-- Story Context Bar -->
          <div class="context-bar">
            <div class="context-item">
              <span class="context-label">Ère</span>
              <span class="context-value">{getCurrentEra()?.name}</span>
            </div>
            <div class="context-item">
              <span class="context-label">Faction</span>
              <span class="context-value" style="color: {getCurrentFaction()?.color}">
                {getCurrentFaction()?.name}
              </span>
            </div>
            <div class="context-item">
              <span class="context-label">Rôle</span>
              <span class="context-value">{getCurrentRole()?.name}</span>
            </div>
            <button class="btn btn-ghost btn-small" on:click={goBackToSetup}>
              Modifier
            </button>
          </div>

          <!-- Editor Toolbar -->
          <div class="editor-toolbar">
            <div class="toolbar-group">
              <button class="toolbar-btn" title="Narration" on:click={() => addSection('narration')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
              </button>
              <button class="toolbar-btn" title="Dialogue" on:click={() => addSection('dialogue')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </button>
              <button class="toolbar-btn" title="Action" on:click={() => addSection('action')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
                </svg>
              </button>
              <button class="toolbar-btn" title="Réflexion" on:click={() => addSection('reflection')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Story Content Editor -->
          <div class="story-editor">
            <textarea
              class="content-editor"
              placeholder="Commencez à écrire votre histoire ici...

Utilisez les boutons ci-dessus pour ajouter des sections:
- [NARRATION] pour la narration
- [DIALOGUE] pour les dialogues
- [ACTION] pour les scènes d'action
- [REFLECTION] pour les moments de réflexion"
              value={$story.content}
              on:input={(e) => updateContent((e.currentTarget as HTMLTextAreaElement).value)}
            ></textarea>
          </div>

          <!-- Word Count -->
          <div class="editor-footer">
            <span class="word-count">
              {$story.content.split(/\s+/).filter(w => w.length > 0).length} mots
            </span>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .editor-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .editor-content {
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

  /* Setup Styles */
  .setup-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .setup-header {
    text-align: center;
    margin-bottom: var(--space-2xl);
  }

  .setup-header h1 {
    font-size: 2rem;
    color: var(--color-text-primary);
    margin-bottom: var(--space-sm);
  }

  .setup-header p {
    color: var(--color-text-muted);
    font-size: 1.125rem;
  }

  .setup-section {
    margin-bottom: var(--space-2xl);
  }

  .setup-section h2 {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: 1.25rem;
    color: var(--color-text-primary);
    margin-bottom: var(--space-lg);
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-gold);
    color: var(--color-bg-primary);
    border-radius: 50%;
    font-weight: 700;
    font-size: 0.875rem;
  }

  .era-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
  }

  .era-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: left;
  }

  .era-icon,
  .faction-icon,
  .role-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gold);
    flex-shrink: 0;
  }

  .era-icon {
    width: 48px;
    height: 48px;
  }

  .faction-icon {
    width: 40px;
    height: 40px;
    margin-bottom: var(--space-xs);
  }

  .role-icon {
    width: 30px;
    height: 30px;
  }

  .era-card:hover {
    border-color: var(--color-gold);
    transform: translateY(-2px);
  }

  .era-card.selected {
    border-color: var(--color-gold);
    background: rgba(255, 232, 31, 0.1);
  }

  .era-name {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: var(--space-xs);
  }

  .era-years {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .faction-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-md);
  }

  .faction-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
    border-left: 4px solid var(--faction-color);
  }

  .faction-card:hover {
    border-color: var(--faction-color);
    transform: translateY(-2px);
  }

  .faction-card.selected {
    border-color: var(--faction-color);
    background: color-mix(in srgb, var(--faction-color) 15%, transparent);
  }

  .faction-name {
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .role-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-sm);
  }

  .role-card {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .role-card:hover {
    border-color: var(--color-blue);
    transform: translateY(-2px);
  }

  .role-card.selected {
    border-color: var(--color-blue);
    background: rgba(79, 195, 247, 0.1);
  }

  .role-icon {
    line-height: 0;
  }

  .role-name {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .hint {
    color: var(--color-text-muted);
    font-style: italic;
    padding: var(--space-lg);
    text-align: center;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .premise-input {
    width: 100%;
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.6;
    resize: vertical;
    transition: border-color var(--transition-fast);
  }

  .premise-input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .premise-input::placeholder {
    color: var(--color-text-muted);
  }

  .setup-actions {
    display: flex;
    justify-content: center;
    padding: var(--space-xl) 0;
  }

  .btn-large {
    padding: var(--space-md) var(--space-xl);
    font-size: 1.125rem;
  }

  .btn-large svg {
    width: 20px;
    height: 20px;
  }

  /* Edit Mode Styles */
  .edit-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
  }

  .context-bar {
    display: flex;
    align-items: center;
    gap: var(--space-xl);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-lg);
  }

  .context-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .context-label {
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .context-value {
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .context-bar .btn {
    margin-left: auto;
  }

  .editor-toolbar {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    border-bottom: none;
  }

  .toolbar-group {
    display: flex;
    gap: var(--space-xs);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toolbar-btn:hover {
    background: var(--color-bg-primary);
    color: var(--color-gold);
    border-color: var(--color-gold);
  }

  .toolbar-btn svg {
    width: 20px;
    height: 20px;
  }

  .story-editor {
    flex: 1;
    border: 1px solid var(--color-border);
    border-top: none;
    background: var(--color-bg-secondary);
  }

  .content-editor {
    width: 100%;
    height: 100%;
    padding: var(--space-xl);
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.8;
    resize: none;
  }

  .content-editor:focus {
    outline: none;
  }

  .content-editor::placeholder {
    color: var(--color-text-muted);
  }

  .editor-footer {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-top: none;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .word-count {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  @media (max-width: 768px) {
    .era-grid,
    .faction-grid,
    .role-grid {
      grid-template-columns: 1fr;
    }

    .context-bar {
      flex-wrap: wrap;
    }
  }
</style>