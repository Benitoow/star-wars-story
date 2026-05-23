<script lang="ts">
  /**
   * Cinematic full-bleed backdrop for the play screen.
   *
   * Renders an offline-safe procedural space scene (era-tinted base + a
   * mood-coloured nebula glow + a stable starfield) that shifts with the
   * current scene's `sectionType` and `era`. It is image-ready: pass an
   * `image` URL (e.g. a royalty-free sci-fi still in /backdrops) and it is
   * layered on top of the gradient, which then acts as the fallback.
   *
   * It is purely presentational — meant to sit behind the narrative with a
   * dark scrim so prose stays legible over any backdrop.
   */
  export let sectionType: string | null | undefined = undefined;
  export let era: string | null | undefined = undefined;
  export let image: string | null | undefined = undefined;

  type Mood = { glow: string; pos: string };
  const MOODS: Record<string, Mood> = {
    action:        { glow: '255, 96, 58',  pos: '78% 30%' },
    confrontation: { glow: '226, 54, 80',  pos: '72% 36%' },
    dialogue:      { glow: '78, 128, 214',  pos: '80% 28%' },
    exploration:   { glow: '40, 184, 168',  pos: '76% 32%' },
    tension:       { glow: '240, 164, 56',  pos: '74% 28%' },
    revelation:    { glow: '174, 132, 255', pos: '68% 26%' },
    repos:         { glow: '72, 124, 176',  pos: '82% 34%' },
    interlude:     { glow: '124, 134, 184', pos: '80% 32%' }
  };
  const DEFAULT_MOOD: Mood = { glow: '92, 132, 200', pos: '78% 30%' };

  type EraTone = { top: string; bottom: string };
  const ERA_TONES: Record<string, EraTone> = {
    old_republic: { top: '#1a1510', bottom: '#06060a' },
    clone_wars:   { top: '#0e1422', bottom: '#05070d' },
    imperial:     { top: '#0c0f17', bottom: '#040509' },
    new_republic: { top: '#0a1018', bottom: '#04060b' },
    first_order:  { top: '#150a0c', bottom: '#050406' }
  };
  const DEFAULT_TONE: EraTone = { top: '#0c0f17', bottom: '#040509' };

  $: mood = (sectionType && MOODS[sectionType]) || DEFAULT_MOOD;
  $: tone = (era && ERA_TONES[era]) || DEFAULT_TONE;

  // Stable starfield — seeded once so stars never jump between scenes; only the
  // nebula colour transitions as the story moves.
  function mulberry32(seed: number): () => number {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(20260523);
  const STARS = Array.from({ length: 88 }, () => {
    const r = rng();
    return {
      x: rng() * 100,
      y: rng() * 100,
      size: 0.4 + r * 1.9,
      opacity: 0.18 + rng() * 0.72,
      twinkle: rng() > 0.72,
      delay: rng() * 6
    };
  });
</script>

<div
  class="scene-backdrop"
  style="--bd-top:{tone.top}; --bd-bottom:{tone.bottom}; --bd-glow:{mood.glow}; --bd-glow-pos:{mood.pos};"
  aria-hidden="true"
>
  <div class="bd-base"></div>
  <div class="bd-nebula"></div>

  <div class="bd-stars">
    {#each STARS as star}
      <span
        class="bd-star"
        class:twinkle={star.twinkle}
        style="left:{star.x}%; top:{star.y}%; width:{star.size}px; height:{star.size}px; opacity:{star.opacity}; animation-delay:{star.delay}s;"
      ></span>
    {/each}
  </div>

  {#if image}
    <div class="bd-image" style="background-image:url('{image}');"></div>
  {/if}

  <div class="bd-vignette"></div>
  <div class="bd-scrim"></div>
</div>

<style>
  .scene-backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: var(--bd-bottom, #040509);
    pointer-events: none;
  }

  .scene-backdrop > div {
    position: absolute;
    inset: 0;
  }

  /* Era-tinted depth base */
  .bd-base {
    background:
      radial-gradient(140% 90% at 50% -20%, color-mix(in srgb, var(--bd-top) 70%, transparent) 0%, transparent 60%),
      linear-gradient(180deg, var(--bd-top) 0%, var(--bd-bottom) 78%);
  }

  /* Mood-coloured nebula glow — the part that shifts with the scene */
  .bd-nebula {
    background:
      radial-gradient(58% 58% at var(--bd-glow-pos),
        rgba(var(--bd-glow), 0.62) 0%,
        rgba(var(--bd-glow), 0.32) 36%,
        rgba(var(--bd-glow), 0.1) 62%,
        transparent 80%);
    filter: blur(6px);
    opacity: 0.95;
    transition: background 1.2s ease, opacity 1.2s ease;
    will-change: background;
  }

  .bd-stars { z-index: 1; }

  .bd-star {
    position: absolute;
    border-radius: 50%;
    background: #fdfdff;
    box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
  }

  .bd-star.twinkle {
    animation: bd-twinkle 5.5s ease-in-out infinite;
  }

  @keyframes bd-twinkle {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 0.15; }
  }

  /* Optional royalty-free still layered over the gradient */
  .bd-image {
    background-size: cover;
    background-position: center;
    opacity: 0.5;
    mix-blend-mode: screen;
  }

  /* Darken the edges for cinematic focus */
  .bd-vignette {
    background: radial-gradient(120% 120% at 50% 38%, transparent 52%, rgba(0, 0, 0, 0.55) 100%);
  }

  /* Left-weighted reading scrim so prose stays legible */
  .bd-scrim {
    background: var(--scrim-read);
  }

  @media (prefers-reduced-motion: reduce) {
    .bd-star.twinkle { animation: none; }
  }
</style>
