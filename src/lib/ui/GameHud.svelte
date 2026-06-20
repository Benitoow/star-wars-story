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
    .slice(0, 6);

  function factionName(id: string): string {
    return FACTIONS.find((f) => f.id === id)?.name || id;
  }

  // -100..100 → readable relationship tiers (no raw numbers shown).
  function bond(a: number): { label: string; cls: string } {
    if (a >= 70) return { label: 'Loyal', cls: 'good' };
    if (a >= 35) return { label: 'Allié', cls: 'good' };
    if (a >= 10) return { label: 'Amical', cls: 'good' };
    if (a > -10) return { label: 'Neutre', cls: 'neutral' };
    if (a > -35) return { label: 'Méfiant', cls: 'bad' };
    if (a > -70) return { label: 'Hostile', cls: 'bad' };
    return { label: 'Ennemi juré', cls: 'bad' };
  }
  function standing(r: number): { label: string; cls: string } {
    if (r >= 70) return { label: 'Vénéré', cls: 'good' };
    if (r >= 35) return { label: 'Allié', cls: 'good' };
    if (r >= 10) return { label: 'Apprécié', cls: 'good' };
    if (r > -10) return { label: 'Neutre', cls: 'neutral' };
    if (r > -35) return { label: 'Suspect', cls: 'bad' };
    if (r > -70) return { label: 'Hostile', cls: 'bad' };
    return { label: 'Recherché', cls: 'bad' };
  }
  const warmth = (v: number) => Math.max(3, Math.min(100, (v + 100) / 2)); // bar fill %

  const sev: Record<string, string> = { light: 'Légère', moderate: 'Modérée', severe: 'Grave' };
</script>

<aside class="hud" class:critical={p.condition === 'critical'}>
  <div class="hud-top">
    <div class="hp">
      <div class="hp-bar"><div class="hp-fill" style="width:{hpPct}%; background:{hpColor}"></div></div>
      <span class="hp-label">{p.hp}<span class="muted">/100</span></span>
    </div>
    <div class="stat"><span class="stat-key">₡</span>{p.credits.toLocaleString('fr-FR')}</div>
    <button type="button" class="hud-toggle" on:click={() => (expanded = !expanded)} aria-expanded={expanded}>
      {expanded ? 'Fermer' : 'État'}
    </button>
  </div>

  <div class="hud-place">
    <span class="loc">{p.location}</span>
    <span class="muted date">{p.date}</span>
  </div>

  {#if expanded}
    <div class="hud-detail">
      {#if livingNpcs.length}
        <section>
          <h4 class="eyebrow">Personnages <span class="count">{livingNpcs.length}</span></h4>
          <ul class="rows">
            {#each livingNpcs as npc}
              {@const b = bond(npc.affinity)}
              <li class="npc">
                <span class="badge {b.cls}">{npc.name.charAt(0).toUpperCase()}</span>
                <div class="body">
                  <span class="name">{npc.name}</span>
                  {#if npc.note}<span class="note">{npc.note}</span>{/if}
                </div>
                <div class="rel">
                  <span class="tier {b.cls}">{b.label}</span>
                  <div class="warmth"><span class="warmth-fill {b.cls}" style="width:{warmth(npc.affinity)}%"></span></div>
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if topFactions.length}
        <section>
          <h4 class="eyebrow">Réputation</h4>
          <ul class="rows">
            {#each topFactions as [id, score]}
              {@const st = standing(score)}
              <li class="faction">
                <span class="name">{factionName(id)}</span>
                <div class="warmth"><span class="warmth-fill {st.cls}" style="width:{warmth(score)}%"></span></div>
                <span class="tier {st.cls}">{st.label}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if p.injuries.length}
        <section>
          <h4 class="eyebrow">Blessures</h4>
          <div class="chips">
            {#each p.injuries as inj}<span class="chip injury {inj.severity}">{inj.description}<span class="chip-sub">{sev[inj.severity] ?? inj.severity}</span></span>{/each}
          </div>
        </section>
      {/if}

      {#if p.inventory.length}
        <section>
          <h4 class="eyebrow">Inventaire</h4>
          <div class="chips">
            {#each p.inventory as item}<span class="chip">{item.name}{item.qty > 1 ? ` ×${item.qty}` : ''}</span>{/each}
          </div>
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
    font-family: var(--font-display); font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--color-text-secondary); background: none;
    border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 5px 11px; cursor: pointer;
  }
  .hud-toggle:hover { color: var(--color-text-primary); border-color: var(--color-border-hover); }

  .hud-place { margin-top: var(--space-sm); display: flex; flex-direction: column; gap: 2px; }
  .loc { color: var(--color-text-primary); }
  .date { font-size: 0.75rem; }

  .hud-detail {
    margin-top: var(--space-md); padding-top: var(--space-md);
    border-top: 1px solid var(--border-subtle);
    display: grid; gap: var(--space-lg);
    max-height: 52vh; overflow-y: auto;
    animation: slideDown var(--transition-normal) ease;
  }
  section h4 { display: flex; align-items: center; gap: 6px; margin-bottom: var(--space-sm); }
  .count { font-family: var(--font-body); font-size: 0.62rem; letter-spacing: normal; color: var(--color-text-muted); background: rgba(255,255,255,0.06); border-radius: 99px; padding: 0 6px; }

  .rows { list-style: none; display: flex; flex-direction: column; gap: var(--space-sm); }
  .name { color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* NPC relation row */
  .npc { display: grid; grid-template-columns: 30px 1fr 90px; align-items: center; gap: var(--space-sm); }
  .badge {
    width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 0.8rem; color: var(--color-text-primary);
    background: rgba(255,255,255,0.06); border: 1px solid var(--color-border);
  }
  .badge.good { border-color: rgba(143,206,154,0.6); color: var(--color-green); }
  .badge.bad { border-color: rgba(215,107,107,0.6); color: var(--color-red); }
  .body { display: flex; flex-direction: column; min-width: 0; }
  .note { font-size: 0.72rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rel { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

  /* Faction standing row */
  .faction { display: grid; grid-template-columns: 1fr 56px auto; align-items: center; gap: var(--space-sm); }

  /* Tier word — the primary, readable signal */
  .tier { font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); white-space: nowrap; }
  .tier.good { color: var(--color-green); }
  .tier.bad { color: var(--color-red); }

  /* Warmth bar (cold → warm), no numbers */
  .warmth { width: 100%; min-width: 40px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 99px; overflow: hidden; }
  .warmth-fill { display: block; height: 100%; border-radius: 99px; background: var(--color-gold-dim); }
  .warmth-fill.good { background: var(--color-green); }
  .warmth-fill.bad { background: var(--color-red); }

  /* Chips */
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; font-size: 0.76rem; color: var(--color-text-secondary);
    background: rgba(255,255,255,0.04); border: 1px solid var(--color-border); border-radius: 99px;
  }
  .chip-sub { font-size: 0.62rem; color: var(--color-text-muted); }
  .chip.injury.moderate { border-color: rgba(216,185,119,0.4); }
  .chip.injury.severe { border-color: rgba(215,107,107,0.5); color: var(--color-text-primary); }

  @media (max-width: 768px) {
    .hud { padding: var(--space-sm); font-size: 0.8rem; }
    .hud-top { gap: var(--space-sm); }
    .npc { grid-template-columns: 28px 1fr; gap: 6px; }
    .rel { display: none; }
    .faction { grid-template-columns: 1fr auto; }
    .warmth { display: none; }
    .hud-detail { max-height: 60vh; }
    .hud-toggle { padding: 8px 14px; min-height: 44px; }
  }
</style>
