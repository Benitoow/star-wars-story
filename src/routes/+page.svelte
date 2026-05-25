<script lang="ts">
  // Home — cinematic entrance. The library grid + "new story" flow land in a later phase.
</script>

<svelte:head>
  <title>Star Wars — Écris ta légende</title>
</svelte:head>

<section class="hero">
  <div class="hero-bg" style="background-image: url('/backdrops/hyperspace.webp')"></div>
  <div class="hero-scrim"></div>

  <div class="hero-content animate-fade-in">
    <p class="eyebrow">Une galaxie lointaine, très lointaine</p>
    <h1 class="hero-title">Écris ta légende</h1>
    <p class="hero-subtitle text-pretty">
      Une aventure interactive où chaque choix façonne un monde vivant.
    </p>
  </div>
</section>

<style>
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transform: scale(1.05);
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim-image), var(--scrim-center);
  }

  .hero-content {
    position: relative;
    text-align: center;
    padding: var(--space-2xl) var(--space-lg);
    max-width: 760px;
  }

  .hero-title {
    font-size: clamp(2.8rem, 1.5rem + 6vw, 6rem);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.05;
    margin: var(--space-md) 0;
    text-shadow: 0 2px 40px rgba(0, 0, 0, 0.6);
  }

  .hero-subtitle {
    font-size: clamp(1rem, 0.9rem + 0.6vw, 1.25rem);
    color: var(--color-text-secondary);
    max-width: 48ch;
    margin: 0 auto;
  }
</style>
