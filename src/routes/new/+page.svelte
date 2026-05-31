<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { preferences } from '$lib/stores/preferences';
  import {
    ERAS, FACTIONS, ROLES, TRAMES, AVATARS, NARRATIVE_PRESETS, CONTENT_MODES,
    eraBackdrop, defaultRoleForFaction, withSetupDefaults, type NarrativePreset
  } from '$lib/content/catalog';
  import { createStory } from '$lib/persistence';
  import { toasts } from '$lib/stores/ui';
  import SceneBackdrop from '$lib/ui/SceneBackdrop.svelte';

  const STEPS = ['Ère', 'Personnage', 'Trame', 'Style'];
  let step = 0;
  let creating = false;

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
    if (defaultMode) {
      contentMode = defaultMode;
      // Optionnel : s'il y a un preset qui matche exactement, on le sélectionne
      const matchingPreset = NARRATIVE_PRESETS.find(p => p.contentMode === defaultMode);
      if (matchingPreset) preset = matchingPreset;
    }
  });

  $: roleOptions = ROLES.filter((r) => r.faction === faction || r.faction === 'neutral');
  $: backdrop = eraBackdrop(era);

  function pickFaction(id: string) {
    faction = id;
    // Recompute here: the reactive `roleOptions` still reflects the previous
    // faction inside this handler, so a faction-specific role would wrongly pass.
    const nextOptions = ROLES.filter((r) => r.faction === id || r.faction === 'neutral');
    if (!nextOptions.some((r) => r.id === role)) role = defaultRoleForFaction(id);
  }
  function pickTrame(id: string) {
    trameId = id;
    const t = TRAMES.find((tr) => tr.id === id);
    if (t && t.id !== 'custom') premise = t.premise;
  }

  const canNext = () => (step === 0 ? !!era : step === 1 ? !!faction && !!role : step === 2 ? !!premise.trim() : true);

  async function launch() {
    if (creating) return;
    creating = true;
    try {
      const setup = withSetupDefaults(
        {
          era, faction, role, premise: premise.trim(),
          protagonistFirstName: firstName.trim(), protagonistLastName: lastName.trim(), protagonistAvatar: avatar,
          writingStyle: preset.writingStyle, writingTone: preset.writingTone,
          writingPov: preset.writingPov, writingLength: preset.writingLength, contentMode
        },
        trameId
      );
      const story = await createStory(setup);
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
        {#each STEPS as label, i}<li class:active={i === step} class:done={i < step}>{label}</li>{/each}
      </ol>
    </header>

    <div class="body">
      {#if step === 0}
        <h1>Choisis ton ère</h1>
        <div class="grid">
          {#each ERAS as e}
            <button type="button" class="tile" class:selected={era === e.id} on:click={() => (era = e.id)}>
              <span class="tile-name">{e.name}</span>
              <span class="tile-sub">{e.years}</span>
            </button>
          {/each}
        </div>
      {:else if step === 1}
        <h1>Qui es-tu ?</h1>
        <p class="eyebrow">Faction</p>
        <div class="grid compact">
          {#each FACTIONS as f}
            <button type="button" class="tile" class:selected={faction === f.id} on:click={() => pickFaction(f.id)}>
              <span class="dot" style="background:{f.color}"></span>{f.name}
            </button>
          {/each}
        </div>
        <p class="eyebrow mt">Rôle</p>
        <div class="grid compact">
          {#each roleOptions as r}
            <button type="button" class="tile" class:selected={role === r.id} on:click={() => (role = r.id)}>{r.name}</button>
          {/each}
        </div>
      {:else if step === 2}
        <h1>Quel point de départ ?</h1>
        <div class="grid">
          {#each TRAMES as t}
            <button type="button" class="tile" class:selected={trameId === t.id} on:click={() => pickTrame(t.id)}>
              <span class="tile-icon">{t.icon}</span><span class="tile-name">{t.name}</span>
            </button>
          {/each}
        </div>
        <label class="label mt" for="premise">Prémisse</label>
        <textarea id="premise" class="input premise" bind:value={premise} rows="3" placeholder="Décris le point de départ de ton aventure…"></textarea>
      {:else}
        <h1>Ton style & ton héros</h1>
        <p class="eyebrow">Ambiance narrative</p>
        <div class="grid">
          {#each NARRATIVE_PRESETS as p}
            <button type="button" class="tile" class:selected={preset.id === p.id} on:click={() => { preset = p; contentMode = p.contentMode; }}>
              <span class="tile-icon">{p.icon}</span><span class="tile-name">{p.name}</span>
              <span class="tile-sub">{p.desc}</span>
            </button>
          {/each}
        </div>
        <p class="eyebrow mt">Directive de contenu (Modérateur)</p>
        <div class="grid compact">
          {#each CONTENT_MODES as m}
            <button type="button" class="tile" class:selected={contentMode === m.id} on:click={() => (contentMode = m.id)}>
              <span class="tile-icon">{m.icon}</span><span class="tile-name">{m.name}</span>
              <span class="tile-sub">{m.desc}</span>
            </button>
          {/each}
        </div>
        <div class="profile mt">
          <div class="avatars">
            {#each AVATARS as a}
              <button type="button" class="avatar" class:selected={avatar === a} on:click={() => (avatar = a)}>{a}</button>
            {/each}
          </div>
          <div class="names">
            <input class="input" bind:value={firstName} placeholder="Prénom (optionnel)" maxlength="40" />
            <input class="input" bind:value={lastName} placeholder="Nom (optionnel)" maxlength="40" />
          </div>
        </div>
      {/if}
    </div>

    <footer class="foot">
      {#if step > 0}<button type="button" class="btn btn-ghost" on:click={() => (step -= 1)}>Retour</button>{/if}
      <span class="spacer"></span>
      {#if step < STEPS.length - 1}
        <button type="button" class="btn btn-primary" disabled={!canNext()} on:click={() => (step += 1)}>Suivant</button>
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
    width: min(860px, 100%); max-height: calc(100vh - 2 * var(--space-lg));
    display: flex; flex-direction: column;
    background: var(--surface-glass-strong); backdrop-filter: blur(16px);
    border: 1px solid var(--color-border); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--border-subtle); }
  .link { color: var(--color-text-secondary); background: none; cursor: pointer; font-size: 0.85rem; }
  .link:hover { color: var(--color-text-primary); }
  .steps { display: flex; gap: var(--space-md); list-style: none; font-family: var(--font-display); font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; }
  .steps li { color: var(--color-text-muted); }
  .steps li.active { color: var(--color-gold); }
  .steps li.done { color: var(--color-text-secondary); }

  .body { padding: var(--space-lg); overflow-y: auto; }
  .body h1 { font-size: 1.6rem; margin-bottom: var(--space-lg); }
  .eyebrow.mt, .label.mt, .profile.mt { margin-top: var(--space-lg); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-sm); }
  .grid.compact { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .tile {
    display: flex; flex-direction: column; gap: 4px; text-align: left;
    padding: 12px 14px; background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast);
  }
  .tile:hover { border-color: var(--color-border-hover); color: var(--color-text-primary); }
  .tile.selected { border-color: var(--color-gold); color: var(--color-text-primary); background: rgba(216, 185, 119, 0.08); }
  .tile-name { font-family: var(--font-display); font-size: 0.9rem; }
  .tile-sub { font-size: 0.74rem; color: var(--color-text-muted); }
  .tile-icon { font-size: 1.3rem; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }

  .premise { resize: vertical; font-family: var(--font-body); }
  .profile { display: flex; flex-direction: column; gap: var(--space-md); }
  .avatars { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
  .avatar { font-size: 1.4rem; width: 44px; height: 44px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: none; cursor: pointer; }
  .avatar.selected { border-color: var(--color-gold); background: rgba(216, 185, 119, 0.08); }
  .names { display: flex; gap: var(--space-sm); }

  .foot { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-lg); border-top: 1px solid var(--border-subtle); }
  .spacer { flex: 1; }

  @media (max-width: 600px) { .names { flex-direction: column; } }
</style>
