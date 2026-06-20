<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { play } from '$lib/stores/play';
  import { foldText } from '$lib/engine/text';
  import { eraBackdrop } from '$lib/content/catalog';
  import { exportStoryDiagnostics } from '$lib/diagnostics';
  import { toasts } from '$lib/stores/ui';
  import SceneBackdrop from '$lib/ui/SceneBackdrop.svelte';
  import GameHud from '$lib/ui/GameHud.svelte';
  import ChatPanel from '$lib/ui/ChatPanel.svelte';
  import JournalPanel from '$lib/ui/JournalPanel.svelte';

  $: id = $page.params.id;
  $: if (browser && id) void play.open(id);

  let freeText = '';
  let showJournal = false;

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
  $: partial = $play.partialChapter;
  $: partialParagraphs = (partial?.text || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  $: backdrop = $play.setup ? eraBackdrop($play.setup.era) : 'cosmic-darkness';
  $: actionParagraphs = (chapter?.narrative.action || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  $: dialogueLines = (chapter?.narrative.dialogue || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  $: reflection = chapter?.narrative.reflection?.trim() || '';
  // Who can the player talk to? The model lists who's still on site at the end
  // of the scene (npcs_present); without it (old saves), fall back to every
  // living NPC known. Dead NPCs are never offered.
  $: aliveNpcs = ($play.worldState?.npcs ?? []).filter((n) => n.alive !== false);
  $: talkTargets = (() => {
    const present = chapter?.npcs_present;
    if (!present?.length) return aliveNpcs.map((n) => n.name);
    const dead = new Set(($play.worldState?.npcs ?? []).filter((n) => n.alive === false).map((n) => foldText(n.name)));
    // Prefer the canonical world-state name when one matches the listed name.
    return present
      .filter((name) => !dead.has(foldText(name)))
      .map((name) => aliveNpcs.find((n) => foldText(n.name) === foldText(name))?.name ?? name);
  })();
  $: interactive = chapter ? ['dialogue', 'confrontation'].includes(chapter.section_type) : false;

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
      {#if $play.worldState}
        <button type="button" class="icon-btn" on:click={() => (showJournal = true)} aria-label="Journal de bord" title="Journal de bord">📖</button>
      {/if}
      <button type="button" class="icon-btn" on:click={exportDiag} aria-label="Exporter le diagnostic" title="Exporter le diagnostic (à partager pour le debug)">⤓</button>
    </div>
    {#if $play.worldState}<div class="topbar-hud"><GameHud world={$play.worldState} /></div>{/if}
  </div>

  <div class="stage">
    {#if $play.chat.active}
      <ChatPanel />
    {:else if $play.status === 'loading'}
      <div class="center"><div class="spinner"></div></div>
    {:else if generating && partial}
      <!-- The scene streams in as the model writes it. -->
      <article class="scene">
        <h1 class="scene-title">{partial.title || '…'}</h1>
        {#each partialParagraphs as para}<p class="prose">{para}</p>{/each}
        <p class="prose"><span class="stream-caret">▍</span></p>
      </article>
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

        {#if talkTargets.length}
          <div class="talk" class:prominent={interactive}>
            {#if interactive}<p class="talk-cue eyebrow">Engage la conversation</p>{/if}
            <div class="talk-actions">
              {#each talkTargets as name (name)}
                <button type="button" class="talk-btn" on:click={() => play.enterChat(name)} disabled={generating}>
                  💬 Parler à {name}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </article>

      {#if generating}<div class="center overlay"><div class="spinner"></div></div>{/if}
    {/if}
  </div>

  {#if showJournal && $play.worldState}
    <JournalPanel world={$play.worldState} chapters={$play.chapterHistory} onClose={() => (showJournal = false)} />
  {/if}
</div>

<style>
  .play { position: relative; height: 100vh; height: 100dvh; overflow-y: auto; display: flex; flex-direction: column; }

  .topbar {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    padding: calc(var(--space-md) + var(--sat)) calc(var(--space-lg) + var(--sar)) var(--space-md) calc(var(--space-lg) + var(--sal));
  }
  .topbar-actions { display: flex; gap: var(--space-sm); }
  .topbar-hud { width: min(360px, 60vw); }
  .icon-btn {
    width: 44px; height: 44px;
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
    min-height: 48px;
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

  .talk { margin-top: var(--space-lg); }
  .talk-cue { margin-bottom: var(--space-sm); color: var(--color-gold); }
  .talk-actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
  .talk-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 14px; font-family: var(--font-body); font-size: 0.9rem;
    color: var(--color-text-secondary); background: transparent;
    border: 1px dashed var(--color-border); border-radius: 999px; cursor: pointer;
    transition: all var(--transition-fast);
  }
  .talk-btn:hover:not(:disabled) { color: var(--color-text-primary); border-color: var(--color-gold-dim); }
  .talk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .talk.prominent .talk-btn { border-style: solid; border-color: var(--color-gold-dim); background: rgba(216,185,119,0.08); color: var(--color-text-primary); }

  .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-lg); text-align: center; padding: var(--space-xl); }
  .overlay { position: absolute; inset: 0; }
  .error-card { max-width: 460px; }
  .error-msg { color: var(--color-text-secondary); }
  .error-actions { display: flex; gap: var(--space-sm); }

  .stream-caret { color: var(--color-gold); animation: pulse 1s steps(2) infinite; }

  .spinner {
    width: 30px; height: 30px;
    border: 1px solid var(--border-subtle);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .topbar { padding: calc(var(--space-sm) + var(--sat)) calc(var(--space-md) + var(--sar)) var(--space-sm) calc(var(--space-md) + var(--sal)); gap: var(--space-sm); }
    .topbar-hud { width: 75vw; }
    .icon-btn { width: 44px; height: 44px; font-size: 1.1rem; }
    .scene { padding: var(--space-md) calc(var(--space-md) + var(--sal)) calc(var(--space-2xl) + var(--sab)) calc(var(--space-md) + var(--sar)); }
    .scene-title { font-size: clamp(1.3rem, 1rem + 1.2vw, 1.8rem); }
    .prose { font-size: 0.98rem; line-height: 1.75; }
    .choice { padding: 16px 16px; font-size: 0.95rem; }
    .free { flex-direction: column; }
    .free .input { width: 100%; }
    .talk-actions { flex-direction: column; }
    .talk-btn { width: 100%; justify-content: center; padding: 14px; }
  }
</style>
