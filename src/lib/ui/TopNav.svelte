<script lang="ts">
  import { page } from '$app/stores';
  $: path = $page.url.pathname;
</script>

<nav class="nav">
  <a class="brand" href="/">Star Wars<span class="brand-sub">Story</span></a>
  <div class="links">
    <a href="/" class:active={path === '/'}>Bibliothèque</a>
    <a href="/settings" class:active={path.startsWith('/settings')}>Réglages</a>
  </div>
</nav>

<style>
  .nav {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: linear-gradient(180deg, rgba(4, 5, 9, 0.7) 0%, rgba(4, 5, 9, 0) 100%);
    backdrop-filter: blur(2px);
  }
  .brand {
    font-family: var(--font-display);
    font-size: 0.9rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-text-primary);
  }
  .brand-sub { color: var(--color-gold); margin-left: 8px; }
  .links { display: flex; gap: var(--space-lg); }
  .links a {
    font-family: var(--font-display);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .links a:hover, .links a.active { color: var(--color-text-primary); }
</style>
