<script lang="ts">
  import { FACTIONS } from '$lib/content/catalog';
  import type { WorldState } from '$lib/engine';

  export let world: WorldState;

  let expanded = false;

  $: p = world.player;
  $: hpPct = Math.max(0, Math.min(100, p.hp));
  $: hpColor = hpPct >= 50 ? 'var(--color-green)' : hpPct >= 20 ? 'var(--color-gold)' : 'var(--color-red)';
  $: livingNpcs = world.npcs.filter((n) => n.alive !== false);
  $: topFactions = Object.entries(world.factions)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5);

  function factionName(id: string): string {
    return FACTIONS.find((f) => f.id === id)?.name || id;
  }
</script>

<aside class="hud" class:critical={p.condition === 'critical'}>
  <div class="hud-top">
    <div class="hp">
      <div class="hp-bar"><div class="hp-fill" style="width:{hpPct}%; background:{hpColor}"></div></div>
      <span class="hp-label">{p.hp}<span class="muted">/100</span></span>
    </div>
    <div class="stat"><span class="stat-key">₡</span>{p.credits.toLocaleString('fr-FR')}</div>
    <button type="button" class="hud-toggle" on:click={() => (expanded = !expanded)} aria-expanded={expanded}>
      {expanded ? 'Moins' : 'État'}
    </button>
  </div>

  <div class="hud-place">
    <span class="loc">{p.location}</span>
    <span class="muted date">{p.date}</span>
  </div>

  {#if expanded}
    <div class="hud-detail">
      {#if p.injuries.length}
        <section>
          <h4 class="eyebrow">Blessures</h4>
          <ul>{#each p.injuries as inj}<li>{inj.description} <span class="muted">· {inj.severity}</span></li>{/each}</ul>
        </section>
      {/if}
      {#if p.inventory.length}
        <section>
          <h4 class="eyebrow">Inventaire</h4>
          <ul>{#each p.inventory as item}<li>{item.name}{item.qty > 1 ? ` ×${item.qty}` : ''}</li>{/each}</ul>
        </section>
      {/if}
      {#if livingNpcs.length}
        <section>
          <h4 class="eyebrow">Personnages</h4>
          <ul>
            {#each livingNpcs as npc}
              <li>
                <span class="npc-dot" class:ally={npc.affinity > 30} class:hostile={npc.affinity < -30}></span>
                {npc.name}{npc.note ? ` — ${npc.note}` : ''}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      {#if topFactions.length}
        <section>
          <h4 class="eyebrow">Réputation</h4>
          <ul>{#each topFactions as [id, score]}<li>{factionName(id)} <span class="muted">{score > 0 ? '+' : ''}{score}</span></li>{/each}</ul>
        </section>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .hud {
    background: var(--surface-glass-strong);
    backdrop-filter: blur(14px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    font-size: 0.85rem;
    box-shadow: var(--shadow-md);
  }
  .hud.critical { border-color: rgba(215, 107, 107, 0.6); }

  .hud-top { display: flex; align-items: center; gap: var(--space-md); }
  .hp { display: flex; align-items: center; gap: var(--space-sm); flex: 1; }
  .hp-bar { flex: 1; height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 99px; overflow: hidden; }
  .hp-fill { height: 100%; border-radius: 99px; transition: width var(--transition-normal); }
  .hp-label { font-variant-numeric: tabular-nums; }
  .stat { font-variant-numeric: tabular-nums; }
  .stat-key { color: var(--color-gold); margin-right: 2px; }
  .muted { color: var(--color-text-muted); }

  .hud-toggle {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    cursor: pointer;
  }
  .hud-toggle:hover { color: var(--color-text-primary); border-color: var(--color-border-hover); }

  .hud-place { margin-top: var(--space-sm); display: flex; flex-direction: column; gap: 2px; }
  .loc { color: var(--color-text-primary); }
  .date { font-size: 0.75rem; }

  .hud-detail { margin-top: var(--space-md); display: grid; gap: var(--space-md); border-top: 1px solid var(--border-subtle); padding-top: var(--space-md); }
  .hud-detail section h4 { margin-bottom: 4px; }
  .hud-detail ul { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .hud-detail li { color: var(--color-text-secondary); }

  .npc-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--color-text-muted); margin-right: 4px; }
  .npc-dot.ally { background: var(--color-green); }
  .npc-dot.hostile { background: var(--color-red); }
</style>
