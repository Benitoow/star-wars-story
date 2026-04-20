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


  $: activeSetupStep = SETUP_SCREENS[setupScreenIndex];
  $: isLastSetupStep = setupScreenIndex === SETUP_SCREENS.length - 1;
  $: currentRoleLabel = ROLES.find(role => role.id === $currentSetup.role)?.name || $currentSetup.role || '—';
  $: currentFactionLabel = FACTIONS.find(faction => faction.id === $currentSetup.faction)?.name || $currentSetup.faction || '—';

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
    updateSetupField('premise', target.value);
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
</style>
