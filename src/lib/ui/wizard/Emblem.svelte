<script lang="ts">
  /* The catalog ships an SVG per era, faction and role, but every file is
     authored with fill="#000000" — invisible on this dark theme, which is why
     none were ever rendered. Using them as a CSS mask paints them with any
     colour we choose, so a faction can carry its own tint and glow. */
  export let icon: string | undefined = undefined;
  export let tint = 'currentColor';
  export let size = '32px';
</script>

{#if icon}
  <span
    class="emblem"
    style="--emblem-src: url('/svg/{icon}'); --emblem-tint: {tint}; --emblem-size: {size}"
    aria-hidden="true"
  ></span>
{/if}

<style>
  .emblem {
    display: block;
    width: var(--emblem-size);
    height: var(--emblem-size);
    flex: 0 0 auto;
    background-color: var(--emblem-tint);
    -webkit-mask-image: var(--emblem-src);
    mask-image: var(--emblem-src);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
    opacity: 0.68;
    transition: opacity var(--transition-normal), background-color var(--transition-normal), filter var(--transition-normal);
  }

  @media (prefers-reduced-motion: reduce) {
    .emblem { transition: none; }
  }
</style>
