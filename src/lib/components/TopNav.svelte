<script lang="ts">
  import { page } from '$app/stores';

  $: path = $page.url.pathname;
  $: immersive = path.startsWith('/editor/'); // play screen has its own minimal chrome

  const items = [
    { href: '/', label: 'Accueil' },
    { href: '/stories/new', label: 'Nouvelle' },
    { href: '/settings', label: 'Paramètres' }
  ];

  function isActive(href: string): boolean {
    return href === '/' ? path === '/' : path.startsWith(href);
  }
</script>

{#if !immersive}
  <header class="nav">
    <a class="brand" href="/">
      <span class="brand-name">Star&nbsp;Wars</span>
      <span class="brand-sub">Story</span>
    </a>
    <nav class="nav-links" aria-label="Navigation principale">
      {#each items as item}
        <a class="nav-link" class:active={isActive(item.href)} href={item.href}>{item.label}</a>
      {/each}
    </nav>
  </header>
{/if}

<style>
  .nav {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    height: var(--header-height);
    padding: 0 clamp(var(--space-lg), 5vw, var(--space-2xl));
    pointer-events: none;
  }

  .nav > * { pointer-events: auto; }

  .brand {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    color: var(--color-text-primary);
    text-decoration: none;
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.28em;
    text-transform: uppercase;
  }

  .brand-sub {
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: clamp(var(--space-md), 2.4vw, var(--space-2xl));
  }

  .nav-link {
    position: relative;
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    text-decoration: none;
    padding: 4px 0;
    transition: color var(--transition-fast);
  }

  .nav-link:hover { color: var(--color-text-primary); }

  .nav-link::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 1px;
    background: var(--color-text-primary);
    transform: scaleX(0);
    transform-origin: center;
    transition: transform var(--transition-normal);
  }

  .nav-link.active { color: var(--color-text-primary); }
  .nav-link.active::after { transform: scaleX(1); }

  @media (max-width: 560px) {
    .brand-sub { display: none; }
    .nav-links { gap: var(--space-md); }
    .nav-link { font-size: 0.64rem; letter-spacing: 0.16em; }
  }
</style>
