<script lang="ts">
  import { getSvgPath } from '$lib/config/assets';
  
  export let filename: string;
  export let size: number = 24;
  export let color: string = 'currentColor';
  export let alt: string = '';
  
  $: path = getSvgPath(filename);
</script>

<img 
  src={path}
  alt={alt}
  width={size}
  height={size}
  style="--icon-color: {color}"
  class="svg-icon"
/>

<style>
  .svg-icon {
    display: inline-block;
    width: var(--size, 24px);
    height: var(--size, 24px);
    color: var(--icon-color, currentColor);
    object-fit: contain;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>