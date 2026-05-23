<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import SvgIcon from '$lib/components/SvgIcon.svelte';
  import { currentSetup, updateSetupField } from '$lib/stores/editor';
  import {
    AVATARS, CONTENT_MODES, defaultRoleForFaction, ERAS, FACTIONS, ROLES,
    SETUP_SCREENS, TRAMES, WRITING_LENGTHS, WRITING_POVS, WRITING_STYLES, WRITING_TONES
  } from '$lib/editor/setupCatalog';
  import type { SetupScreenId } from '$lib/editor/setupCatalog';

  export let generating = false;
  export let generationError = '';
  export let providerStatus = '';
  export let providerMissing = false;

  const dispatch = createEventDispatcher<{
    launch: void;
    settings: void;
  }>();

  export let setupScreenIndex = 0;
  export let setupSlideDir = 1;
  export let selectedTrame: string | null = null;
  let canContinueStep = false;


  $: activeSetupStep = SETUP_SCREENS[setupScreenIndex];
  $: isLastSetupStep = setupScreenIndex === SETUP_SCREENS.length - 1;
  $: currentRoleLabel = ROLES.find(role => role.id === $currentSetup.role)?.name || $currentSetup.role || '—';
  $: currentFactionLabel = FACTIONS.find(faction => faction.id === $currentSetup.faction)?.name || $currentSetup.faction || '—';
  $: protagonistDisplayName = [$currentSetup.protagonistFirstName || '', $currentSetup.protagonistLastName || ''].join(' ').trim() || 'Protagoniste sans nom';
  $: selectedTrameLabel = TRAMES.find(trame => trame.id === selectedTrame)?.name || 'Libre';
  $: canContinueStep = stepIsComplete(activeSetupStep.id, $currentSetup);
  $: canLaunch = isSetupReady($currentSetup) && !providerMissing && !generating;

  function goToSetupStep(index: number): void {
    const boundedIndex = Math.max(0, Math.min(SETUP_SCREENS.length - 1, index));
    if (boundedIndex === setupScreenIndex) return;
    setupSlideDir = boundedIndex > setupScreenIndex ? 1 : -1;
    setupScreenIndex = boundedIndex;
  }

  function nextSetupStep(): void {
    if (isLastSetupStep) {
      dispatch('launch');
      return;
    }
    goToSetupStep(setupScreenIndex + 1);
  }

  function previousSetupStep(): void {
    goToSetupStep(setupScreenIndex - 1);
  }

  function selectEra(eraId: string): void {
    updateSetupField('era', eraId);
  }

  function selectFaction(factionId: string): void {
    updateSetupField('faction', factionId);
    const setup = get(currentSetup);
    if (!setup.role) {
      updateSetupField('role', defaultRoleForFaction(factionId));
    }
  }

  function selectRole(roleId: string): void {
    updateSetupField('role', roleId);
  }

  function selectTrame(trame: (typeof TRAMES)[number]): void {
    selectedTrame = trame.id;
    if (trame.premise) {
      updateSetupField('premise', trame.premise);
    }
  }

  function selectWritingStyle(styleId: string): void {
    updateSetupField('writingStyle', styleId);
  }

  function selectWritingTone(toneId: string): void {
    updateSetupField('writingTone', toneId);
  }

  function selectWritingPov(povId: string): void {
    updateSetupField('writingPov', povId);
  }

  function selectWritingLength(lengthId: string): void {
    updateSetupField('writingLength', lengthId);
  }

  function selectContentMode(modeId: string): void {
    updateSetupField('contentMode', modeId);
  }

  function selectAvatar(avatar: string): void {
    updateSetupField('protagonistAvatar', avatar);
  }

  function handleFirstNameInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    updateSetupField('protagonistFirstName', target.value);
  }

  function handleLastNameInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    updateSetupField('protagonistLastName', target.value);
  }

  function handlePremiseInput(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement;
    if (!selectedTrame) selectedTrame = 'custom';
    if (selectedTrame && selectedTrame !== 'custom') {
      const preset = TRAMES.find(item => item.id === selectedTrame)?.premise?.trim() || '';
      if (target.value.trim() !== preset) selectedTrame = 'custom';
    }
    updateSetupField('premise', target.value);
  }

  function stepIsComplete(stepId: SetupScreenId, setup = get(currentSetup)): boolean {
    if (stepId === 'era') return Boolean(setup.era);
    if (stepId === 'faction_role') return Boolean(setup.faction && setup.role);
    if (stepId === 'premise') return Boolean((setup.premise || '').trim());
    if (stepId === 'style') {
      return Boolean(
        setup.writingStyle &&
        setup.writingTone &&
        setup.writingPov &&
        setup.writingLength &&
        setup.contentMode
      );
    }
    if (stepId === 'profile') return true;
    return isSetupReady(setup);
  }

  function isSetupReady(setup = get(currentSetup)): boolean {
    return ['era', 'faction_role', 'premise', 'style'].every(step => stepIsComplete(step as SetupScreenId, setup));
  }

  function getFilteredRoles() {
    const selectedFaction = get(currentSetup).faction;
    if (!selectedFaction) return ROLES;

    const byPriority = (faction: string): number => {
      if (faction === selectedFaction) return 0;
      if (faction === 'neutral') return 1;
      return 2;
    };

    return [...ROLES].sort((left, right) => {
      const diff = byPriority(left.faction) - byPriority(right.faction);
      if (diff !== 0) return diff;
      return left.name.localeCompare(right.name);
    });
  }

  function getCurrentEraLabel(): string {
    return ERAS.find(era => era.id === get(currentSetup).era)?.name || '—';
  }

  function getCurrentFactionLabel(): string {
    return FACTIONS.find(faction => faction.id === get(currentSetup).faction)?.name || '—';
  }

  function getCurrentRoleLabel(): string {
    return ROLES.find(role => role.id === get(currentSetup).role)?.name || '—';
  }

  function getCurrentStyleLabel(): string {
    return WRITING_STYLES.find(style => style.id === get(currentSetup).writingStyle)?.name || '—';
  }

  function getCurrentToneLabel(): string {
    return WRITING_TONES.find(tone => tone.id === get(currentSetup).writingTone)?.name || '—';
  }

  function getCurrentContentModeLabel(): string {
    return CONTENT_MODES.find(modeItem => modeItem.id === get(currentSetup).contentMode)?.name || '—';
  }

