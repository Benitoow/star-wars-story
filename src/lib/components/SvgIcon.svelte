<script lang="ts">
  import { getSvgPath } from '$lib/config/assets';
  
  export let filename: string;
  export let size: number = 24;
  export let color: string = 'currentColor';
  export let monochrome: boolean = true;
  export let alt: string = '';
  
  $: path = getSvgPath(filename);
  $: iconFilter = monochrome ? 'brightness(0) saturate(100%) invert(92%)' : 'none';
</script>

{#if path}
  <img
    src={path}
    alt={alt}
    class="svg-icon"
    width={size}
    height={size}
    style={`--icon-size: ${size}px; --icon-filter: ${iconFilter}; --icon-accent: ${color};`}
    loading="lazy"
    decoding="async"
  />
{/if}

<style>
  .svg-icon {
    display: inline-block;
    width: var(--icon-size, 24px);
    height: var(--icon-size, 24px);
    padding: 2px;
    border-radius: 6px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--icon-accent) 30%, var(--color-border));
    background: color-mix(in srgb, var(--color-bg-primary) 78%, transparent);
    object-fit: contain;
    vertical-align: middle;
    flex-shrink: 0;
    filter: var(--icon-filter);
  }
</style>