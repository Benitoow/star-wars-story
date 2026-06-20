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
    padding: calc(var(--space-md) + var(--sat)) calc(var(--space-lg) + var(--sar)) var(--space-md) calc(var(--space-lg) + var(--sal));
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
      padding: 8px 4px;
      min-height: 44px;
      display: flex;
      align-items: center;
    }
    .links a:hover, .links a.active { color: var(--color-text-primary); }
    @media (max-width: 768px) {
      .nav { padding: calc(var(--space-sm) + var(--sat)) calc(var(--space-md) + var(--sar)) var(--space-sm) calc(var(--space-md) + var(--sal)); }
      .brand { font-size: 0.78rem; }
      .links { gap: var(--space-md); }
      .links a { font-size: 0.62rem; }
    }
</style>
