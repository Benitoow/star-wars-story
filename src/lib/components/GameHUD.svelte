<script lang="ts">
  import type { WorldState } from '$lib/ai/storyEngine';

  export let worldState: WorldState;
  export let collapsed = false;

  $: p = worldState.player;
  $: hpColor = p.hp >= 70 ? '#4ade80' : p.hp >= 35 ? '#facc15' : '#f87171';
  $: hpPct = Math.max(0, Math.min(100, p.hp));
  $: activeInjuries = p.injuries.filter(i => i.severity !== 'light');
  $: aliveNpcs = worldState.npcs.filter(n => n.alive !== false).slice(0, 4);
  $: topFactions = Object.entries(worldState.factions)
    .filter(([, v]) => Math.abs(v) >= 10)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 3);

  const FACTION_LABELS: Record<string, string> = {
    empire: 'Empire', rebel_alliance: 'Alliance', jedi_order: 'Jedi',
    sith: 'Sith', hutt: 'Hutt', mandalore: 'Mandalore',
    first_order: 'P.Ordre', republic: 'République'
  };

  function factionLabel(id: string): string {
    return FACTION_LABELS[id] ?? id;
  }

  function severityIcon(sev: string): string {
    return sev === 'severe' ? '🔴' : sev === 'moderate' ? '🟡' : '⚪';
  }
</script>

<aside class="hud" class:collapsed>
  <button class="hud-toggle" on:click={() => collapsed = !collapsed} title={collapsed ? 'Afficher le HUD' : 'Réduire'}>
    {#if collapsed}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      <span class="hud-toggle-label">État</span>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    {/if}
  </button>

  {#if !collapsed}
    <div class="hud-body">

      <!-- HP -->
      <div class="hud-row hud-hp">
        <span class="hud-icon">❤️</span>
        <div class="hp-track">
          <div class="hp-fill" style="width:{hpPct}%; background:{hpColor}"></div>
        </div>
        <span class="hud-val" style="color:{hpColor}">{p.hp}</span>
      </div>

      <!-- Credits -->
      <div class="hud-row">
        <span class="hud-icon">₡</span>
        <span class="hud-val">{p.credits.toLocaleString('fr-FR')}</span>
      </div>

      <!-- Location + date -->
      <div class="hud-row hud-location">
        <span class="hud-icon">📍</span>
        <span class="hud-text" title={p.location}>{p.location}</span>
      </div>
      {#if p.date}
        <div class="hud-row hud-date">
          <span class="hud-icon">🕐</span>
          <span class="hud-text dim">{p.date}</span>
        </div>
      {/if}

      <!-- Injuries -->
      {#if p.injuries.length}
        <div class="hud-section-label">Blessures</div>
        {#each p.injuries as inj}
          <div class="hud-row hud-injury">
            <span class="hud-icon">{severityIcon(inj.severity)}</span>
            <span class="hud-text" title={inj.description}>{inj.description}</span>
          </div>
        {/each}
      {/if}

      <!-- NPCs -->
      {#if aliveNpcs.length}
        <div class="hud-section-label">Relations</div>
        {#each aliveNpcs as npc}
          {@const aff = npc.affinity}
          <div class="hud-row hud-npc">
            <span class="npc-dot" style="background:{aff > 30 ? '#4ade80' : aff < -30 ? '#f87171' : '#94a3b8'}"></span>
            <span class="hud-text" title={npc.note ?? ''}>{npc.name}</span>
            <span class="npc-score" style="color:{aff > 30 ? '#4ade80' : aff < -30 ? '#f87171' : '#94a3b8'}">{aff > 0 ? '+' : ''}{aff}</span>
          </div>
        {/each}
      {/if}

      <!-- Factions -->
      {#if topFactions.length}
        <div class="hud-section-label">Factions</div>
        {#each topFactions as [id, score]}
          <div class="hud-row hud-faction">
            <div class="faction-bar-track">
              <div
                class="faction-bar-fill"
                style="
                  width:{Math.abs(score)}%;
                  margin-left:{score < 0 ? (100 - Math.abs(score)) + '%' : '0'};
                  background:{score > 0 ? '#4ade80' : '#f87171'}
                "
              ></div>
            </div>
            <span class="faction-label">{factionLabel(id)}</span>
            <span class="faction-score" style="color:{score > 0 ? '#4ade80' : '#f87171'}">{score > 0 ? '+' : ''}{score}</span>
          </div>
        {/each}
      {/if}

    </div>
  {/if}
</aside>

<style>
  .hud {
    position: fixed;
    top: 72px;
    right: 12px;
    width: 200px;
    background: rgba(12, 12, 16, 0.88);
    border: 1px solid rgba(255, 232, 31, 0.18);
    border-radius: 10px;
    backdrop-filter: blur(10px);
    z-index: 150;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    transition: width 0.2s ease;
    overflow: hidden;
  }

  .hud.collapsed {
    width: auto;
  }

  .hud-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    border-bottom: 1px solid rgba(255, 232, 31, 0.1);
    color: var(--color-gold, #ffe81f);
    cursor: pointer;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    justify-content: flex-end;
  }

  .hud-toggle:hover { background: rgba(255,232,31,0.05); }
  .hud-toggle-label { font-weight: 600; }

  .hud-body {
    padding: 8px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hud-section-label {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,232,31,0.5);
    margin-top: 8px;
    margin-bottom: 2px;
  }

  .hud-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 18px;
  }

  .hud-icon {
    font-size: 0.7rem;
    flex-shrink: 0;
    width: 14px;
    text-align: center;
  }

  .hud-val {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
  }

  .hud-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.72rem;
  }

  .hud-text.dim { color: rgba(255,255,255,0.35); font-size: 0.68rem; }

  /* HP */
  .hud-hp .hp-track {
    flex: 1;
    height: 5px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .hp-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease, background 0.4s ease;
  }

  /* NPCs */
  .npc-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .npc-score {
    font-size: 0.68rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Factions */
  .hud-faction {
    gap: 4px;
  }

  .faction-bar-track {
    width: 50px;
    height: 4px;
    background: rgba(255,255,255,0.08);
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
  }

  .faction-bar-fill {
    position: absolute;
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
    max-width: 100%;
  }

  .faction-label {
    flex: 1;
    font-size: 0.68rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .faction-score {
    font-size: 0.65rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Injury */
  .hud-injury .hud-text {
    color: #fca5a5;
  }

  @media (max-width: 768px) {
    .hud {
      top: auto;
      bottom: 80px;
      right: 8px;
      width: 180px;
    }
  }
</style>
