<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getPreferences, savePreferences, exportAllData, importAllData, emptyTrash, type UserPreferences } from '$lib/db';
  import { showToast, theme, uiLanguage } from '$lib/stores/ui';
  import { UI_LANGUAGE_OPTIONS, type UiLanguageCode } from '$lib/config/languages';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let preferences: UserPreferences | null = null;
  let loading = true;
  let saving = false;
  let importInput: HTMLInputElement | null = null;

  onMount(async () => {
    preferences = await getPreferences();
    loading = false;
  });

  async function handleSave() {
    if (!preferences) return;
    saving = true;
    try {
      await savePreferences(preferences);
      uiLanguage.set(preferences.uiLanguage);
      theme.set(preferences.theme);
      showToast('Paramètres sauvegardés', 'success');
    } catch (e) {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
    saving = false;
  }

  async function handleExportData() {
    try {
      const payload = await exportAllData();
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `star-wars-story-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Sauvegarde exportée', 'success');
    } catch (error) {
      showToast('Impossible d’exporter les données', 'error');
    }
  }

  function triggerImport() {
    importInput?.click();
  }

  async function handleImportData(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const confirmed = window.confirm('Importer ce fichier remplacera les données locales. Continuer ?');
    if (!confirmed) {
      input.value = '';
      return;
    }

    try {
      const payload = await file.text();
      const counts = await importAllData(payload);
      showToast(`Import terminé (${counts.stories} histoires, ${counts.folders} dossiers)`, 'success');
      window.location.reload();
    } catch (error) {
      showToast('Impossible d’importer ce fichier', 'error');
    } finally {
      input.value = '';
    }
  }

  async function handleEmptyTrash() {
    const confirmed = window.confirm('Supprimer définitivement toutes les histoires de la corbeille ?');
    if (!confirmed) return;

    try {
      await emptyTrash();
      showToast('Corbeille vidée', 'success');
    } catch (error) {
      showToast('Impossible de vider la corbeille', 'error');
    }
  }

  function handleThemeChange(newTheme: 'light' | 'dark' | 'auto') {
    if (preferences) {
      preferences.theme = newTheme;
    }
  }

  function handleLanguageChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (preferences) {
      preferences.uiLanguage = target.value as UiLanguageCode;
      uiLanguage.set(preferences.uiLanguage);
    }
  }

  function handleAutoSaveChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (preferences) {
      preferences.autoSave = target.checked;
    }
  }

  function handleAutoSaveIntervalChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (preferences) {
      preferences.autoSaveInterval = parseInt(target.value, 10);
    }
  }

  function addProfile() {
    if (!preferences) return;
    const newProfile = {
      id: crypto.randomUUID(),
      name: 'Nouveau Profil',
      icon: '🚀',
      config: {}
    };
    preferences.profiles = [...preferences.profiles, newProfile];
  }

  function removeProfile(profileId: string) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.filter(p => p.id !== profileId);
  }

  function updateProfileName(profileId: string, name: string) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.map(p => 
      p.id === profileId ? { ...p, name } : p
    );
  }

  function updateProfileIcon(profileId: string, icon: string) {
    if (!preferences) return;
    preferences.profiles = preferences.profiles.map(p => 
      p.id === profileId ? { ...p, icon } : p
    );
  }
</script>

<svelte:head>
  <title>Paramètres — Star Wars Story Manager</title>
</svelte:head>

<div class="settings-layout">
  <PageHeader
    title="Paramètres"
    showBack={true}
    on:back={() => goto('/')}
  >
    <button class="btn btn-primary" on:click={handleSave} disabled={saving}>
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

  <main class="settings-main">

    <div class="settings-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Chargement des paramètres...</p>
        </div>
      {:else if preferences}
        <div class="settings-sections">
          <!-- Appearance -->
          <section class="settings-section">
            <div class="section-header">
              <div class="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </div>
              <div>
                <h2>Apparence</h2>
                <p>Personnalisez l'aspect de l'application</p>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label for="theme">Thème</label>
                <span class="setting-description">Choisissez votre thème préféré</span>
              </div>
              <div class="theme-selector">
                <button 
                  class="theme-btn" 
                  class:active={preferences.theme === 'light'}
                  on:click={() => handleThemeChange('light')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  Clair
                </button>
                <button 
                  class="theme-btn" 
                  class:active={preferences.theme === 'dark'}
                  on:click={() => handleThemeChange('dark')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                  Sombre
                </button>
                <button 
                  class="theme-btn" 
                  class:active={preferences.theme === 'auto'}
                  on:click={() => handleThemeChange('auto')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Auto
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label for="language">Langue de l'interface</label>
                <span class="setting-description">La langue de l'interface sera également celle de vos histoires</span>
              </div>
              <select 
                id="language" 
                class="select"
                value={preferences.uiLanguage}
                on:change={handleLanguageChange}
              >
                {#each UI_LANGUAGE_OPTIONS as lang}
                  <option value={lang.code}>{lang.name}</option>
                {/each}
              </select>
            </div>
          </section>

          <!-- Editor Settings -->
          <section class="settings-section">
            <div class="section-header">
              <div class="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div>
                <h2>Éditeur</h2>
                <p>Configurez le comportement de l'éditeur</p>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label for="autosave">Sauvegarde automatique</label>
                <span class="setting-description">Sauvegarder automatiquement vos histoires pendant l'édition</span>
              </div>
              <label class="toggle">
                <input 
                  type="checkbox" 
                  id="autosave"
                  checked={preferences.autoSave}
                  on:change={handleAutoSaveChange}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label for="autosave-interval">Intervalle de sauvegarde</label>
                <span class="setting-description">Fréquence de la sauvegarde automatique</span>
              </div>
              <select 
                id="autosave-interval" 
                class="select"
                value={preferences.autoSaveInterval}
                on:change={handleAutoSaveIntervalChange}
                disabled={!preferences.autoSave}
              >
                <option value={15000}>15 secondes</option>
                <option value={30000}>30 secondes</option>
                <option value={60000}>1 minute</option>
                <option value={120000}>2 minutes</option>
                <option value={300000}>5 minutes</option>
              </select>
            </div>
          </section>

          <!-- Creative Profiles -->
          <section class="settings-section">
            <div class="section-header">
              <div class="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <h2>Profils créatifs</h2>
                <p>Créez des profils pour démarrer rapidement vos histoires</p>
              </div>
            </div>

            <div class="profiles-grid">
              {#each preferences.profiles as profile (profile.id)}
                <div class="profile-card">
                  <div class="profile-header">
                    <span class="profile-icon">{profile.icon}</span>
                    <input 
                      type="text" 
                      class="profile-name"
                      value={profile.name}
                      on:input={(e) => updateProfileName(profile.id, e.currentTarget.value)}
                    />
                    <button class="profile-delete" on:click={() => removeProfile(profile.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div class="profile-fields">
                    <div class="profile-field">
                      <label>Ère par défaut</label>
                      <select class="select" bind:value={profile.config.defaultEra}>
                        <option value="">Aucune</option>
                        <option value="old_republic">Ancienne République</option>
                        <option value="clone_wars">Guerres des Clones</option>
                        <option value="imperial">Ère Impériale</option>
                        <option value="new_republic">Nouvelle République</option>
                        <option value="first_order">Premier Ordre</option>
                      </select>
                    </div>
                    <div class="profile-field">
                      <label>Faction par défaut</label>
                      <select class="select" bind:value={profile.config.defaultFaction}>
                        <option value="">Aucune</option>
                        <option value="jedi">Ordre Jedi</option>
                        <option value="sith">Ordre Sith</option>
                        <option value="empire">Empire</option>
                        <option value="rebels">Alliance Rebelle</option>
                        <option value="republic">République</option>
                        <option value="mandalore">Mandalorians</option>
                      </select>
                    </div>
                  </div>
                </div>
              {/each}

              <button class="add-profile-btn" on:click={addProfile}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Ajouter un profil
              </button>
            </div>
          </section>

          <!-- Keyboard Shortcuts -->
          <section class="settings-section">
            <div class="section-header">
              <div class="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
                  <line x1="6" y1="8" x2="6.01" y2="8"/>
                  <line x1="10" y1="8" x2="10.01" y2="8"/>
                  <line x1="14" y1="8" x2="14.01" y2="8"/>
                  <line x1="18" y1="8" x2="18.01" y2="8"/>
                  <line x1="6" y1="12" x2="6.01" y2="12"/>
                  <line x1="18" y1="12" x2="18.01" y2="12"/>
                  <line x1="8" y1="16" x2="16" y2="16"/>
                </svg>
              </div>
              <div>
                <h2>Raccourcis clavier</h2>
                <p>Personnalisez les raccourcis pour naviguer plus vite</p>
              </div>
            </div>

            <div class="shortcuts-list">
              <div class="shortcut-item">
                <span class="shortcut-action">Nouvelle histoire</span>
                <kbd class="shortcut-key">{preferences.shortcuts.newStory || 'Ctrl+N'}</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-action">Sauvegarder</span>
                <kbd class="shortcut-key">{preferences.shortcuts.saveStory || 'Ctrl+S'}</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-action">Rechercher</span>
                <kbd class="shortcut-key">{preferences.shortcuts.search || 'Ctrl+F'}</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-action">Afficher/Masquer la barre latérale</span>
                <kbd class="shortcut-key">{preferences.shortcuts.toggleSidebar || 'Ctrl+B'}</kbd>
              </div>
              <div class="shortcut-item">
                <span class="shortcut-action">Paramètres</span>
                <kbd class="shortcut-key">{preferences.shortcuts.settings || 'Ctrl+,'}</kbd>
              </div>
            </div>
          </section>

          <!-- Data Management -->
          <section class="settings-section danger">
            <div class="section-header">
              <div class="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </div>
              <div>
                <h2>Gestion des données</h2>
                <p>Exportez ou supprimez vos données</p>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label>Exporter toutes les données</label>
                <span class="setting-description">Téléchargez une sauvegarde complète de vos histoires</span>
              </div>
              <button class="btn btn-secondary" on:click={handleExportData}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exporter
              </button>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label>Importer des données</label>
                <span class="setting-description"> Restaurez des histoires depuis un fichier de sauvegarde</span>
              </div>
              <input
                bind:this={importInput}
                type="file"
                accept="application/json"
                class="hidden-file-input"
                on:change={handleImportData}
              />
              <button class="btn btn-secondary" on:click={triggerImport}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Importer
              </button>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="danger-label">Vider la corbeille</label>
                <span class="setting-description">Supprimer définitivement toutes les histoires supprimées</span>
              </div>
              <button class="btn btn-danger" on:click={handleEmptyTrash}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                Vider la corbeille
              </button>
            </div>
          </section>
        </div>
      {/if}
    </div>
  </main>
</div>


<style>
  .settings-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .settings-main {
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

  .hidden-file-input {
    display: none;
  }

  .settings-content {
    flex: 1;
    padding: var(--space-xl);
    overflow-y: auto;
    max-width: 800px;
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

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .settings-section {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
  }

  .settings-section.danger {
    border-color: var(--color-red);
  }

  .section-header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .section-icon {
    width: 48px;
    height: 48px;
    padding: var(--space-sm);
    background: rgba(255, 232, 31, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-gold);
    flex-shrink: 0;
  }

  .section-icon svg {
    width: 100%;
    height: 100%;
  }

  .section-header h2 {
    font-size: 1.25rem;
    color: var(--color-text-primary);
    margin-bottom: var(--space-xs);
  }

  .section-header p {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xl);
    padding: var(--space-lg) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .setting-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .setting-item:first-of-type {
    padding-top: 0;
  }

  .setting-info {
    flex: 1;
  }

  .setting-info label {
    display: block;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: var(--space-xs);
  }

  .setting-description {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .danger-label {
    color: var(--color-red);
  }

  .theme-selector {
    display: flex;
    gap: var(--space-xs);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .theme-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .theme-btn:hover {
    color: var(--color-text-primary);
  }

  .theme-btn.active {
    background: var(--color-bg-hover);
    color: var(--color-gold);
  }

  .theme-btn svg {
    width: 16px;
    height: 16px;
  }

  .select {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    min-width: 180px;
    cursor: pointer;
  }

  .select:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    min-width: 200px;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--color-bg-tertiary);
    border-radius: 24px;
    transition: all var(--transition-fast);
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: var(--color-text-muted);
    border-radius: 50%;
    transition: all var(--transition-fast);
  }

  .toggle input:checked + .toggle-slider {
    background: var(--color-gold);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(24px);
    background: var(--color-bg-primary);
  }

  .profiles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-lg);
  }

  .profile-card {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }

  .profile-icon {
    font-size: 1.5rem;
  }

  .profile-name {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    padding: var(--space-xs);
  }

  .profile-name:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .profile-delete {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .profile-delete:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-red);
  }

  .profile-delete svg {
    width: 16px;
    height: 16px;
  }

  .profile-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .profile-field label {
    display: block;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: var(--space-xs);
  }

  .profile-field .select {
    width: 100%;
    min-width: unset;
  }

  .add-profile-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-lg);
    background: var(--color-bg-tertiary);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-height: 120px;
  }

  .add-profile-btn:hover {
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .add-profile-btn svg {
    width: 24px;
    height: 24px;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .shortcut-action {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .shortcut-key {
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-primary);
  }

  .btn svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 768px) {
    .setting-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .theme-selector {
      width: 100%;
      justify-content: center;
    }
  }
</style>