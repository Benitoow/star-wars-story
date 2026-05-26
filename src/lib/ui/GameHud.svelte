<script lang="ts">
  import { FACTIONS } from '$lib/content/catalog';
  import type { NpcRelation, WorldState } from '$lib/engine';

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
  function npcStatus(npc: NpcRelation): { label: string; cls: string } {
    if (npc.status === 'ally' || npc.affinity > 30) return { label: 'Allié', cls: 'ally' };
    if (npc.status === 'hostile' || npc.affinity < -30) return { label: 'Hostile', cls: 'hostile' };
    return { label: 'Neutre', cls: 'neutral' };
  }
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
          <ul class="npcs">
            {#each livingNpcs as npc}
              {@const s = npcStatus(npc)}
              <li class="npc">
                <span class="npc-badge {s.cls}">{npc.name.charAt(0).toUpperCase()}</span>
                <div class="npc-body">
                  <span class="npc-name">{npc.name}</span>
                  {#if npc.note}<span class="npc-note">{npc.note}</span>{/if}
                </div>
                <div class="npc-aff">
                  <span class="status-tag {s.cls}">{s.label}</span>
                  <div class="meter">
                    <span class="meter-center"></span>
                    <span class="meter-fill {npc.affinity >= 0 ? 'pos' : 'neg'}" style="width:{Math.min(50, Math.abs(npc.affinity) / 2)}%"></span>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if topFactions.length}
        <section>
          <h4 class="eyebrow">Réputation</h4>
          <ul class="factions">
            {#each topFactions as [id, score]}
              <li class="faction">
                <span class="faction-name">{factionName(id)}</span>
                <div class="meter">
                  <span class="meter-center"></span>
                  <span class="meter-fill {score >= 0 ? 'pos' : 'neg'}" style="width:{Math.min(50, Math.abs(score) / 2)}%"></span>
                </div>
                <span class="faction-val {score >= 0 ? 'pos' : 'neg'}">{score > 0 ? '+' : ''}{score}</span>
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

  /* NPC relation rows */
  .npcs, .factions { list-style: none; display: flex; flex-direction: column; gap: var(--space-sm); }
  .npc { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: var(--space-sm); }
  .npc-badge {
    width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 0.8rem; color: var(--color-text-primary);
    background: rgba(255,255,255,0.06); border: 1px solid var(--color-border);
  }
  .npc-badge.ally { border-color: rgba(143,206,154,0.6); color: var(--color-green); }
  .npc-badge.hostile { border-color: rgba(215,107,107,0.6); color: var(--color-red); }
  .npc-body { display: flex; flex-direction: column; min-width: 0; }
  .npc-name { color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .npc-note { font-size: 0.72rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .npc-aff { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; width: 84px; }
  .status-tag { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }
  .status-tag.ally { color: var(--color-green); }
  .status-tag.hostile { color: var(--color-red); }

  /* Centered -100..100 meter */
  .meter { position: relative; width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 99px; }
  .meter-center { position: absolute; left: 50%; top: -1px; bottom: -1px; width: 1px; background: rgba(255,255,255,0.25); }
  .meter-fill { position: absolute; top: 0; bottom: 0; border-radius: 99px; }
  .meter-fill.pos { left: 50%; background: var(--color-green); }
  .meter-fill.neg { right: 50%; background: var(--color-red); }

  .faction { display: grid; grid-template-columns: 1fr 70px auto; align-items: center; gap: var(--space-sm); }
  .faction-name { color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .faction-val { font-variant-numeric: tabular-nums; font-size: 0.78rem; width: 34px; text-align: right; }
  .faction-val.pos { color: var(--color-green); }
  .faction-val.neg { color: var(--color-red); }

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
</style>
