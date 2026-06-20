<script lang="ts">
  // Full-bleed cinematic backdrop keyed to a curated, offline-cached image.
  export let backdrop = 'cosmic-darkness';
  export let variant: 'scene' | 'hero' = 'scene';

  $: src = `/backdrops/${backdrop}.webp`;
</script>

<div class="backdrop" aria-hidden="true">
  <div class="backdrop-img" style="background-image: url('{src}')"></div>
  <div class="backdrop-scrim" class:hero={variant === 'hero'}></div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    overflow: hidden;
    z-index: 0;
  }
  .backdrop-img {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transform: scale(1.04);
    animation: drift 40s ease-in-out infinite alternate;
  }
  .backdrop-scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim-read), var(--scrim-image);
  }
  .backdrop-scrim.hero {
    background: var(--scrim-image), var(--scrim-center);
  }
  @keyframes drift {
    from { transform: scale(1.04) translate(0, 0); }
    to { transform: scale(1.12) translate(-1.5%, -1.5%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .backdrop-img { animation: none; }
  }
</style>
