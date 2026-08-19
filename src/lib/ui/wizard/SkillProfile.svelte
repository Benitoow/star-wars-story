<script lang="ts">
  /* The mechanical consequence of picking a role and a faction, made visible.
     deriveSkillProfile already drove every dice roll of the whole campaign;
     the player just never got to see it before committing. */
  import { deriveSkillProfile, FACTION_CREDITS } from '$lib/content/catalog';
  import { SKILL_LABELS } from '$lib/content/lore';

  export let role: string;
  export let faction: string;

  const MAX = 5;
  const ORDER = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'] as const;

  $: profile = deriveSkillProfile({ role, faction });
  $: credits = FACTION_CREDITS[role] ?? FACTION_CREDITS.default;
  $: best = ORDER.reduce((a, b) => (profile[b] > profile[a] ? b : a), ORDER[0]);
</script>

<div class="profile">
  <div class="head">
    <span class="eyebrow">Aptitudes de départ</span>
    <span class="credits">₡{credits.toLocaleString('fr-FR')}</span>
  </div>

  <ul class="bars">
    {#each ORDER as skill}
      {@const value = profile[skill]}
      <li class:peak={skill === best}>
        <span class="name">{SKILL_LABELS[skill]}</span>
        <span class="track">
          <span class="fill" style="width: {(value / MAX) * 100}%"></span>
        </span>
        <span class="value">{value}</span>
      </li>
    {/each}
  </ul>

  <p class="foot">
    Chaque choix en jeu mobilise une aptitude : plus elle est haute, plus la réussite est probable.
  </p>
</div>

<style>
  .profile {
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.03);
  }
  .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-sm); }
  .credits {
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: var(--color-gold);
    letter-spacing: 0.02em;
  }

  .bars { list-style: none; display: flex; flex-direction: column; gap: 7px; }
  .bars li {
    display: grid;
    grid-template-columns: 84px 1fr 16px;
    align-items: center;
    gap: var(--space-sm);
  }
  .name { font-size: 0.78rem; color: var(--color-text-muted); }
  .bars li.peak .name { color: var(--color-text-secondary); }

  .track {
    position: relative;
    height: 5px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--color-gold-dim), var(--color-gold));
    /* The bar re-flows whenever role or faction changes — that motion IS the
       feedback, so it gets a deliberately readable duration. */
    transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .bars li.peak .fill { box-shadow: 0 0 10px rgba(216, 185, 119, 0.45); }

  .value {
    font-family: var(--font-display);
    font-size: 0.82rem;
    text-align: right;
    color: var(--color-text-secondary);
  }
  .bars li.peak .value { color: var(--color-gold); }

  .foot {
    margin-top: var(--space-sm);
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--color-text-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .fill { transition: none; }
  }
</style>
