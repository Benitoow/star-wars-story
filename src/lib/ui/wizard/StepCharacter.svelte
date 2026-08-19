<script lang="ts">
  /* Faction, role and identity — with the mechanical consequence shown live,
     and era coherence surfaced instead of left for the engine to fight later. */
  import { FACTIONS, ROLES, AVATARS, defaultRoleForFaction } from '$lib/content/catalog';
  import { FACTION_DESC, ROLE_DESC, eraFit } from '$lib/content/lore';
  import Emblem from './Emblem.svelte';
  import SkillProfile from './SkillProfile.svelte';

  export let era: string;
  export let faction: string;
  export let role: string;
  export let firstName: string;
  export let lastName: string;
  export let avatar: string;

  $: factionColor = FACTIONS.find((f) => f.id === faction)?.color ?? 'var(--color-gold)';
  $: roleOptions = ROLES.filter((r) => r.faction === faction || r.faction === 'neutral');
  $: verdict = eraFit(era, faction);

  function pickFaction(id: string): void {
    faction = id;
    // Recompute here: the reactive `roleOptions` still holds the previous
    // faction inside this handler, so a faction-specific role would slip through.
    const next = ROLES.filter((r) => r.faction === id || r.faction === 'neutral');
    if (!next.some((r) => r.id === role)) role = defaultRoleForFaction(id);
  }
</script>

<h1>Qui es-tu ?</h1>

<div class="split">
  <div class="choices">
    <p class="eyebrow">Faction</p>
    <div class="grid">
      {#each FACTIONS as f, i}
        {@const fit = eraFit(era, f.id)}
        <button
          type="button"
          class="tile faction"
          class:selected={faction === f.id}
          class:dim={fit.fit === 'absent'}
          style="--tint: {f.color}; --stagger: {i * 30}ms"
          aria-pressed={faction === f.id}
          title={fit.reason}
          on:click={() => pickFaction(f.id)}
        >
          <Emblem icon={f.icon} tint={f.color} size="26px" />
          <span class="name">{f.name}</span>
          {#if fit.fit !== 'canon'}<span class="flag" class:absent={fit.fit === 'absent'}></span>{/if}
        </button>
      {/each}
    </div>

    {#key faction}
      <p class="desc">{FACTION_DESC[faction] ?? ''}</p>
    {/key}
    {#if verdict.fit !== 'canon'}
      <p class="warn" class:hard={verdict.fit === 'absent'}>
        {verdict.fit === 'absent' ? '⚠ Anachronisme' : '◇ Inhabituel'} — {verdict.reason}
      </p>
    {/if}

    <p class="eyebrow mt">Rôle</p>
    <div class="roles">
      {#each roleOptions as r}
        <button
          type="button"
          class="role"
          class:selected={role === r.id}
          style="--tint: {factionColor}"
          aria-pressed={role === r.id}
          on:click={() => (role = r.id)}
        >
          <Emblem icon={r.icon} tint={factionColor} size="22px" />
          <span class="role-text">
            <span class="name">{r.name}</span>
            <span class="sub">{ROLE_DESC[r.id] ?? ''}</span>
          </span>
        </button>
      {/each}
    </div>
  </div>

  <aside class="side">
    <p class="eyebrow">Identité</p>
    <div class="identity">
      <div class="avatars">
        {#each AVATARS as a, i}
          <button
            type="button"
            class="avatar"
            class:selected={avatar === a}
            aria-label="Avatar {i + 1}"
            aria-pressed={avatar === a}
            on:click={() => (avatar = a)}
          >{a}</button>
        {/each}
      </div>
      <input class="input" bind:value={firstName} placeholder="Prénom (optionnel)" maxlength="40" />
      <input class="input" bind:value={lastName} placeholder="Nom (optionnel)" maxlength="40" />
    </div>

    <SkillProfile {role} {faction} />
  </aside>
</div>

<style>
  .split { display: grid; grid-template-columns: 1fr 280px; gap: var(--space-lg); align-items: start; }
  .choices { min-width: 0; }
  .side { display: flex; flex-direction: column; gap: var(--space-md); }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 6px; }
  .tile {
    position: relative;
    display: flex; align-items: center; gap: var(--space-sm);
    padding: 10px var(--space-sm);
    border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02);
    color: var(--color-text-secondary);
    font-size: 0.82rem; text-align: left; cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
    animation: rise 360ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--stagger);
  }
  .tile:hover { border-color: var(--color-border-hover); transform: translateY(-1px); }
  .tile:hover :global(.emblem) { opacity: 1; }
  .tile.selected {
    border-color: var(--tint);
    background: color-mix(in srgb, var(--tint) 12%, transparent);
    color: var(--color-text-primary);
  }
  .tile.selected :global(.emblem) { opacity: 1; filter: drop-shadow(0 0 8px var(--tint)); }
  .tile.dim { opacity: 0.42; }
  .tile.dim:hover { opacity: 0.7; }

  .flag {
    position: absolute; top: 5px; right: 5px;
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--color-gold);
  }
  .flag.absent { background: var(--color-red); }

  .desc {
    margin-top: var(--space-sm);
    font-family: var(--font-narrative); font-size: 0.82rem; font-style: italic;
    color: var(--color-text-muted); animation: fade 320ms ease both;
  }
  .warn {
    margin-top: 6px; padding: 7px var(--space-sm);
    border-left: 2px solid var(--color-gold); border-radius: var(--radius-sm);
    background: rgba(216, 185, 119, 0.07);
    font-size: 0.76rem; line-height: 1.45; color: var(--color-text-secondary);
  }
  .warn.hard { border-left-color: var(--color-red); background: rgba(215, 107, 107, 0.07); }

  .roles { display: flex; flex-direction: column; gap: 5px; max-height: 260px; overflow-y: auto; padding-right: 4px; }
  .role {
    display: flex; align-items: center; gap: var(--space-sm);
    padding: 9px var(--space-sm);
    border: 1px solid transparent; border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02);
    color: var(--color-text-secondary); text-align: left; cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .role:hover { border-color: var(--color-border); }
  .role.selected { border-color: var(--tint); background: color-mix(in srgb, var(--tint) 10%, transparent); }
  .role.selected :global(.emblem) { opacity: 1; }
  .role-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .name { font-size: 0.85rem; color: var(--color-text-primary); }
  .sub { font-size: 0.73rem; line-height: 1.35; color: var(--color-text-muted); }

  .identity { display: flex; flex-direction: column; gap: var(--space-sm); }
  .avatars { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
  .avatar {
    aspect-ratio: 1; display: grid; place-items: center;
    border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02); font-size: 1rem; cursor: pointer;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .avatar:hover { transform: scale(1.08); }
  .avatar.selected { border-color: var(--color-gold); background: rgba(216, 185, 119, 0.12); }

  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  @media (max-width: 860px) {
    .split { grid-template-columns: 1fr; }
    .roles { max-height: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tile, .desc { animation: none; }
    .tile:hover, .avatar:hover { transform: none; }
  }
</style>
