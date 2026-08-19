<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { play } from '$lib/stores/play';
  import { FACTIONS } from '$lib/content/catalog';
  import { foldText } from '$lib/engine';

  let draft = '';
  let threadEl: HTMLDivElement;

  $: chat = $play.chat;
  // Same identity language as the scene: an NPC keeps their faction's colour
  // whether they speak in the narration or in a live conversation.
  $: npc = $play.worldState?.npcs.find((n) => foldText(n.name) === foldText(chat.npcName));
  $: tint = (npc?.faction ? FACTIONS.find((f) => f.id === npc.faction)?.color : null) ?? 'var(--color-blue)';

  // Auto-scroll to the latest message / streaming token.
  afterUpdate(() => {
    if (threadEl) {
      threadEl.scrollTop = threadEl.scrollHeight;
    }
  });

  async function send() {
    const text = draft.trim();
    if (!text || chat.busy) return;
    draft = '';
    await play.sendChatMessage(text);
  }
</script>

<section class="chat" style="--npc-tint: {tint}">
  <header class="chat-head">
    <div class="who">
      <span class="avatar">{chat.npcName.charAt(0).toUpperCase()}</span>
      <div class="who-text">
        <span class="name">{chat.npcName}</span>
        <span class="sub">Conversation en direct</span>
      </div>
    </div>
    {#if chat.review}
      <span class="review-badge">Résumé prêt</span>
    {:else if chat.busy}
      <button type="button" class="btn btn-secondary" on:click={() => play.cancelChatReply()}>Interrompre</button>
    {:else}
      <button type="button" class="btn btn-secondary" on:click={() => play.endChat()}>Terminer</button>
    {/if}
  </header>

  <div class="thread" bind:this={threadEl}>
    {#if !chat.turns.length && !chat.partial}
      <p class="opener">Tu engages la conversation avec <strong>{chat.npcName}</strong>. Écris ce que tu veux lui dire.</p>
    {/if}
    {#each chat.turns as turn, i (i)}
      <div class="bubble {turn.speaker}">{turn.content}</div>
    {/each}
    {#if chat.partial}
      <div class="bubble npc">{chat.partial}<span class="caret">▍</span></div>
    {:else if chat.busy}
      <div class="bubble npc typing"><span></span><span></span><span></span></div>
    {/if}
    {#if chat.review}
      <article class="review-card">
        <span class="eyebrow">Résumé de conversation à valider</span>
        <h3>{chat.review.result.chapter.chapter_title}</h3>
        <p>{chat.review.result.chapter.narrative.action}</p>
        {#if chat.review.result.chapter.memory_updates.notes.length}
          <h4>Faits retenus</h4>
          <ul>{#each chat.review.result.chapter.memory_updates.notes as note}<li>{note}</li>{/each}</ul>
        {/if}
        {#if chat.review.result.chapter.state_update?.campaign_update?.progress}
          <p class="review-progress"><strong>Fil rouge :</strong> {chat.review.result.chapter.state_update.campaign_update.progress}</p>
        {/if}
        <p class="review-hint">Rien n'est gravé dans le monde avant ta validation.</p>
      </article>
    {/if}
    {#if chat.error}<p class="chat-error">{chat.error}</p>{/if}
  </div>

  {#if chat.review}
    <div class="review-actions">
      <button type="button" class="btn btn-secondary" on:click={() => play.discardChatReview()}>Annuler les conséquences</button>
      <button type="button" class="btn btn-primary" on:click={() => play.confirmChatReview()}>Valider le résumé</button>
    </div>
  {:else}
    <form class="composer" on:submit|preventDefault={send}>
      <input class="input" bind:value={draft} placeholder={`Réponds à ${chat.npcName}…`} disabled={chat.busy} />
      <button type="submit" class="btn btn-primary" disabled={chat.busy || !draft.trim()}>Envoyer</button>
    </form>
  {/if}
</section>

<style>
  .chat {
    width: 100%;
    max-width: 64ch;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 2 * var(--header-height));
    height: calc(100dvh - 2 * var(--header-height));
    padding: var(--space-md) var(--space-lg) var(--space-lg);
    animation: fadeIn var(--transition-normal) ease;
  }

  .chat-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); padding-bottom: var(--space-md); border-bottom: 1px solid var(--border-subtle); }
  .who { display: flex; align-items: center; gap: var(--space-sm); min-width: 0; }
  .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); color: var(--npc-tint); background: color-mix(in srgb, var(--npc-tint) 12%, transparent); border: 1px solid var(--npc-tint); }
  .who-text { display: flex; flex-direction: column; min-width: 0; }
  .name { font-family: var(--font-display); font-size: 1.05rem; color: var(--color-text-primary); }
  .sub { font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-text-muted); }
  .review-badge { color: var(--color-gold); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .thread { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-sm); padding: var(--space-lg) 0; }
  .opener { color: var(--color-text-muted); font-style: italic; text-align: center; margin: auto 0; }

  .bubble {
    max-width: 82%;
    padding: 11px 15px;
    border-radius: var(--radius-lg);
    font-family: var(--font-narrative);
    font-size: 1rem;
    line-height: 1.55;
    white-space: pre-wrap;
    animation: slideUp var(--transition-fast) ease;
  }
  .bubble.player { align-self: flex-end; background: rgba(216,185,119,0.14); border: 1px solid var(--color-gold-dim); color: var(--color-text-primary); border-bottom-right-radius: var(--radius-sm); }
  .bubble.npc { align-self: flex-start; background: var(--surface-glass); border: 1px solid var(--color-border); border-left: 2px solid var(--npc-tint); color: var(--color-text-secondary); border-bottom-left-radius: var(--radius-sm); }
  .caret { color: var(--color-gold); animation: pulse 1s steps(2) infinite; }

  .typing { display: inline-flex; gap: 4px; }
  .typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--color-text-muted); animation: pulse 1.2s ease-in-out infinite; }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }

  .chat-error { color: var(--color-red); font-size: 0.85rem; text-align: center; }
  .review-card { margin: auto 0; padding: var(--space-lg); border: 1px solid rgba(216,185,119,0.4); border-radius: var(--radius-md); background: rgba(216,185,119,0.06); }
  .review-card h3 { margin: 6px 0 8px; font-family: var(--font-display); color: var(--color-text-primary); }
  .review-card p { color: var(--color-text-secondary); line-height: 1.5; }
  .review-card h4 { margin: var(--space-md) 0 5px; color: var(--color-gold); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; }
  .review-card ul { margin: 0; padding-left: 1.1rem; color: var(--color-text-secondary); font-family: var(--font-narrative); }
  .review-progress { border-left: 2px solid var(--color-gold-dim); padding-left: 9px; }
  .review-hint { font-size: 0.78rem; font-style: italic; color: var(--color-gold) !important; }
  .review-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); padding-top: var(--space-md); padding-bottom: var(--sab); border-top: 1px solid var(--border-subtle); }
  .composer { display: flex; gap: var(--space-sm); padding-top: var(--space-md); padding-bottom: var(--sab); border-top: 1px solid var(--border-subtle); }
  @media (max-width: 768px) {
    .chat { padding: var(--space-sm) var(--space-md) var(--space-md); height: calc(100dvh - var(--header-height)); }
    .chat-head { flex-wrap: wrap; gap: var(--space-sm); }
    .bubble { max-width: 90%; font-size: 0.95rem; }
    .composer { flex-direction: column; }
    .composer .input { width: 100%; }
    .composer .btn { width: 100%; }
    .avatar { width: 34px; height: 34px; font-size: 0.75rem; }
    .name { font-size: 0.95rem; }
  }
  .composer .input { flex: 1; }
</style>
