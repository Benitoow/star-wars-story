<script lang="ts">
  /* Creation wizard — orchestration only. Each step owns its own markup,
     styling and motion; this file holds the shared state and the navigation. */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import { preferences } from '$lib/stores/preferences';
  import {
    ERAS, FACTIONS, TRAMES, AVATARS, NARRATIVE_PRESETS,
    eraBackdrop, defaultRoleForFaction, withSetupDefaults, type NarrativePreset
  } from '$lib/content/catalog';
  import { createStory } from '$lib/persistence';
  import { toasts } from '$lib/stores/ui';
  import SceneBackdrop from '$lib/ui/SceneBackdrop.svelte';
  import StepEra from '$lib/ui/wizard/StepEra.svelte';
  import StepCharacter from '$lib/ui/wizard/StepCharacter.svelte';
  import StepTrame from '$lib/ui/wizard/StepTrame.svelte';
  import StepStyle from '$lib/ui/wizard/StepStyle.svelte';
  import SetupRecap from '$lib/ui/wizard/SetupRecap.svelte';
  import GenesisStep from '$lib/ui/wizard/GenesisStep.svelte';
  import type { CharacterGenesis, StorySetup } from '$lib/engine';

  // svelte/transition does not consult prefers-reduced-motion on its own, and a
  // stalled fly would leave the pane at opacity 0 — so honour it explicitly.
  const reduced = browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STEPS = ['Ère', 'Personnage', 'Trame', 'Style', 'Genèse'];
  const LAST = STEPS.length - 1;

  let step = 0;
  // Furthest step reached: going back to tweak the era should not cost four
  // clicks to return, so the header stays navigable up to here.
  let maxStep = 0;
  let direction = 1;
  let creating = false;
  let genesis: CharacterGenesis | null = null;

  let era = ERAS[0].id;
  let faction = FACTIONS[0].id;
  let role = defaultRoleForFaction(FACTIONS[0].id);
  let trameId = TRAMES[0].id;
  let premise = TRAMES[0].premise;
  let preset: NarrativePreset = NARRATIVE_PRESETS[0];
  let contentMode = NARRATIVE_PRESETS[0].contentMode;
  let firstName = '';
  let lastName = '';
  let avatar = AVATARS[0];

  onMount(() => {
    const defaultMode = get(preferences).contentMode;
    if (!defaultMode) return;
    contentMode = defaultMode;
    const match = NARRATIVE_PRESETS.find((p) => p.contentMode === defaultMode);
    if (match) preset = match;
  });

  $: backdrop = eraBackdrop(era);
  $: trameLabel = TRAMES.find((t) => t.id === trameId)?.name ?? null;
  $: draftSetup = withSetupDefaults(
    {
      era, faction, role, premise: premise.trim(),
      protagonistFirstName: firstName.trim(), protagonistLastName: lastName.trim(), protagonistAvatar: avatar,
      writingStyle: preset.writingStyle, writingTone: preset.writingTone,
      writingPov: preset.writingPov, writingLength: preset.writingLength, contentMode
    },
    trameId
  ) as StorySetup;

  $: canNext = step === 0 ? !!era : step === 1 ? !!faction && !!role : step === 2 ? !!premise.trim() : true;

  function go(next: number): void {
    if (next === step || next < 0 || next > LAST) return;
    direction = next > step ? 1 : -1;
    step = next;
    if (step > maxStep) maxStep = step;
  }

  async function launch(): Promise<void> {
    if (creating) return;
    creating = true;
    try {
      // The validated genesis travels with the setup: the engine seeds the
      // world from it and turn 1 stages the character instead of inventing one.
      const story = await createStory({ ...draftSetup, genesis: genesis ?? undefined });
      await goto(`/play/${story.id}`);
    } catch (error) {
      creating = false;
      toasts.show(error instanceof Error ? error.message : 'Création impossible.', 'error');
    }
  }
</script>

<svelte:head><title>Nouvelle aventure — Star Wars Story</title></svelte:head>

