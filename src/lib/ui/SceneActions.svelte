<script lang="ts">
  /* What the player can do next: the choices with their risk/tradeoff, the
     free-action field, the "talk to" offers, and the recoverable-error card
     that keeps a failed action replayable. */
  import { play } from '$lib/stores/play';
  import { choiceRisk, hasRequiredItems, type StoryChapter, type StoryChoice } from '$lib/engine';
  import { foldText } from '$lib/engine/text';

  export let chapter: StoryChapter;

  let freeText = '';

  const ATTR_LABELS: Record<string, string> = {
    combat: 'Combat', diplomacy: 'Diplomatie', stealth: 'Furtivité',
    tech: 'Technologie', force: 'Force', survival: 'Survie'
  };
  const RISK_LABELS: Record<string, string> = { low: 'Risque faible', medium: 'Risque modéré', high: 'Risque élevé' };

  function choiceRiskFor(choice: StoryChoice): 'low' | 'medium' | 'high' {
    const world = $play.worldState;
    const skill = world?.player.skills?.[choice.attribute] ?? 2;
    const available = world ? hasRequiredItems(world, choice) : false;
    return choiceRisk(choice, skill, available);
  }

  function editPendingAction(): void {
    freeText = play.editPendingAction();
  }

  $: generating = $play.status === 'generating';
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

        {#if $play.status === 'error'}
          <div class="turn-error">
            <strong>La scène n'a pas avancé.</strong>
            <span>{$play.error}</span>
            {#if $play.pendingAction}<small>Action conservée : « {$play.pendingAction.text} »</small>{/if}
            <div class="error-actions">
              <button type="button" class="btn btn-secondary" on:click={editPendingAction}>Modifier l'action</button>
              <button type="button" class="btn btn-primary" on:click={() => play.retry()}>Réessayer</button>
            </div>
          </div>
        {/if}
        <div class="choices">
          {#each chapter.choices as choice}
            {@const risk = choiceRiskFor(choice)}
            {@const available = $play.worldState ? hasRequiredItems($play.worldState, choice) : false}
            {@const skill = $play.worldState?.player.skills?.[choice.attribute] ?? 2}
            <button type="button" class="choice" class:unavailable={!available} on:click={() => play.chooseChoice(choice)} disabled={generating || $play.status === 'error' || !available}>
              <span class="choice-text">
                {choice.text}
                {#if choice.tradeoff}<span class="choice-tradeoff">Arbitrage : {choice.tradeoff}</span>{/if}
                {#if choice.requires_items?.length}<span class="choice-item">Objet : {choice.requires_items.join(', ')}{choice.consumes_items?.length ? ' · consommé' : ''}</span>{/if}
              </span>
              <span class="choice-meta">
                <span class="choice-attr">{ATTR_LABELS[choice.attribute] ?? choice.attribute} · {skill}/5</span>
                <span class="risk {risk}">{RISK_LABELS[risk]}</span>
              </span>
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
                <button type="button" class="talk-btn" on:click={() => play.enterChat(name)} disabled={generating || $play.status === 'error'}>
                  💬 Parler à {name}
                </button>
              {/each}
            </div>
          </div>
        {/if}

<style>
  .choices { display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-xl); }
  .choice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
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
  .choice-text { flex: 1; display: flex; flex-direction: column; gap: 5px; }
  .choice-tradeoff, .choice-item { display: block; font-size: 0.76rem; color: var(--color-text-muted); line-height: 1.35; }
  .choice-tradeoff { color: var(--color-gold); }
  .choice-item { color: var(--color-blue); }
  .choice.unavailable { opacity: 0.42; cursor: not-allowed; }
  .choice-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex: 0 0 auto; }
  .choice-attr {
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .risk { font-size: 0.66rem; padding: 3px 7px; border-radius: 99px; white-space: nowrap; border: 1px solid var(--color-border); color: var(--color-text-secondary); }
  .risk.low { color: var(--color-green); border-color: rgba(143,206,154,0.45); background: rgba(143,206,154,0.08); }
  .risk.medium { color: var(--color-gold); border-color: rgba(216,185,119,0.45); background: rgba(216,185,119,0.08); }
  .risk.high { color: var(--color-red); border-color: rgba(215,107,107,0.45); background: rgba(215,107,107,0.08); }

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

  .turn-error { margin-top: var(--space-xl); padding: var(--space-lg); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: var(--space-sm); }
  .turn-error { border-color: rgba(215,107,107,0.45); background: rgba(215,107,107,0.06); color: var(--color-text-secondary); }
  .turn-error strong { color: var(--color-red); }
  .turn-error small { color: var(--color-text-muted); font-style: italic; }
  .error-actions { display: flex; gap: var(--space-sm); }

  @media (max-width: 768px) {
    .choice { padding: 16px 16px; font-size: 0.95rem; flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
    .choice-meta { flex-direction: row; align-items: center; gap: var(--space-sm); }
    .free { flex-direction: column; }
    .free .input { width: 100%; }
    .talk-actions { flex-direction: column; }
    .talk-btn { width: 100%; justify-content: center; padding: 14px; }
  }
</style>
