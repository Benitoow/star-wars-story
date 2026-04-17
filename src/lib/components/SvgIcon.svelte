<script lang="ts">
  import { getSvgPath } from '$lib/config/assets';
  
  export let filename: string;
  export let size: number = 24;
  export let color: string = 'currentColor';
  export let alt: string = '';
  
  $: path = getSvgPath(filename);
</script>

{#if path}
  <img
    src={path}
    alt={alt}
    class="svg-icon"
    width={size}
    height={size}
    style={`--icon-size: ${size}px`}
    loading="lazy"
    decoding="async"
  />
{/if}

<style>
  .svg-icon {
    display: inline-block;
    width: var(--icon-size, 24px);
    height: var(--icon-size, 24px);
    object-fit: contain;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>