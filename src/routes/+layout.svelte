<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/ui';
  import Toast from '$lib/ui/Toast.svelte';

  onMount(() => {
    theme.init();
  });
</script>

<div class="app">
  <main class="main">
    <slot />
  </main>
  <Toast />
</div>

<style>
  .app {
    position: relative;
    min-height: 100vh;
    background: var(--color-bg-primary);
  }

  .main {
    min-height: 100vh;
  }
</style>
