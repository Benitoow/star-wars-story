<script lang="ts">
  import type { WorldState } from '$lib/ai/storyEngine';

  export let worldState: WorldState;
  export let collapsed = false;
  export let turnNumber = 0;
  export let playerRoleLabel = '';
  export let playerFactionLabel = '';
  export let playerFactionId = '';

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

  const SETUP_TO_WORLD_FACTION: Record<string, string> = {
    jedi: 'jedi_order',
    sith: 'sith',
    empire: 'empire',
    rebels: 'rebel_alliance',
    republic: 'republic',
    hutt: 'hutt',
    mandalore: 'mandalore',
    first_order: 'first_order'
  };

  $: primaryFactionId = SETUP_TO_WORLD_FACTION[playerFactionId] ?? playerFactionId;

  function factionLabel(id: string): string {
    return FACTION_LABELS[id] ?? id;
  }

  function severityIcon(sev: string): string {
    return sev === 'severe' ? '🔴' : sev === 'moderate' ? '🟡' : '⚪';
  }

  function affinityLabel(aff: number): string {
    if (aff >= 70) return 'Loyal';
    if (aff >= 30) return 'Ami';
    if (aff > 0)   return 'Favorable';
    if (aff === 0) return 'Neutre';
    if (aff > -30) return 'Méfiant';
    if (aff > -70) return 'Hostile';
    return 'Ennemi';
  }

  function factionReputationLabel(score: number): string {
    if (score >= 70) return 'Allié fort';
    if (score >= 30) return 'Allié';
    if (score >= 10) return 'Favorable';
    if (score > -10) return 'Neutre';
    if (score > -30) return 'Froid';
    if (score > -70) return 'Hostile';
    return 'Ennemi déclaré';
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

      <!-- Turn number -->
      {#if turnNumber > 0}
        <div class="hud-turn-capsule">Tour {turnNumber}</div>
      {/if}

      <!-- HP -->
      <div class="hud-row hud-hp" class:hp-critical={p.hp < 20}>
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

      {#if playerRoleLabel || playerFactionLabel}
        <div class="hud-section-label">Identité</div>
        {#if playerRoleLabel}
          <div class="hud-row">
            <span class="hud-icon">🎖️</span>
            <span class="hud-text" title="Rôle / grade narratif">Rôle: {playerRoleLabel}</span>
          </div>
        {/if}
        {#if playerFactionLabel}
          <div class="hud-row">
            <span class="hud-icon">🛡️</span>
            <span class="hud-text" title="Camp de départ">Camp: {playerFactionLabel}</span>
          </div>
        {/if}
      {/if}

      <!-- Injuries -->
      {#if p.injuries.length}
        <div class="hud-section-label">Blessures</div>
        {#each p.injuries as inj}
          <div class="hud-row hud-injury" class:hud-injury-severe={inj.severity === 'severe'} class:hud-injury-moderate={inj.severity === 'moderate'} class:hud-injury-light={inj.severity === 'light'}>
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
            <span class="npc-score" style="color:{aff > 30 ? '#4ade80' : aff < -30 ? '#f87171' : '#94a3b8'}">{affinityLabel(aff)}</span>
          </div>
        {/each}
      {/if}

      <!-- Factions -->
      {#if topFactions.length}
        <div class="hud-section-label">Factions</div>
        <div class="hud-help-text">Réputation de -100 (ennemi) à +100 (allié).</div>
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
            {#if primaryFactionId && id === primaryFactionId}
              <span class="faction-self-chip">Ton camp</span>
            {/if}
            <span class="faction-status">{factionReputationLabel(score)}</span>
            <span class="faction-score" style="color:{score > 0 ? '#4ade80' : '#f87171'}">{score > 0 ? '+' : ''}{score}</span>
          </div>
        {/each}
      {/if}

      <!-- Inventory -->
      {#if p.inventory.length}
        <div class="hud-section-label">Inventaire</div>
        {#each p.inventory.slice(0, 4) as item}
          <div class="hud-row">
            <span class="hud-icon">📦</span>
            <span class="hud-text">{item.name}</span>
            {#if item.qty > 1}<span class="hud-qty">×{item.qty}</span>{/if}
          </div>
        {/each}
      {/if}

    </div>
  {/if}
</aside>

<style>
  .hud {
    position: fixed;
    top: 84px;
    right: clamp(10px, 1.3vw, 24px);
    width: var(--hud-width, 228px);
    max-height: calc(100vh - 108px);
    background: rgba(12, 12, 16, 0.88);
    border: 1px solid rgba(255, 232, 31, 0.18);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    z-index: 150;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    transition: width 0.2s ease, transform 0.2s ease;
    overflow: hidden;
  }

  .hud.collapsed {
    width: auto;
    max-height: none;
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

  .hud.collapsed .hud-toggle {
    border-bottom: none;
  }

  .hud-body {
    padding: 8px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: calc(100vh - 158px);
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .hud-section-label {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,232,31,0.5);
    margin-top: 8px;
    margin-bottom: 2px;
  }

  .hud-help-text {
    font-size: 0.62rem;
    color: rgba(255,255,255,0.45);
    margin-bottom: 2px;
    line-height: 1.35;
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

  .faction-self-chip {
    font-size: 0.58rem;
    letter-spacing: 0.03em;
    color: #0b0b0f;
    background: #4ade80;
    border-radius: 999px;
    padding: 1px 5px;
    flex-shrink: 0;
  }

  .faction-status {
    font-size: 0.6rem;
    color: rgba(255,255,255,0.6);
    flex-shrink: 0;
  }

  .faction-score {
    font-size: 0.65rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Turn capsule */
  .hud-turn-capsule {
    display: inline-block;
    align-self: flex-start;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-gold, #ffe81f);
    background: rgba(255, 232, 31, 0.1);
    border: 1px solid rgba(255, 232, 31, 0.25);
    border-radius: 20px;
    padding: 1px 8px;
    margin-bottom: 2px;
  }

  /* HP critical */
  .hud-hp.hp-critical .hp-fill {
    animation: pulseCritical 1.2s ease-in-out infinite;
  }

  @keyframes pulseCritical {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Injury severity */
  .hud-injury .hud-text {
    color: #fca5a5;
  }

  .hud-injury-severe .hud-text {
    color: #f87171;
    font-weight: 600;
  }

  .hud-injury-moderate .hud-text {
    color: #fbbf24;
  }

  .hud-injury-light .hud-text {
    color: #94a3b8;
  }

  /* Inventory qty */
  .hud-qty {
    font-size: 0.65rem;
    color: var(--color-gold, #ffe81f);
    flex-shrink: 0;
  }

  @media (max-width: 1159px) {
    .hud {
      width: 208px;
      top: 76px;
      right: 10px;
    }
  }

  @media (max-width: 768px) {
    .hud {
      position: relative;
      top: auto;
      right: auto;
      bottom: auto;
      width: calc(100% - 28px);
      max-height: none;
      margin: 8px 14px 0;
      z-index: 2;
    }

    .hud.collapsed {
      width: auto;
      margin-left: auto;
    }

    .hud-body {
      max-height: 34vh;
    }
  }
</style>
