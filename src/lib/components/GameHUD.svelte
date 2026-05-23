<script lang="ts">
  import type { WorldState, NpcRelation } from '$lib/ai/storyEngine';

  export let worldState: WorldState;
  export let collapsed = false;
  export let turnNumber = 0;
  export let playerRoleLabel = '';
  export let playerFactionLabel = '';
  export let playerFactionId = '';
  export let protagonistFirstName = '';
  export let protagonistLastName = '';

  $: p = worldState.player;
  $: downed = p.condition === 'critical' || p.hp <= 0;
  $: hpColor = p.hp >= 70 ? '#4ade80' : p.hp >= 35 ? '#facc15' : '#f87171';
  $: hpPct = Math.max(0, Math.min(100, p.hp));
  $: activeInjuries = p.injuries.filter(i => i.severity !== 'light');
  $: protagonistExclude = new Set(
    [protagonistFirstName, protagonistLastName]
      .filter(Boolean)
      .flatMap(n => [n, ...n.split(' ')].map(s => s.toLowerCase().trim()).filter(s => s.length >= 2))
  );

  $: sortedNpcs = [...worldState.npcs]
    .filter(n => !protagonistExclude.has(n.name.toLowerCase().trim()))
    .sort((a, b) => {
      const aAlive = a.alive !== false;
      const bAlive = b.alive !== false;
      if (aAlive !== bAlive) return aAlive ? -1 : 1;
      return Math.abs(b.affinity) - Math.abs(a.affinity);
    });
  $: topFactions = Object.entries(worldState.factions)
    .filter(([, v]) => Math.abs(v) >= 10)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 3);
  $: activeClocks = Object.entries(worldState.clocks ?? {});
  $: sectorInfluences = Object.entries(worldState.sector_influence ?? {});
  $: activeRumors = worldState.rumors ?? [];
  $: environmentStatus = worldState.environment_status;

  const FACTION_LABELS: Record<string, string> = {
    empire: 'Empire', rebel_alliance: 'Alliance Rebelle', jedi_order: 'Ordre Jedi',
    sith: 'Ordre Sith', hutt: 'Cartel Hutt', mandalore: 'Mandaloriens',
    first_order: 'Premier Ordre', republic: 'République'
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

  const BOND_LABELS: Record<string, string> = {
    master: 'Maître', maître: 'Maître',
    apprentice: 'Padawan', padawan: 'Padawan',
    acolyte: 'Acolyte',
    lover: 'Amant(e)', amant: 'Amant(e)', amante: 'Amant(e)',
    partner: 'Compagnon(ne)', compagnon: 'Compagnon(ne)', compagne: 'Compagnon(ne)',
    mentor: 'Mentor',
    rival: 'Rival(e)',
    traitor: 'Traître', traitre: 'Traître',
    ally: 'Allié(e)', allié: 'Allié(e)',
    enemy: 'Ennemi(e)', ennemi: 'Ennemi(e)',
    sworn_enemy: 'Ennemi juré',
    unknown: 'Inconnu(e)', inconnu: 'Inconnu(e)',
    distant: 'Distant(e)',
    friend: 'Ami(e)', ami: 'Ami(e)',
    guardian: 'Gardien(ne)',
    commander: 'Commandant(e)',
    contact: 'Contact',
    informant: 'Informateur',
    prisoner: 'Prisonnier(ère)',
    captive: 'Captif(ve)',
  };

  const BOND_COLORS: Record<string, string> = {
    master: '#a78bfa', maître: '#a78bfa',
    apprentice: '#a78bfa', padawan: '#a78bfa',
    acolyte: '#a78bfa', mentor: '#a78bfa',
    lover: '#f472b6', amant: '#f472b6', amante: '#f472b6',
    partner: '#f472b6', compagnon: '#f472b6', compagne: '#f472b6',
    rival: '#fbbf24',
    traitor: '#dc2626', traitre: '#dc2626',
    sworn_enemy: '#dc2626',
    enemy: '#f87171', ennemi: '#f87171',
    unknown: '#94a3b8', inconnu: '#94a3b8',
    distant: '#94a3b8',
    ally: '#4ade80', allié: '#4ade80',
    friend: '#86efac', ami: '#86efac',
    guardian: '#60a5fa',
    commander: '#60a5fa',
    contact: '#94a3b8',
    informant: '#fbbf24',
    prisoner: '#fb923c', captive: '#fb923c',
  };

  function npcLabel(npc: NpcRelation): string {
    if (npc.bond_type) {
      const key = npc.bond_type.toLowerCase().trim();
      if (BOND_LABELS[key]) return BOND_LABELS[key];
    }
    const aff = npc.affinity;
    if (aff >= 90) return 'Dévoué';
    if (aff >= 70) return 'Loyal';
    if (aff >= 50) return 'Ami proche';
    if (aff >= 30) return 'Ami';
    if (aff >= 10) return 'Favorable';
    if (aff > -10) return 'Neutre';
    if (aff > -30) return 'Distant';
    if (aff > -50) return 'Méfiant';
    if (aff > -70) return 'Hostile';
    if (aff > -90) return 'Ennemi';
    return 'Ennemi juré';
  }

  function npcColor(npc: NpcRelation): string {
    if (npc.bond_type) {
      const key = npc.bond_type.toLowerCase().trim();
      if (BOND_COLORS[key]) return BOND_COLORS[key];
    }
    const aff = npc.affinity;
    if (aff >= 70) return '#4ade80';
    if (aff >= 30) return '#86efac';
    if (aff >= 10) return '#a3e4a3';
    if (aff > -10) return '#94a3b8';
    if (aff > -50) return '#fb923c';
    if (aff > -70) return '#f87171';
    return '#dc2626';
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

      <!-- Downed / critical condition -->
      {#if downed}
        <div class="hud-downed" role="status">
          <span class="hud-downed-icon">☠️</span>
          <span class="hud-downed-text">Hors-combat — survie</span>
        </div>
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

      {#if environmentStatus}
        <div class="hud-row hud-environment">
          <span class="hud-icon">⛈️</span>
          <span class="hud-text" title={environmentStatus}>{environmentStatus}</span>
        </div>
      {/if}

      <!-- Rumors -->
      {#if activeRumors.length > 0}
        <div class="hud-section-label">Rumeurs</div>
        {#each activeRumors as rumor}
          <div class="hud-row hud-rumor">
            <span class="hud-icon">🗣️</span>
            <span class="hud-text dim" title={rumor}>{rumor}</span>
          </div>
        {/each}
      {/if}

      <!-- Clocks -->
      {#if activeClocks.length > 0}
        <div class="hud-section-label">Tensions</div>
        {#each activeClocks as [id, c]}
          <div class="hud-row hud-clock">
            <span class="hud-icon">⏱️</span>
            <span class="hud-text" title={id}>{id}</span>
            <div class="clock-track">
               {#each Array.from({ length: c.max }) as _, i}
                 <div class="clock-tick" class:filled={i < c.current}></div>
               {/each}
            </div>
          </div>
        {/each}
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
      {#if sortedNpcs.length}
        <div class="hud-section-label">Relations</div>
        {#each sortedNpcs as npc}
          {@const alive = npc.alive !== false}
          {@const color = alive ? npcColor(npc) : '#4b5563'}
          <div class="hud-row hud-npc" class:npc-dead={!alive}>
            <span class="npc-dot" style="background:{color}"></span>
            <span class="hud-text" title={npc.note ?? ''}>{npc.name}</span>
            <span class="npc-score" style="color:{color}">{npcLabel(npc)}{#if !alive} †{/if}</span>
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

      <!-- Sector Influence -->
      {#if sectorInfluences.length > 0}
        <div class="hud-section-label">Influence Secteur</div>
        {#each sectorInfluences as [id, pct]}
          <div class="hud-row hud-faction">
            <div class="faction-bar-track">
              <div class="faction-bar-fill" style="width:{pct}%; background:#3b82f6"></div>
            </div>
            <span class="faction-label">{factionLabel(id)}</span>
            <span class="faction-score" style="color:#60a5fa">{pct}%</span>
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
    background: rgba(9, 10, 14, 0.92);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.09));
    border-radius: 12px;
    backdrop-filter: blur(14px);
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

  .npc-dead {
    opacity: 0.38;
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

  /* Clocks */
  .clock-track {
    display: flex;
    gap: 3px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .clock-tick {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(255, 232, 31, 0.4);
    background: transparent;
  }

  .clock-tick.filled {
    background: #f87171;
    border-color: #f87171;
    box-shadow: 0 0 5px rgba(248, 113, 113, 0.5);
  }

  /* Downed / critical banner */
  .hud-downed {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 8px;
    background: rgba(248, 113, 113, 0.14);
    border: 1px solid rgba(248, 113, 113, 0.5);
    color: #fca5a5;
    font-weight: 700;
    font-size: 0.72rem;
    letter-spacing: 0.03em;
    animation: pulseCritical 1.2s ease-in-out infinite;
  }

  .hud-downed-icon { flex-shrink: 0; }
  .hud-downed-text { flex: 1; }

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