<div class="wizard">
  <SceneBackdrop {backdrop} variant="hero" />

  <div class="panel">
    <header class="head">
      <button type="button" class="link" on:click={() => goto('/')}>← Quitter</button>
      <ol class="steps">
        {#each STEPS as label, i}
          <li class:active={i === step} class:done={i !== step && i <= maxStep}>
            <button type="button" disabled={i > maxStep} on:click={() => go(i)}>{label}</button>
          </li>
        {/each}
      </ol>
    </header>

    <div class="body">
      {#key step}
        <div class="pane" in:fly={{ x: reduced ? 0 : 22 * direction, duration: reduced ? 0 : 280, opacity: 0 }}>
          {#if step === 0}
            <StepEra bind:era />
          {:else if step === 1}
            <StepCharacter {era} bind:faction bind:role bind:firstName bind:lastName bind:avatar />
          {:else if step === 2}
            <StepTrame bind:trameId bind:premise />
          {:else if step === 3}
            <StepStyle bind:preset bind:contentMode />
          {:else}
            <SetupRecap {era} {faction} {role} {trameLabel} presetName={preset.name} {avatar} {firstName} {lastName} />
            <GenesisStep bind:genesis setup={draftSetup} {trameLabel} />
          {/if}
        </div>
      {/key}
    </div>

    <footer class="foot">
      {#if step > 0}<button type="button" class="btn btn-ghost" on:click={() => go(step - 1)}>Retour</button>{/if}
      <span class="spacer"></span>
      {#if step < LAST}
        <button type="button" class="btn btn-primary" disabled={!canNext} on:click={() => go(step + 1)}>Suivant</button>
      {:else}
        <button type="button" class="btn btn-primary" disabled={creating} on:click={launch}>
          {creating ? 'Lancement…' : "Commencer l'aventure"}
        </button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .wizard { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-lg); }
  .panel {
    position: relative; z-index: 2;
    width: min(940px, 100%); max-height: calc(100vh - 2 * var(--space-lg));
    display: flex; flex-direction: column;
    background: var(--surface-glass-strong); backdrop-filter: blur(16px);
    border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .head {
    display: flex; align-items: center; gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }
  .link { color: var(--color-text-muted); font-size: 0.82rem; cursor: pointer; background: none; border: none; }
  .link:hover { color: var(--color-text-primary); }

  .steps { display: flex; gap: var(--space-md); margin-left: auto; list-style: none; }
  .steps button {
    background: none; border: none; padding: 0; cursor: pointer;
    font-size: 0.74rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-text-muted); transition: color var(--transition-fast);
  }
  .steps button:disabled { cursor: default; }
  .steps li.done button { color: var(--color-text-secondary); }
  .steps li.done button:hover { color: var(--color-gold); }
  .steps li.active button { color: var(--color-gold); }
  .steps li.active { position: relative; }
  .steps li.active::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: -5px;
    height: 1px; background: var(--color-gold);
    animation: grow 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .body { flex: 1; overflow-y: auto; padding: var(--space-xl) var(--space-lg); }
  .pane { display: block; }

  .foot {
    display: flex; align-items: center; gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--color-border);
  }
  .spacer { flex: 1; }

  @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  @media (max-width: 768px) {
    .wizard { padding: 0; align-items: stretch; }
    .panel { width: 100%; max-height: none; min-height: 100vh; border: none; border-radius: 0; }
    .head { padding: calc(var(--space-md) + var(--sat)) var(--space-md) var(--space-md); flex-wrap: wrap; gap: var(--space-sm); }
    .steps { gap: var(--space-sm); margin-left: 0; width: 100%; justify-content: space-between; }
    .steps button { font-size: 0.66rem; letter-spacing: 0.04em; }
    .body { padding: var(--space-lg) var(--space-md); }
    .foot { padding: var(--space-md) var(--space-md) calc(var(--space-md) + var(--sab)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .steps li.active::after { animation: none; }
  }
</style>
