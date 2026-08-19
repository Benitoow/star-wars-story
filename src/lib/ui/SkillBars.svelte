<script lang="ts">
  /* The 1-5 aptitude profile, drawn the same way in the creation wizard and in
     the game — the number that decides every roll should not look like two
     different things depending on the screen. */
  import { SKILL_LABELS } from '$lib/content/lore';
  import type { SkillProfile } from '$lib/engine';

  export let skills: SkillProfile;
  /** Highlight the strongest aptitude — the one the player leans on. */
  export let markPeak = true;

  const MAX = 5;
  const ORDER = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'] as const;

  $: best = ORDER.reduce((a, b) => (skills[b] > skills[a] ? b : a), ORDER[0]);
</script>

<ul class="bars">
  {#each ORDER as skill}
    {@const value = skills[skill] ?? 2}
    <li class:peak={markPeak && skill === best}>
      <span class="name">{SKILL_LABELS[skill]}</span>
      <span class="track"><span class="fill" style="width: {(value / MAX) * 100}%"></span></span>
      <span class="value">{value}</span>
    </li>
  {/each}
</ul>

<style>
  .bars { list-style: none; display: flex; flex-direction: column; gap: 7px; }
  .bars li { display: grid; grid-template-columns: 84px 1fr 16px; align-items: center; gap: var(--space-sm); }
  .name { font-size: 0.78rem; color: var(--color-text-muted); }
  .bars li.peak .name { color: var(--color-text-secondary); }

  .track { position: relative; height: 5px; border-radius: 99px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
  .fill {
    display: block; height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, var(--color-gold-dim), var(--color-gold));
    /* The bar re-flows when the profile changes — that motion IS the feedback,
       so it gets a deliberately readable duration. */
    transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .bars li.peak .fill { box-shadow: 0 0 10px rgba(216, 185, 119, 0.45); }

  .value { font-family: var(--font-display); font-size: 0.82rem; text-align: right; color: var(--color-text-secondary); }
  .bars li.peak .value { color: var(--color-gold); }

  @media (prefers-reduced-motion: reduce) {
    .fill { transition: none; }
  }
</style>
