<script lang="ts">
  /* The mechanical consequence of picking a role and a faction, made visible.
     deriveSkillProfile already drove every dice roll of the whole campaign;
     the player just never got to see it before committing. */
  import { deriveSkillProfile, FACTION_CREDITS } from '$lib/content/catalog';
  import SkillBars from '../SkillBars.svelte';

  export let role: string;
  export let faction: string;

  $: profile = deriveSkillProfile({ role, faction });
  $: credits = FACTION_CREDITS[role] ?? FACTION_CREDITS.default;
</script>

<div class="profile">
  <div class="head">
    <span class="eyebrow">Aptitudes de départ</span>
    <span class="credits">₡{credits.toLocaleString('fr-FR')}</span>
  </div>

  <SkillBars skills={profile} />

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
  .foot {
    margin-top: var(--space-sm);
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--color-text-muted);
  }
</style>
