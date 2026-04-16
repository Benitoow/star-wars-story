<script lang="ts">
  import { getSvgPath } from '$lib/config/assets';
  
  export let filename: string;
  export let size: number = 24;
  export let color: string = 'currentColor';
  export let alt: string = '';
  
  $: path = getSvgPath(filename);
</script>

{#if path}
  <span
    aria-label={alt}
    role={alt ? 'img' : undefined}
    class="svg-icon"
    style={`--icon-color: ${color}; --icon-size: ${size}px; --icon-mask: url('${path}')`}
  ></span>
{/if}

<style>
  .svg-icon {
    display: inline-block;
    width: var(--icon-size, 24px);
    height: var(--icon-size, 24px);
    background-color: var(--icon-color, currentColor);
    -webkit-mask-image: var(--icon-mask);
    mask-image: var(--icon-mask);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>