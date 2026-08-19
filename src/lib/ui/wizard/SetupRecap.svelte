<script lang="ts">
  /* Six decisions were made across four screens and never shown together.
     This is the last look before the character is written. */
  import { ERAS, FACTIONS, ROLES } from '$lib/content/catalog';
  import { eraFit } from '$lib/content/lore';
  import Emblem from '../Emblem.svelte';

  export let era: string;
  export let faction: string;
  export let role: string;
  export let trameLabel: string | null = null;
  export let presetName = '';
  export let avatar = '';
  export let firstName = '';
  export let lastName = '';

  $: eraItem = ERAS.find((e) => e.id === era);
  $: factionItem = FACTIONS.find((f) => f.id === faction);
  $: roleItem = ROLES.find((r) => r.id === role);
  $: tint = factionItem?.color ?? 'var(--color-gold)';
  $: name = [firstName, lastName].filter(Boolean).join(' ').trim();
  $: verdict = eraFit(era, faction);
</script>

<div class="recap" style="--tint: {tint}">
  <span class="avatar">{avatar}</span>
  <div class="body">
    <p class="name">{name || 'Protagoniste sans nom'}</p>
    <p class="line">
      <Emblem icon={roleItem?.icon} tint={tint} size="14px" />
      <span>{roleItem?.name ?? role}</span>
      <span class="sep">·</span>
      <Emblem icon={factionItem?.icon} tint={tint} size="14px" />
      <span>{factionItem?.name ?? faction}</span>
    </p>
    <p class="line muted">
      <Emblem icon={eraItem?.icon} tint="var(--color-text-muted)" size="14px" />
      <span>{eraItem?.name ?? era}</span>
      {#if trameLabel}<span class="sep">·</span><span>{trameLabel}</span>{/if}
      {#if presetName}<span class="sep">·</span><span>{presetName}</span>{/if}
    </p>
    {#if verdict.fit === 'absent'}
      <p class="warn">⚠ {verdict.reason}</p>
    {/if}
  </div>
</div>

<style>
  .recap {
    display: flex; align-items: center; gap: var(--space-md);
    padding: var(--space-md);
    margin-bottom: var(--space-lg);
    border: 1px solid var(--color-border);
    border-left: 2px solid var(--tint);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.03);
  }
  .avatar {
    flex: 0 0 auto;
    width: 46px; height: 46px;
    display: grid; place-items: center;
    border: 1px solid var(--color-border); border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    font-size: 1.4rem;
  }
  .body { min-width: 0; }
  .name { font-family: var(--font-display); font-size: 1rem; color: var(--color-text-primary); }
  .line {
    display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
    margin-top: 3px; font-size: 0.78rem; color: var(--color-text-secondary);
  }
  .line.muted { color: var(--color-text-muted); font-size: 0.74rem; }
  .sep { opacity: 0.5; }
  .warn { margin-top: 5px; font-size: 0.74rem; color: var(--color-red); }
</style>
