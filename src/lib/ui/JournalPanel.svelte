<script lang="ts">
  import { memoryCategoryLabel, MEMORY_CATEGORIES, type MemoryFact, type StoryChapter, type WorldState } from '$lib/engine';

  export let world: WorldState;
  export let chapters: StoryChapter[] = [];
  export let memory: MemoryFact[] = [];
  export let onClose: () => void;

  type Tab = 'chapitres' | 'chronologie' | 'personnages' | 'monde' | 'memoire';
  let tab: Tab = 'chapitres';

  $: pastChapters = [...chapters].reverse();
  $: timeline = [...world.chronology].reverse();
  $: npcs = [...world.npcs].sort((a, b) => {
    if ((a.alive !== false) !== (b.alive !== false)) return a.alive !== false ? -1 : 1;
    return Math.abs(b.affinity) - Math.abs(a.affinity);
  });
  // The AI's structured memory, grouped by category (newest facts first).
  $: memoryGroups = MEMORY_CATEGORIES
    .map((category) => ({
      category,
      label: memoryCategoryLabel(category),
      facts: memory.filter((f) => f.category === category).slice().sort((a, b) => b.turn - a.turn)
    }))
    .filter((g) => g.facts.length > 0);

  function excerpt(chapter: StoryChapter): string {
    const text = chapter.narrative.action.split(/\n{2,}/)[0]?.trim() ?? '';
    return text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text;
  }

  function npcTag(status: string, alive: boolean | undefined): string {
    if (alive === false || status === 'dead') return 'mort';
    if (status === 'ally') return 'allié';
    if (status === 'hostile') return 'hostile';
    return 'neutre';
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div
  class="overlay"
  role="presentation"
  on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <section class="journal" aria-label="Journal de bord">
    <header class="head">
      <div>
        <p class="eyebrow">Journal de bord</p>
        <h2 class="title">{world.player.date}</h2>
      </div>
      <button type="button" class="icon-btn" on:click={onClose} aria-label="Fermer le journal">✕</button>
    </header>

    <nav class="tabs">
      <button type="button" class="tab" class:active={tab === 'chapitres'} on:click={() => (tab = 'chapitres')}>Chapitres</button>
      <button type="button" class="tab" class:active={tab === 'chronologie'} on:click={() => (tab = 'chronologie')}>Chronologie</button>
      <button type="button" class="tab" class:active={tab === 'personnages'} on:click={() => (tab = 'personnages')}>Personnages</button>
      <button type="button" class="tab" class:active={tab === 'monde'} on:click={() => (tab = 'monde')}>Monde</button>
      <button type="button" class="tab" class:active={tab === 'memoire'} on:click={() => (tab = 'memoire')}>Mémoire</button>
    </nav>

    <div class="body">
      {#if tab === 'chapitres'}
        {#if !pastChapters.length}
          <p class="empty">L'histoire ne fait que commencer.</p>
        {/if}
        {#each pastChapters as chapter (chapter.chapter_number)}
          <article class="entry">
            <header class="entry-head">
              <span class="num">{chapter.chapter_number}</span>
              <h3 class="entry-title">{chapter.chapter_title}</h3>
              <span class="chip">{chapter.section_type}</span>
            </header>
            {#if excerpt(chapter)}<p class="entry-text">{excerpt(chapter)}</p>{/if}
          </article>
        {/each}
      {:else if tab === 'chronologie'}
        {#if !timeline.length}
          <p class="empty">Aucun événement consigné pour l'instant.</p>
        {/if}
        {#each timeline as event (event.chapter)}
          <article class="entry timeline">
            <header class="entry-head">
              <span class="num">{event.chapter}</span>
              <h3 class="entry-title">{event.summary}</h3>
            </header>
            <p class="entry-meta">{event.date} · {event.location}</p>
          </article>
        {/each}
      {:else if tab === 'monde'}
        {#if world.campaign}
          <article class="entry campaign-entry">
            <p class="eyebrow">Fil rouge</p>
            <h3 class="entry-title">{world.campaign.title}</h3>
            <p class="entry-text"><strong>Objectif :</strong> {world.campaign.objective}</p>
            <p class="entry-text"><strong>Progression :</strong> {world.campaign.progress}</p>
            <span class="chip">{world.campaign.status}</span>
          </article>
        {/if}
        {#if world.environment_status}
          <article class="entry">
            <p class="eyebrow">État de l'environnement</p>
            <p class="entry-text">{world.environment_status}</p>
          </article>
        {/if}
        {#if world.campaign?.dossier}
          <!-- Generated once at turn 1 and used by every prompt since; the
               player had no way to read the world they are playing in. -->
          <article class="entry">
            <p class="eyebrow">Dossier de campagne</p>
            <p class="entry-text dossier">{world.campaign.dossier}</p>
          </article>
        {/if}
        {#if !world.world_events?.length}
          <p class="empty">Le monde n'a pas encore bougé hors champ.</p>
        {/if}
        {#each world.world_events ?? [] as event (event.turn + event.summary)}
          <article class="entry">
            <header class="entry-head"><span class="num">T{event.turn}</span><h3 class="entry-title">{event.summary}</h3></header>
            <p class="entry-meta">{event.date}</p>
          </article>
        {/each}
      {:else if tab === 'memoire'}
        {#if !memoryGroups.length}
          <p class="empty">La mémoire de la campagne est encore vierge.</p>
        {/if}
        {#each memoryGroups as group (group.category)}
          <article class="entry">
            <header class="entry-head">
              <h3 class="entry-title">{group.label}</h3>
              <span class="chip">{group.facts.length}</span>
            </header>
            <ul class="facts">
              {#each group.facts as fact (fact.text)}
                <li class="fact">
                  {#if fact.turn > 0}<span class="fact-turn">T{fact.turn}</span>{/if}
                  <span class="fact-text">{fact.text}</span>
                </li>
              {/each}
            </ul>
          </article>
        {/each}
      {:else}
        {#if !npcs.length}
          <p class="empty">Aucun personnage rencontré pour l'instant.</p>
        {/if}
        {#each npcs as npc (npc.name)}
          <article class="entry npc" class:dead={npc.alive === false}>
            <header class="entry-head">
              <h3 class="entry-title">{npc.name}</h3>
              <span class="chip {npcTag(npc.status, npc.alive)}">{npcTag(npc.status, npc.alive)}</span>
              {#if npc.alive !== false}<span class="affinity">{npc.affinity > 0 ? '+' : ''}{npc.affinity}</span>{/if}
            </header>
            <p class="entry-meta">
              {#if npc.faction}{npc.faction}{/if}
              {#if npc.faction && npc.last_seen} · {/if}
              {#if npc.last_seen}vu : {npc.last_seen}{/if}
            </p>
            {#if npc.note}<p class="entry-text">{npc.note}</p>{/if}
          </article>
        {/each}
      {/if}
    </div>
  </section>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    padding: calc(var(--space-lg) + var(--sat)) calc(var(--space-lg) + var(--sar)) calc(var(--space-lg) + var(--sab)) calc(var(--space-lg) + var(--sal));
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    animation: fadeIn var(--transition-fast) ease;
  }

  .journal {
    width: min(720px, 100%);
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    background: var(--surface-glass-strong);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
    animation: slideUp var(--transition-normal) ease;
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-lg) var(--space-lg) var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
  }
  .title { font-family: var(--font-display); color: var(--color-gold); font-size: 1.25rem; letter-spacing: 0.04em; }
  .icon-btn {
    width: 36px; height: 36px; flex: 0 0 auto;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-text-secondary); background: transparent;
    border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;
  }
  .icon-btn:hover { color: var(--color-text-primary); border-color: var(--color-border-hover); }

  .tabs { display: flex; gap: var(--space-xs); padding: var(--space-sm) var(--space-lg) 0; }
  .tab {
    padding: 8px 14px;
    font-family: var(--font-body);
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tab:hover { color: var(--color-text-secondary); }
  .tab.active { color: var(--color-gold); border-bottom-color: var(--color-gold); }

  .body { flex: 1; overflow-y: auto; padding: var(--space-md) var(--space-lg) var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm); }
  .empty { color: var(--color-text-muted); font-style: italic; text-align: center; padding: var(--space-xl) 0; }

  .entry {
    padding: 12px 16px;
    background: var(--surface-glass);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }
  .entry.dead { opacity: 0.55; }
  .entry-head { display: flex; align-items: baseline; gap: var(--space-sm); flex-wrap: wrap; }
  .num {
    font-family: var(--font-display);
    color: var(--color-gold-dim);
    font-size: 0.85rem;
    min-width: 1.6em;
  }
  .entry-title { font-family: var(--font-display); font-size: 1rem; color: var(--color-text-primary); }
  .chip {
    margin-left: auto;
    padding: 2px 10px;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
  }
  .chip.allié { color: var(--color-gold); border-color: var(--color-gold-dim); }
  .chip.hostile { color: var(--color-red); border-color: var(--color-red); }
  .chip.mort { text-decoration: line-through; }
  .affinity { font-size: 0.8rem; color: var(--color-text-muted); }
  .entry-meta { margin-top: 4px; font-size: 0.78rem; color: var(--color-text-muted); }
  .dossier { white-space: pre-wrap; }
  .entry-text { margin-top: 6px; font-family: var(--font-narrative); font-size: 0.92rem; line-height: 1.5; color: var(--color-text-secondary); }

  .facts { list-style: none; margin-top: var(--space-sm); display: flex; flex-direction: column; gap: 6px; }
  .fact { display: flex; align-items: baseline; gap: var(--space-sm); }
  .fact-turn {
    flex: 0 0 auto;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: var(--color-gold-dim);
    min-width: 2.2em;
  }
  .fact-text { font-family: var(--font-narrative); font-size: 0.9rem; line-height: 1.5; color: var(--color-text-secondary); }

  @media (max-width: 768px) {
    .overlay { padding: 0; }
    .journal { width: 100%; max-height: 100dvh; max-height: 100vh; border-radius: 0; }
    .head { padding: calc(var(--space-md) + var(--sat)) var(--space-md) var(--space-md); }
    .tabs { padding: var(--space-xs) var(--space-md) 0; overflow-x: auto; white-space: nowrap; }
    .tab { padding: 10px 12px; font-size: 0.75rem; }
    .body { padding: var(--space-md); }
    .icon-btn { width: 44px; height: 44px; }
  }
</style>
