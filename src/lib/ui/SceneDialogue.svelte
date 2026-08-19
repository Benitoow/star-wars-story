<script lang="ts">
  /* Scene dialogue. Every reply used to render identically — the protagonist's
     own words looked exactly like an enemy's — and a reply spilling onto a
     second line lost its speaker entirely. Each speaker now carries an
     identity: the protagonist in gold, known NPCs in their faction's colour. */
  import { FACTIONS } from '$lib/content/catalog';
  import { parseDialogue, protagonistMatcher, foldText, type WorldState } from '$lib/engine';

  export let dialogue: string;
  export let world: WorldState | null = null;
  export let protagonist = '';

  $: isMe = protagonistMatcher(protagonist, (world?.npcs ?? []).map((n) => n.name));

  /** Faction colour when the speaker is a known NPC, gold for the protagonist. */
  function tintOf(speaker: string, mine: boolean): string {
    if (mine) return 'var(--color-gold)';
    const npc = world?.npcs.find((n) => foldText(n.name) === foldText(speaker));
    const colour = npc?.faction ? FACTIONS.find((f) => f.id === npc.faction)?.color : undefined;
    return colour ?? 'var(--color-blue)';
  }

  // Resolved here rather than in the template: the tint depends on `world` and
  // `protagonist`, which Svelte would not track through a function call.
  $: lines = parseDialogue(dialogue).map((line) => {
    const mine = line.speaker ? isMe(line.speaker) : false;
    return { ...line, mine, tint: line.speaker ? tintOf(line.speaker, mine) : 'var(--color-text-muted)' };
  });
</script>

{#if lines.length}
  <div class="dialogue">
    {#each lines as line, i}
      <p
        class="line"
        class:mine={line.mine}
        class:continuation={line.continuation}
        class:aside={!line.speaker}
        style="--tint: {line.tint}; --stagger: {Math.min(i, 8) * 45}ms"
      >
        {#if line.speaker && !line.continuation}
          <span class="speaker">{line.speaker}</span>
        {/if}
        <span class="text">{line.text}</span>
      </p>
    {/each}
  </div>
{/if}

<style>
  .dialogue { margin: var(--space-md) 0; display: flex; flex-direction: column; gap: 2px; }

  .line {
    position: relative;
    padding: 5px 0 5px var(--space-md);
    border-left: 2px solid var(--tint);
    font-family: var(--font-narrative);
    color: var(--color-text-secondary);
    line-height: 1.6;
    animation: rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--stagger);
  }
  /* A spilled second line belongs to the reply above it, not to nobody. */
  .line.continuation { padding-top: 0; }
  .line.continuation .text { display: block; }

  /* The protagonist's own words read as theirs at a glance. */
  .line.mine { background: linear-gradient(90deg, rgba(216, 185, 119, 0.09), transparent 62%); }

  /* No attribution: stage direction, not speech. */
  .line.aside {
    border-left-style: dotted;
    font-style: italic;
    color: var(--color-text-muted);
  }

  .speaker {
    display: block;
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--tint);
    margin-bottom: 2px;
  }
  .line.mine .speaker::after {
    content: ' — toi';
    letter-spacing: 0.02em;
    text-transform: none;
    opacity: 0.6;
  }
  .text { font-style: italic; }

  @keyframes rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  @media (prefers-reduced-motion: reduce) {
    .line { animation: none; }
  }
</style>
