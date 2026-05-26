<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { play } from '$lib/stores/play';
  import { eraBackdrop } from '$lib/content/catalog';
  import { exportStoryDiagnostics } from '$lib/diagnostics';
  import { toasts } from '$lib/stores/ui';
  import SceneBackdrop from '$lib/ui/SceneBackdrop.svelte';
  import GameHud from '$lib/ui/GameHud.svelte';

  $: id = $page.params.id;
  $: if (browser && id) void play.open(id);

  let freeText = '';

  async function exportDiag() {
    const storyId = id;
    if (!storyId) return;
    try {
      await exportStoryDiagnostics(storyId);
      toasts.show('Diagnostic exporté.', 'success', 2500);
    } catch {
      toasts.show('Export impossible.', 'error');
    }
  }

  $: generating = $play.status === 'generating';
  $: chapter = $play.currentChapter;
  $: backdrop = $play.setup ? eraBackdrop($play.setup.era) : 'cosmic-darkness';
  $: actionParagraphs = (chapter?.narrative.action || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  $: dialogueLines = (chapter?.narrative.dialogue || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  $: reflection = chapter?.narrative.reflection?.trim() || '';

  async function onFreeAction() {
    const text = freeText.trim();
    if (!text || generating) return;
    freeText = '';
    await play.freeAction(text);
  }
</script>

<svelte:head><title>{chapter?.chapter_title || 'Aventure'} — Star Wars Story</title></svelte:head>

<div class="play">
  <SceneBackdrop {backdrop} />

  <div class="topbar">
    <div class="topbar-actions">
      <button type="button" class="icon-btn" on:click={() => goto('/')} aria-label="Bibliothèque">←</button>
      <button type="button" class="icon-btn" on:click={exportDiag} aria-label="Exporter le diagnostic" title="Exporter le diagnostic (à partager pour le debug)">⤓</button>
    </div>
    {#if $play.worldState}<div class="topbar-hud"><GameHud world={$play.worldState} /></div>{/if}
  </div>

  <div class="stage">
    {#if $play.status === 'loading'}
      <div class="center"><div class="spinner"></div></div>
    {:else if !chapter && generating}
      <div class="center prologue-loading">
        <p class="eyebrow">La Force tisse ton destin…</p>
        <div class="spinner"></div>
      </div>
    {:else if !chapter && $play.status === 'error'}
      <div class="center error-card">
        <p class="error-msg">{$play.error}</p>
        <div class="error-actions">
          <button class="btn btn-secondary" on:click={() => goto('/settings')}>Réglages</button>
          <button class="btn btn-primary" on:click={() => play.retry()}>Réessayer</button>
        </div>
      </div>
    {:else if chapter}
      <article class="scene" class:dim={generating}>
        <h1 class="scene-title">{chapter.chapter_title}</h1>
        {#each actionParagraphs as para}<p class="prose">{para}</p>{/each}
        {#if dialogueLines.length}
          <div class="dialogue">{#each dialogueLines as line}<p class="line">{line}</p>{/each}</div>
        {/if}
        {#if reflection}<p class="reflection">{reflection}</p>{/if}

        <div class="choices">
          {#each chapter.choices as choice}
            <button type="button" class="choice" on:click={() => play.chooseChoice(choice)} disabled={generating}>
              {choice.text}
            </button>
          {/each}
        </div>

        <form class="free" on:submit|preventDefault={onFreeAction}>
          <input class="input" bind:value={freeText} placeholder="Ou écris ta propre action…" disabled={generating} />
          <button type="submit" class="btn btn-secondary" disabled={generating || !freeText.trim()}>Agir</button>
        </form>
      </article>

      {#if generating}<div class="center overlay"><div class="spinner"></div></div>{/if}
    {/if}
  </div>
</div>

<style>
  .play { position: relative; min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
  }
  .topbar-actions { display: flex; gap: var(--space-sm); }
  .topbar-hud { width: min(360px, 60vw); }
  .icon-btn {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem; color: var(--color-text-primary);
    background: var(--surface-glass-strong); backdrop-filter: blur(10px);
    border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;
  }
  .icon-btn:hover { border-color: var(--color-border-hover); }

  .stage { position: relative; z-index: 2; flex: 1; display: flex; }

  .scene {
    width: 100%;
    max-width: 64ch;
    margin: 0 auto;
    padding: var(--space-lg) var(--space-lg) var(--space-2xl);
    animation: fadeIn var(--transition-slow) ease;
    transition: opacity var(--transition-normal);
  }
  .scene.dim { opacity: 0.4; pointer-events: none; }

  .scene-title {
    font-family: var(--font-display);
    color: var(--color-gold);
    font-size: clamp(1.6rem, 1.2rem + 1.6vw, 2.4rem);
    letter-spacing: 0.04em;
    margin-bottom: var(--space-lg);
    text-wrap: balance;
  }
  .prose {
    font-family: var(--font-narrative);
    font-size: var(--narrative-size);
    line-height: var(--narrative-leading);
    color: var(--color-text-primary);
    margin-bottom: 1.1rem;
  }
  .dialogue { margin: var(--space-md) 0; padding-left: var(--space-md); border-left: 2px solid var(--color-gold-dim); }
  .line { font-family: var(--font-narrative); color: var(--color-text-secondary); font-style: italic; margin-bottom: 0.6rem; }
  .reflection { font-style: italic; color: var(--color-text-muted); margin: var(--space-md) 0; }

  .choices { display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-xl); }
  .choice {
    text-align: left;
    padding: 14px 18px;
    font-family: var(--font-body);
    font-size: 0.98rem;
    color: var(--color-text-primary);
    background: var(--surface-glass);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .choice:hover:not(:disabled) { border-color: var(--color-gold-dim); background: rgba(255, 255, 255, 0.06); transform: translateX(3px); }
  .choice:disabled { opacity: 0.5; cursor: not-allowed; }

  .free { display: flex; gap: var(--space-sm); margin-top: var(--space-md); }
  .free .input { flex: 1; }

  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-lg); text-align: center; padding: var(--space-xl); }
  .overlay { position: absolute; inset: 0; }
  .error-card { max-width: 460px; }
  .error-msg { color: var(--color-text-secondary); }
  .error-actions { display: flex; gap: var(--space-sm); }

  .spinner {
    width: 30px; height: 30px;
    border: 1px solid var(--border-subtle);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .topbar-hud { width: 70vw; }
    .scene { padding: var(--space-md) var(--space-md) var(--space-2xl); }
  }
</style>