</script>

<div class="setup-shell">
  <div class="setup-progress" aria-label="Progression de la création d'histoire">
    {#each SETUP_SCREENS as step, index}
      <button
        type="button"
        class:active={index === setupScreenIndex}
        class:done={stepIsComplete(step.id) && index < setupScreenIndex}
        class="progress-pill"
        on:click={() => goToSetupStep(index)}
      >
        <span class="pill-index">{index + 1}</span>
        <span>{step.label}</span>
      </button>
    {/each}
  </div>

  {#if generationError}
    <div class="error-banner">{generationError}</div>
  {/if}

  <div class="setup-stage">
    {#key activeSetupStep.id}
      <section
        class="setup-screen"
        in:fly={{ x: setupSlideDir * 32, duration: 220 }}
        out:fly={{ x: setupSlideDir * -24, duration: 170 }}
      >
        <header class="setup-screen-header">
          <p class="subheading">Étape {setupScreenIndex + 1} / {SETUP_SCREENS.length}</p>
          <h1>{activeSetupStep.label}</h1>
          <p>{activeSetupStep.subtitle}</p>
        </header>

        {#if activeSetupStep.id === 'era'}
          <div class="setup-section">
            <div class="setup-section-header">
              <p class="subheading">Cadre temporel</p>
              <p class="helper-text">Choisis l’époque. C’est le carburant de tout le reste, pas un détail cosmétique.</p>
            </div>
            <div class="era-grid">
              {#each ERAS as era}
                <button
                  type="button"
                  class:selected={$currentSetup.era === era.id}
                  class="era-card"
                  on:click={() => selectEra(era.id)}
                >
                  <span class="era-icon" aria-hidden="true">
                    <SvgIcon filename={era.icon} size={42} />
                  </span>
                  <strong>{era.name}</strong>
                  <span class="era-years">{era.years}</span>
                </button>
              {/each}
            </div>
          </div>
        {:else if activeSetupStep.id === 'faction_role'}
          <div class="split-grid">
            <div class="setup-section">
              <div class="setup-section-header">
                <p class="subheading">Allégeance</p>
                <p class="helper-text">La faction place ton personnage dans la galaxie. Sans ça, tu n’as qu’un mannequin en robe.</p>
              </div>
              <div class="faction-grid">
                {#each FACTIONS as faction}
                  <button
                    type="button"
                    class:selected={$currentSetup.faction === faction.id}
                    class="faction-card"
                    style={`--faction-color: ${faction.color};`}
                    on:click={() => selectFaction(faction.id)}
                  >
                    <span class="faction-icon" aria-hidden="true">
                      <SvgIcon filename={faction.icon} size={30} />
                    </span>
                    <strong>{faction.name}</strong>
                  </button>
                {/each}
              </div>
            </div>

            <div class="setup-section">
              <div class="setup-section-header">
                <p class="subheading">Fonction</p>
                <p class="helper-text">Le rôle filtre la fantasy du perso. Un Padawan n’est pas un demi-dieu qui a raté sa sieste.</p>
              </div>
              <div class="role-grid">
                {#each getFilteredRoles() as role}
                  <button
                    type="button"
                    class:selected={$currentSetup.role === role.id}
                    class:recommended={role.faction === $currentSetup.faction}
                    class="role-card"
                    on:click={() => selectRole(role.id)}
                  >
                    <span class="role-icon" aria-hidden="true">
                      <SvgIcon filename={role.icon} size={24} />
                    </span>
                    <span class="role-copy">
                      <strong>{role.name}</strong>
                      <span class="role-meta">{FACTIONS.find(faction => faction.id === role.faction)?.name || 'Indépendant'}</span>
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {:else if activeSetupStep.id === 'premise'}
          <div class="setup-section">
            <div class="setup-section-header">
              <p class="subheading">Trame de départ</p>
              <p class="helper-text">Prends une trame solide puis tords-la. L’originalité sans tension de départ, c’est juste du vide bien parfumé.</p>
            </div>
            <div class="trame-grid">
              {#each TRAMES as trame}
                <button
                  type="button"
                  class:selected={selectedTrame === trame.id}
                  class="trame-card"
                  on:click={() => selectTrame(trame)}
                >
                  <span class="trame-icon" aria-hidden="true">{trame.icon}</span>
                  <span class="trame-name">{trame.name}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="setup-section">
            <div class="setup-section-header">
              <p class="premise-label">Accroche de départ</p>
              <p class="helper-text">Tu peux garder le preset, le réécrire, ou partir en roue libre. Mais donne une vraie direction à l’IA.</p>
            </div>
            <textarea
              class="premise-input"
              rows="7"
              placeholder="Décris le point de rupture initial, le problème, la promesse, le poison."
              value={$currentSetup.premise}
              on:input={handlePremiseInput}
            ></textarea>
          </div>
        {:else if activeSetupStep.id === 'style'}
          <div class="style-stack">
            <div class="setup-section">
              <div class="setup-section-header">
                <p class="subheading">Voix de narration</p>
                <p class="helper-text">Le style décide si ton histoire respire ou si elle récite des bullet points déguisés.</p>
              </div>
              <div class="style-grid">
                {#each WRITING_STYLES as style}
                  <button
                    type="button"
                    class:selected={$currentSetup.writingStyle === style.id}
                    class="style-card"
                    on:click={() => selectWritingStyle(style.id)}
                  >
                    <span class="style-name">{style.name}</span>
                    <span class="style-desc">{style.desc}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="double-stack">
              <div class="setup-section">
                <p class="subheading">Tonalité</p>
                <div class="tone-grid">
                  {#each WRITING_TONES as tone}
                    <button
                      type="button"
                      class:selected={$currentSetup.writingTone === tone.id}
                      class="tone-chip"
                      title={tone.desc}
                      on:click={() => selectWritingTone(tone.id)}
                    >
                      {tone.name}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="setup-section">
                <p class="subheading">Point de vue</p>
                <div class="toggle-chip-group">
                  {#each WRITING_POVS as pov}
                    <button
                      type="button"
                      class:active={$currentSetup.writingPov === pov.id}
                      class="toggle-chip"
                      on:click={() => selectWritingPov(pov.id)}
                    >
                      {pov.name}
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <div class="double-stack">
              <div class="setup-section">
                <p class="subheading">Longueur</p>
                <div class="toggle-chip-group">
                  {#each WRITING_LENGTHS as length}
                    <button
                      type="button"
                      class:active={$currentSetup.writingLength === length.id}
                      class="toggle-chip"
                      on:click={() => selectWritingLength(length.id)}
                    >
                      {length.name}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="setup-section">
                <p class="subheading">Mode de contenu</p>
                <div class="content-mode-grid">
                  {#each CONTENT_MODES as mode}
                    <button
                      type="button"
                      class:selected={$currentSetup.contentMode === mode.id}
                      class="content-mode-card"
                      on:click={() => selectContentMode(mode.id)}
                    >
                      <span class="content-mode-icon" aria-hidden="true">{mode.icon}</span>
                      <strong>{mode.name}</strong>
                      <span class="content-mode-desc">{mode.desc}</span>
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {:else if activeSetupStep.id === 'profile'}
          <div class="profile-card">
            <div class="setup-section">
              <div class="setup-section-header">
                <p class="subheading">Avatar rapide</p>
                <p class="helper-text">C’est optionnel, mais un visage même symbolique aide à ancrer la fantasy.</p>
              </div>
              <div class="avatar-row">
                {#each AVATARS as avatar}
                  <button
                    type="button"
                    class:selected={$currentSetup.protagonistAvatar === avatar}
                    class="avatar-btn"
                    on:click={() => selectAvatar(avatar)}
                  >
                    {avatar}
                  </button>
                {/each}
              </div>
            </div>

            <div class="setup-section">
              <div class="setup-section-header">
                <p class="subheading">Identité</p>
                <p class="helper-text">Nom facultatif. Si tu le laisses vide, l’histoire démarre quand même. Merci le progrès.</p>
              </div>
              <div class="name-grid">
                <label class="name-field">
                  <span>Prénom</span>
                  <input
                    class="name-input"
                    type="text"
                    placeholder="Kael"
                    value={$currentSetup.protagonistFirstName}
                    on:input={handleFirstNameInput}
                  />
                </label>
                <label class="name-field">
                  <span>Nom</span>
                  <input
                    class="name-input"
                    type="text"
                    placeholder="Voss"
                    value={$currentSetup.protagonistLastName}
                    on:input={handleLastNameInput}
                  />
                </label>
              </div>
            </div>
          </div>
        {:else}
          <div class="review-grid">
            <article class="review-card">
              <h2>Cadre</h2>
              <ul>
                <li>Ère: {getCurrentEraLabel()}</li>
                <li>Faction: {getCurrentFactionLabel()}</li>
                <li>Rôle: {getCurrentRoleLabel()}</li>
                <li>Trame: {selectedTrameLabel}</li>
              </ul>
            </article>

            <article class="review-card">
              <h2>Style IA</h2>
              <ul>
                <li>Style: {getCurrentStyleLabel()}</li>
                <li>Tonalité: {getCurrentToneLabel()}</li>
                <li>POV: {WRITING_POVS.find(item => item.id === $currentSetup.writingPov)?.name || '—'}</li>
                <li>Longueur: {WRITING_LENGTHS.find(item => item.id === $currentSetup.writingLength)?.name || '—'}</li>
                <li>Contenu: {getCurrentContentModeLabel()}</li>
              </ul>
            </article>

            <article class="review-card">
              <h2>Protagoniste</h2>
              <ul class="feature-list">
                <li>{($currentSetup.protagonistAvatar || '🧑‍🚀')} {protagonistDisplayName}</li>
                <li>{($currentSetup.premise || 'Aucune accroche').trim()}</li>
                <li class="provider-status">Provider: {providerStatus}</li>
              </ul>
            </article>
          </div>

          {#if providerMissing}
            <div class="provider-warning">
              <p>Aucun provider texte n’est configuré. Lancer sans moteur, c’est ambitieux même pour Star Wars.</p>
              <button type="button" class="btn btn-secondary" on:click={() => dispatch('settings')}>
                Ouvrir les paramètres IA
              </button>
            </div>
          {/if}
        {/if}

        <footer class="setup-nav">
          <button
            type="button"
            class="btn btn-ghost"
            on:click={previousSetupStep}
            disabled={setupScreenIndex === 0 || generating}
          >
            Retour
          </button>

          <div class="setup-nav-actions">
            <button type="button" class="btn btn-secondary" on:click={() => dispatch('settings')}>
              Paramètres IA
            </button>
            <button
              type="button"
              class="btn btn-primary"
              on:click={nextSetupStep}
              disabled={!canContinueStep || (isLastSetupStep && !canLaunch)}
            >
              {#if isLastSetupStep}
                {#if generating}
                  Lancement…
                {:else}
                  Lancer l’aventure
                {/if}
              {:else}
                Continuer
              {/if}
            </button>
          </div>
        </footer>
      </section>
    {/key}
  </div>
</div>


<style>
.setup-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-height: calc(100vh - 180px);
}

.setup-progress {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.progress-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 0.75rem;
}

.progress-pill.active {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: rgba(255, 232, 31, 0.1);
}

.progress-pill.done {
  border-color: color-mix(in srgb, var(--color-gold) 55%, var(--color-border));
  color: var(--color-text-secondary);
}

.pill-index {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  font-size: 0.65rem;
  font-weight: 700;
}

.setup-stage {
  position: relative;
  flex: 1;
  min-height: 560px;
  overflow: hidden;
}

.setup-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-secondary);
  overflow-y: auto;
}

.setup-screen-header h1 {
  margin: 0;
  font-size: 1.6rem;
  color: var(--color-text-primary);
}

.setup-screen-header p {
  margin: var(--space-xs) 0 0;
  color: var(--color-text-muted);
}

.setup-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
}

.setup-nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.setup-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-bg-tertiary) 55%, transparent);
}

.setup-section-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subheading {
  margin: 0 0 var(--space-sm);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.era-grid,
.faction-grid,
.role-grid,
.trame-grid,
.style-grid,
.content-mode-grid {
  display: grid;
  gap: var(--space-sm);
}

.era-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.faction-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.role-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  max-height: 360px;
  overflow-y: auto;
  padding-right: 2px;
}

.trame-grid {
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

.style-grid {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.content-mode-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.era-card,
.faction-card,
.role-card,
.trame-card,
.style-card,
.content-mode-card,
.tone-chip,
.toggle-chip,
.avatar-btn {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.era-card,
.faction-card,
.trame-card,
.style-card,
.content-mode-card {
  text-align: left;
  padding: var(--space-md);
}

.era-card:hover,
.faction-card:hover,
.role-card:hover,
.trame-card:hover,
.style-card:hover,
.content-mode-card:hover,
.tone-chip:hover,
.toggle-chip:hover,
.avatar-btn:hover {
  border-color: var(--color-gold);
}

.era-card.selected,
.faction-card.selected,
.role-card.selected,
.trame-card.selected,
.style-card.selected,
.content-mode-card.selected,
.tone-chip.selected,
.toggle-chip.active,
.avatar-btn.selected {
  border-color: var(--color-gold);
  background: rgba(255, 232, 31, 0.1);
}

.era-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: center;
  text-align: center;
}

.era-icon,
.faction-icon,
.role-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold);
}

.era-years {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.faction-card {
  border-left-color: var(--faction-color);
}

.faction-card.selected {
  border-color: var(--faction-color);
  background: color-mix(in srgb, var(--faction-color) 14%, transparent);
}

.role-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  text-align: left;
}

.role-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-meta {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.role-card.recommended {
  border-color: color-mix(in srgb, var(--color-gold) 40%, var(--color-border));
}

.trame-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-sm);
}

.trame-icon {
  font-size: 1.35rem;
}

.trame-name {
  font-size: 0.8rem;
  font-weight: 600;
}

.premise-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.premise-input,
.name-input {
  width: 100%;
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  resize: vertical;
  font: inherit;
  transition: border-color var(--transition-fast);
}

.premise-input:focus,
.name-input:focus {
  outline: none;
  border-color: var(--color-gold);
}

.style-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.style-name {
  font-weight: 600;
}

.style-desc,
.content-mode-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.tone-grid,
.toggle-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.tone-chip,
.toggle-chip {
  padding: var(--space-xs) var(--space-sm);
  font-size: 0.85rem;
}

.double-stack {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-md);
}

.content-mode-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.content-mode-icon {
  font-size: 1.25rem;
}

.profile-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.helper-text {
  margin: 0;
  color: var(--color-text-muted);
}

.avatar-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.avatar-btn {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.name-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
}

.name-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.name-field span {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-md);
}

.review-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.review-card h2 {
  margin: 0 0 var(--space-sm);
  font-size: 1rem;
}

.review-card ul {
  margin: 0;
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.feature-list {
  list-style: none;
  padding-left: 0;
}

.feature-list li {
  margin-bottom: var(--space-xs);
}

.provider-status {
  color: var(--color-text-muted);
}

.provider-warning {
  margin-top: var(--space-md);
  padding: var(--space-sm);
  border: 1px solid rgba(255, 23, 68, 0.45);
  border-radius: var(--radius-sm);
  background: rgba(255, 23, 68, 0.08);
}

.provider-warning p {
  margin: 0 0 var(--space-sm);
  color: var(--color-red);
}

.error-banner {
  border: 1px solid rgba(255, 23, 68, 0.5);
  background: rgba(255, 23, 68, 0.1);
  color: #ff8fa3;
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  font-size: 0.9rem;
}

@media (max-width: 920px) {
  .split-grid {
    grid-template-columns: 1fr;
  }

  .setup-screen {
    padding: var(--space-md);
  }
}

@media (max-width: 720px) {
  .setup-shell {
    min-height: calc(100vh - 150px);
  }

  .setup-stage {
    min-height: 520px;
  }

  .progress-pill {
    font-size: 0.7rem;
    padding: 6px 10px;
  }

  .setup-nav,
  .setup-nav-actions {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 768px) {
  .era-grid,
  .faction-grid,
  .role-grid,
  .trame-grid,
  .style-grid,
  .content-mode-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .setup-stage {
    min-height: auto;
  }

  .setup-screen {
    position: static;
  }

  .split-grid {
    grid-template-columns: 1fr;
  }

  .setup-shell {
    min-height: calc(100dvh - 140px);
    gap: 12px;
  }
}
</style>
