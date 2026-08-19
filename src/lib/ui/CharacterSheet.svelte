<script lang="ts">
  /* The character, in game. v3.3.0 started generating a past, a drive and a
     flaw the GM is told to play against the player — and none of it was
     visible anywhere once the story began. The avatar picked at creation was
     never displayed either. This is where all of it finally shows up. */
  import { ERAS, FACTIONS, ROLES } from '$lib/content/catalog';
  import { FACTION_DESC, ROLE_DESC } from '$lib/content/lore';
  import Emblem from './Emblem.svelte';
  import SkillBars from './SkillBars.svelte';
  import type { StorySetup, WorldState } from '$lib/engine';

  export let setup: StorySetup;
  export let world: WorldState;
  export let onClose: () => void;

  $: g = setup.genesis;
  $: p = world.player;
  $: era = ERAS.find((e) => e.id === setup.era);
  $: faction = FACTIONS.find((f) => f.id === setup.faction);
  $: role = ROLES.find((r) => r.id === setup.role);
  $: tint = faction?.color ?? 'var(--color-gold)';
  $: name = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim() || 'Protagoniste';
  // The tied NPC is a live world entity: show how the relationship stands now,
  // not the affinity it was born with.
  $: ally = g?.ally?.name ? world.npcs.find((n) => n.name === g.ally.name) ?? g.ally : null;

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="overlay" role="presentation" on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <section class="sheet" aria-label="Fiche de personnage" style="--tint: {tint}">
    <header class="head">
      <span class="avatar">{setup.protagonistAvatar || '🧑‍🚀'}</span>
      <div class="who">
        <h2 class="name">{name}</h2>
        <p class="line">
          <Emblem icon={role?.icon} {tint} size="15px" />
          <span>{role?.name ?? setup.role}</span>
          <span class="sep">·</span>
          <Emblem icon={faction?.icon} {tint} size="15px" />
          <span>{faction?.name ?? setup.faction}</span>
        </p>
        <p class="line muted">
          <Emblem icon={era?.icon} tint="var(--color-text-muted)" size="15px" />
          <span>{era?.name ?? setup.era}</span>
          <span class="sep">·</span>
          <span>{p.date}</span>
        </p>
      </div>
      <button type="button" class="icon-btn" on:click={onClose} aria-label="Fermer la fiche">✕</button>
    </header>

    <div class="body">
      {#if g?.background}
        <section class="block">
          <h3 class="eyebrow">Passé</h3>
          <p class="prose">{g.background}</p>
        </section>
        {#if g.motivation}
          <section class="block">
            <h3 class="eyebrow">Ce qui te pousse</h3>
            <p class="prose">{g.motivation}</p>
          </section>
        {/if}
        {#if g.flaw}
          <section class="block flaw">
            <h3 class="eyebrow">Ta faille</h3>
            <p class="prose">{g.flaw}</p>
            <p class="hint">Le Maître du Jeu peut s'en servir contre toi.</p>
          </section>
        {/if}
      {:else}
        <p class="empty">
          Cette partie a été créée avant la genèse de personnage — pas de fiche détaillée.
          Les nouvelles aventures en ont une.
        </p>
      {/if}

      <section class="block">
        <h3 class="eyebrow">Aptitudes</h3>
        <SkillBars skills={p.skills} />
        <p class="hint">Niveau {p.level} · {p.experience} XP</p>
      </section>

      {#if ally}
        <section class="block">
          <h3 class="eyebrow">Lien</h3>
          <p class="prose"><strong>{ally.name}</strong>{ally.note ? ` — ${ally.note}` : ''}</p>
          {#if 'alive' in ally && ally.alive === false}<p class="hint dead">Mort au cours de l'aventure.</p>{/if}
        </section>
      {/if}

      {#if p.inventory.length}
        <section class="block">
          <h3 class="eyebrow">Inventaire <span class="count">₡{p.credits.toLocaleString('fr-FR')}</span></h3>
          <div class="chips">
            {#each p.inventory as item}<span class="chip">{item.name}{item.qty > 1 ? ` ×${item.qty}` : ''}</span>{/each}
          </div>
        </section>
      {/if}

      {#if p.injuries.length}
        <section class="block">
          <h3 class="eyebrow">Blessures</h3>
          <div class="chips">
            {#each p.injuries as inj}<span class="chip hurt">{inj.description}</span>{/each}
          </div>
        </section>
      {/if}

      <section class="block">
        <h3 class="eyebrow">Origine</h3>
        <p class="prose small">{ROLE_DESC[setup.role] ?? ''}</p>
        <p class="prose small muted">{FACTION_DESC[setup.faction] ?? ''}</p>
      </section>
    </div>
  </section>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 40;
    display: flex; justify-content: flex-end;
    /* Clip the entry slide: without this the panel's start offset widens the
       document for as long as the animation runs — and leaves it off-screen
       entirely if animations are throttled (background tab). */
    overflow: hidden;
    background: rgba(4, 5, 9, 0.62); backdrop-filter: blur(3px);
    animation: fade 200ms ease both;
  }
  .sheet {
    width: min(430px, 100%);
    display: flex; flex-direction: column;
    background: var(--surface-glass-strong); backdrop-filter: blur(18px);
    border-left: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg);
    animation: slide 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .head {
    display: flex; align-items: flex-start; gap: var(--space-md);
    padding: calc(var(--space-lg) + var(--sat)) var(--space-lg) var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }
  .avatar {
    flex: 0 0 auto; width: 52px; height: 52px;
    display: grid; place-items: center; font-size: 1.6rem;
    border: 1px solid var(--tint); border-radius: 50%;
    background: color-mix(in srgb, var(--tint) 12%, transparent);
  }
  .who { flex: 1; min-width: 0; }
  .name { font-family: var(--font-display); font-size: 1.2rem; color: var(--color-text-primary); }
  .line { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 3px; font-size: 0.78rem; color: var(--color-text-secondary); }
  .line.muted { color: var(--color-text-muted); font-size: 0.73rem; }
  .sep { opacity: 0.5; }
  .icon-btn {
    flex: 0 0 auto; width: 32px; height: 32px;
    border: 1px solid var(--color-border); border-radius: var(--radius-sm);
    background: none; color: var(--color-text-muted); cursor: pointer;
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }
  .icon-btn:hover { border-color: var(--color-border-hover); color: var(--color-text-primary); }

  .body { flex: 1; overflow-y: auto; padding: var(--space-lg); padding-bottom: calc(var(--space-lg) + var(--sab)); display: flex; flex-direction: column; gap: var(--space-md); }

  .block {
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-left: 2px solid var(--color-gold-dim);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.03);
  }
  .block.flaw { border-left-color: var(--color-red); }
  .count { float: right; font-family: var(--font-display); color: var(--color-gold); letter-spacing: 0.02em; }

  .prose { margin-top: 6px; font-family: var(--font-narrative); font-size: 0.88rem; line-height: 1.6; color: var(--color-text-secondary); }
  .prose.small { font-size: 0.8rem; }
  .prose.muted { color: var(--color-text-muted); }
  .prose strong { color: var(--color-gold); }
  .hint { margin-top: 6px; font-size: 0.72rem; color: var(--color-text-muted); font-style: italic; }
  .hint.dead { color: var(--color-red); font-style: normal; }
  .empty { font-size: 0.84rem; line-height: 1.55; color: var(--color-text-muted); }

  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .chip {
    padding: 4px 9px; border-radius: 99px;
    border: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.04);
    font-size: 0.75rem; color: var(--color-text-secondary);
  }
  .chip.hurt { border-color: rgba(215, 107, 107, 0.45); background: rgba(215, 107, 107, 0.09); color: var(--color-red); }

  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }

  @media (max-width: 768px) {
    .sheet { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .overlay, .sheet { animation: none; }
  }
</style>
