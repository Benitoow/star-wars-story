<script lang="ts">
  /* Narrative style. This step used to also carry the avatar and the name —
     identity belongs with the character, so it moved there and this screen
     now does one thing: decide how the story reads. */
  import { NARRATIVE_PRESETS, CONTENT_MODES, type NarrativePreset } from '$lib/content/catalog';

  export let preset: NarrativePreset;
  export let contentMode: string;

  const LENGTH_LABEL: Record<string, string> = { court: 'scènes courtes', moyen: 'scènes moyennes', long: 'scènes longues' };
  const POV_LABEL: Record<string, string> = { premiere: '1ʳᵉ personne', troisieme: '3ᵉ personne' };
</script>

<h1>Comment veux-tu que ça se lise ?</h1>
<p class="lede">Ces réglages pilotent vraiment l'écriture : longueur des scènes, personne narrative et ton.</p>

<p class="eyebrow">Ambiance narrative</p>
<div class="grid">
  {#each NARRATIVE_PRESETS as p, i}
    <button
      type="button"
      class="tile"
      class:selected={preset.id === p.id}
      style="--stagger: {i * 35}ms"
      aria-pressed={preset.id === p.id}
      on:click={() => { preset = p; contentMode = p.contentMode; }}
    >
      <span class="icon">{p.icon}</span>
      <span class="name">{p.name}</span>
      <span class="sub">{p.desc}</span>
      <span class="axes">{POV_LABEL[p.writingPov] ?? p.writingPov} · {LENGTH_LABEL[p.writingLength] ?? p.writingLength}</span>
    </button>
  {/each}
</div>

<p class="eyebrow mt">Directive de contenu</p>
<div class="grid compact">
  {#each CONTENT_MODES as m}
    <button
      type="button"
      class="tile mode"
      class:selected={contentMode === m.id}
      aria-pressed={contentMode === m.id}
      on:click={() => (contentMode = m.id)}
    >
      <span class="icon small">{m.icon}</span>
      <span class="name">{m.name}</span>
      <span class="sub">{m.desc}</span>
    </button>
  {/each}
</div>

<style>
  .lede { margin-bottom: var(--space-lg); color: var(--color-text-muted); font-size: 0.88rem; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-sm); }
  .grid.compact { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }

  .tile {
    display: flex; flex-direction: column; gap: 5px;
    padding: var(--space-md);
    border: 1px solid var(--color-border); border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.02);
    color: var(--color-text-secondary); text-align: left; cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
    animation: rise 360ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: var(--stagger, 0ms);
  }
  .tile:hover { border-color: var(--color-border-hover); transform: translateY(-2px); }
  .tile.selected {
    border-color: var(--color-gold-dim);
    background: rgba(216, 185, 119, 0.08);
    color: var(--color-text-primary);
  }
  .tile.selected .icon { transform: scale(1.1); }

  .icon { font-size: 1.4rem; transition: transform var(--transition-normal); align-self: flex-start; }
  .icon.small { font-size: 1.1rem; }
  .name { font-family: var(--font-display); font-size: 0.9rem; }
  .sub { font-size: 0.75rem; line-height: 1.4; color: var(--color-text-muted); }
  .axes {
    margin-top: 2px; font-size: 0.68rem; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--color-gold-dim);
  }
  .tile.selected .axes { color: var(--color-gold); }

  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  @media (prefers-reduced-motion: reduce) {
    .tile { animation: none; }
    .tile:hover { transform: none; }
  }
</style>
