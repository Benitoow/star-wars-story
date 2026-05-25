<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import {
    story,
    saveStory,
    createStory,
    loadStory,
    currentSetup,
    updateSetupField,
    updateContent,
    updateTitle,
    startAutoSave,
    stopAutoSave,
    resetEditor,
    type StorySetup
  } from '$lib/stores/editor';
  import SetupWizard from '$lib/components/editor/SetupWizard.svelte';
  import { showToast } from '$lib/stores/ui';
  import { logger } from '$lib/utils/logger';
  import { getPreferences, type UserPreferences } from '$lib/db';
  import { resolveUiLanguage } from '$lib/config/languages';
  import SvgIcon from '$lib/components/SvgIcon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import GameHUD from '$lib/components/GameHUD.svelte';
  import SceneBackdrop from '$lib/components/SceneBackdrop.svelte';
  import {
    defaultRoleForFaction,
    withSetupDefaults,
    AVATARS,
    CONTENT_MODES,
    ERAS,
    FACTIONS,
    ROLES,
    SETUP_SCREENS,
    TRAMES,
    WRITING_LENGTHS,
    WRITING_POVS,
    WRITING_STYLES,
    WRITING_TONES
  } from '$lib/editor/setupCatalog';
  import {
    clearInteractiveSessionPayload,
    loadInteractiveSessionPayload,
    saveInteractiveSessionPayload,
    type InteractiveSessionPayload,
    type LoggedBackgroundEvent
  } from '$lib/editor/interactiveSession';
  import {
    applyBackgroundWorldEventToRuntime,
    archiveOldTurnsIfNeeded,
    appendMemoryFromChapter,
    buildStoredAssistantContent,
    buildCanonicalIdentityFacts,
    describeStoryOrchestration,
    ensureCanonicalIdentityMemory,
    getVisibleBackgroundEvents,
    INTENSE_SECTION_TYPES,
    normalizeMemoryFacts
  } from '$lib/editor/storyRuntime';
  import {
    buildSceneAnchor,
    enforceTransitionChoiceQuality,
    isNearDuplicateBackgroundEvent,
    planDialogueDisplay,
    sanitizeNarrativeTextForDisplay,
    sanitizeChapterForDisplay,
    sanitizeChapterList,
    splitNarrativeParagraphs
  } from '$lib/editor/narrativeGuardrails';
  import {
    buildJournalContent,
    buildStoryTitle
  } from '$lib/editor/storyJournal';
  import {
    buildContinuePrompt,
    buildStartPrompt,
    buildSystemPrompt,
    generateBackgroundWorldEvent,
    generateStoryTurn,
    generateStoryTurnStructured,
    normalizeProviderId,
    normalizeStoryGenerationMode,
    summarizeChapterForPrompt,
    type BackgroundWorldEvent,
    type ChatMessage,
    type StoryChapter,
    type StoryChoice,
    type StoryGenerationMode,
    type StoryProviderConfig,
    type WorldState
  } from '$lib/ai/storyEngine';
  import {
    applyStateUpdateToWorldState,
    initWorldState,
    rebuildWorldStateFromHistory,
    worldStateNeedsRepair
  } from '$lib/editor/worldStateReducer';
  import {
    buildOutcomeDirective,
    resolveChoiceOutcome,
    situationalDifficultyPenalty
  } from '$lib/editor/choiceResolution';

  let loading = true;
  let saving = false;
  let mode: 'setup' | 'play' = 'setup';
  let storyId: string | null = null;

  let setupScreenIndex = 0;
  let setupSlideDir = 1;
  let selectedTrame: string | null = null;

  let generating = false;
  let generationError = '';
  let turnNumber = 0;
  let currentChapter: StoryChapter | null = null;
  let dialogueDisplay: ReturnType<typeof planDialogueDisplay> = { actionParagraphs: [], dialogueParagraphs: [] };
  let actionTagLabel = 'Action';
  let chapterHistory: StoryChapter[] = [];
  let actionHistory: string[] = [];
  let aiMessages: ChatMessage[] = [];
  let memoryLog: string[] = [];
  let backgroundEvents: LoggedBackgroundEvent[] = [];
  let visibleBackgroundEvents: LoggedBackgroundEvent[] = [];
  let campaignArchive: string[] = [];
  let customAction = '';
  let hudCollapsed = false;
  let storyRuntimeMode: string | null = 'agentic-subagents';
  let preferredTextRuntimeMode: StoryGenerationMode = 'agentic-subagents';
  let resolvedLanguage = 'fr';
  const BACKGROUND_WORLD_EVERY = 3;

  let worldState: WorldState = {
    player: { hp: 100, credits: 1000, location: 'Secteur frontalier', date: '', injuries: [], inventory: [] },
    npcs: [],
    factions: {},
    chronology: [],
    clocks: {},
    sector_influence: {},
    rumors: []
  };

  function applyStateUpdate(chapter: StoryChapter): void {
    const setup = get(currentSetup);
    const protagonistNames = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean) as string[];
    worldState = applyStateUpdateToWorldState(worldState, chapter, protagonistNames.length ? protagonistNames : undefined);
  }

  // Mechanical consequences: returns display modifiers for a choice
  function choiceConsequences(choice: StoryChoice): { warning: string; diffBonus: number; disabled: boolean } {
    let warning = '';
    let disabled = false;

    const critical = worldState.player.hp < 20;
    const heavyInjury = worldState.player.injuries.some(i => i.severity === 'severe');
    const broke = worldState.player.credits <= 0;
    const diffBonus = situationalDifficultyPenalty(choice, worldState.player);

    if (critical && (choice.attribute === 'combat' || choice.attribute === 'force')) {
      warning = '⚠ État critique';
    } else if (heavyInjury && (choice.attribute === 'combat' || choice.attribute === 'stealth')) {
      warning = '⚠ Blessure grave';
    }

    if (broke) {
      const payWords = ['payer', 'acheter', 'crédits', 'louer', 'soudoyer', 'corrompre', 'prix', 'coût'];
      if (payWords.some(w => choice.text.toLowerCase().includes(w))) {
        warning = '✖ Sans crédits';
        disabled = true;
      }
    }

    return { warning, diffBonus, disabled };
  }

  let providerConfig: StoryProviderConfig | null = null;
  let providerStatus = 'Aucun provider texte configuré.';
  let storyOrchestration = describeStoryOrchestration(storyRuntimeMode);


  $: providerMissing = !providerConfig;
  $: storyOrchestration = describeStoryOrchestration(storyRuntimeMode);
  $: providerStatus = providerSummary(providerConfig, storyRuntimeMode);
  $: dialogueDisplay = currentChapter
    ? planDialogueDisplay(currentChapter)
    : { actionParagraphs: [], dialogueParagraphs: [] };
  $: actionTagLabel = currentChapter?.narrative.action ? 'Action' : 'Scène';
  $: visibleBackgroundEvents = getVisibleBackgroundEvents(backgroundEvents);
  $: currentRoleLabel = ROLES.find(role => role.id === $currentSetup.role)?.name || $currentSetup.role || '';
  $: currentFactionLabel = FACTIONS.find(faction => faction.id === $currentSetup.faction)?.name || $currentSetup.faction || '';

  function saveInteractiveSession(): Promise<void> {
    const payload: InteractiveSessionPayload = {
      version: 2,
      turnNumber,
      selectedTrame,
      storyRuntimeMode,
      currentChapter,
      chapterHistory,
      actionHistory,
      aiMessages,
      memoryLog,
      backgroundEvents,
      setupSnapshot: get(currentSetup),
      worldState,
      campaignArchive
    };

    return saveInteractiveSessionPayload(storyId, payload);
  }

  function flushInteractiveState(): void {
    const setup = ensureSetupDefaults();
    updateTitle(buildStoryTitle(setup));
    updateContent(buildJournalContent(chapterHistory));
    void saveInteractiveSession();

    if (storyId) {
      void saveStory().catch(error => {
        logger.warn('editor: flush de sortie partiellement échoué.', error);
      });
    }
  }

  function loadInteractiveSession(id: string): Promise<InteractiveSessionPayload | null> {
    return loadInteractiveSessionPayload(id, get(currentSetup));
  }

  function clearInteractiveSession(id: string): void {
    void clearInteractiveSessionPayload(id);
  }

  function setSetupField<K extends keyof StorySetup>(field: K, value: StorySetup[K]): void {
    const current = get(currentSetup)[field];
    if (current !== value) {
      updateSetupField(field, value);
    }
  }

  function ensureSetupDefaults(): StorySetup {
    const setup = get(currentSetup);
    const next = withSetupDefaults(setup, selectedTrame);

    setSetupField('era', next.era);
    setSetupField('faction', next.faction);
    setSetupField('role', next.role);
    setSetupField('premise', next.premise);
    setSetupField('writingStyle', next.writingStyle);
    setSetupField('writingTone', next.writingTone);
    setSetupField('writingPov', next.writingPov);
    setSetupField('writingLength', next.writingLength);
    setSetupField('contentMode', next.contentMode);
    setSetupField('protagonistAvatar', next.protagonistAvatar);

    return next;
  }

  function applySetupDefaultsFromPreferences(preferences: UserPreferences): void {
    const setup = get(currentSetup);

    if (!setup.protagonistFirstName && preferences.firstName) updateSetupField('protagonistFirstName', preferences.firstName);
    if (!setup.protagonistLastName && preferences.lastName) updateSetupField('protagonistLastName', preferences.lastName);
    if (!setup.protagonistAvatar && preferences.avatarEmoji) updateSetupField('protagonistAvatar', preferences.avatarEmoji);

    if (!setup.writingStyle && preferences.writingStyle) updateSetupField('writingStyle', preferences.writingStyle);
    if (!setup.writingTone && preferences.writingTone) updateSetupField('writingTone', preferences.writingTone);
    if (!setup.writingPov && preferences.writingPov) updateSetupField('writingPov', preferences.writingPov);
    if (!setup.writingLength && preferences.writingLength) updateSetupField('writingLength', preferences.writingLength);
    if (!setup.contentMode && preferences.contentMode) updateSetupField('contentMode', preferences.contentMode);
  }

  function buildProviderConfigFromPreferences(preferences: UserPreferences): StoryProviderConfig | null {
    const providerId = normalizeProviderId(preferences.textProvider);
    if (!providerId || providerId === 'none') return null;

    const model = (preferences.textModel || '').trim();

    return {
      providerId,
      model,
      apiKey: (preferences.textApiKey || '').trim(),
      ollamaUrl: (preferences.ollamaUrl || '').trim(),
      reasoningEffortOverride: preferences.textReasoningEffort || undefined
    };
  }

  async function refreshRuntimePreferences(): Promise<UserPreferences> {
    const preferences = await getPreferences();
    applySetupDefaultsFromPreferences(preferences);
    providerConfig = buildProviderConfigFromPreferences(preferences);
    preferredTextRuntimeMode = normalizeStoryGenerationMode(preferences.textRuntimeMode);
    resolvedLanguage = resolveUiLanguage(preferences.uiLanguage);

    return preferences;
  }

  function providerSummary(config: StoryProviderConfig | null, runtimeMode: string | null): string {
    if (!config) return 'Aucun provider texte configuré.';
    const modelLabel = config.model || 'modèle auto';
    const modeLabel = ` · ${describeStoryOrchestration(runtimeMode).summaryLabel}`;
    return `${config.providerId} · ${modelLabel}${modeLabel}`;
  }

  function resolvePromptMode(): 'json' {
    return 'json';
  }

  function trimMessages(messages: ChatMessage[], maxWithoutSystem = 80): ChatMessage[] {
    const systemMessage = messages.find(message => message.role === 'system');
    const others = messages.filter(message => message.role !== 'system').slice(-maxWithoutSystem);
    return systemMessage ? [systemMessage, ...others] : others;
  }

  async function runBackgroundWorldTick(setup: StorySetup, turn: number, recentSectionTypes: string[] = []): Promise<void> {
    if (!providerConfig) return;

    // Throttle: the off-screen simulation is expensive (2 extra LLM calls). Only run it
    // periodically instead of every turn.
    if (turn % BACKGROUND_WORLD_EVERY !== 0) return;

    const sectionWindow = recentSectionTypes.length
      ? recentSectionTypes.slice(-2)
      : chapterHistory.slice(-2).map(chapter => chapter.section_type);
    if (sectionWindow.length === 2 && sectionWindow.every(type => INTENSE_SECTION_TYPES.has(type))) return;

    const recentSummary = chapterHistory.slice(-4).map(chapter => summarizeChapterForPrompt(chapter));
    const recentBackgroundEvents = backgroundEvents
      .slice(0, 6)
      .map(event => ({ title: event.title, summary: event.summary }));

    try {
      const generation = await generateBackgroundWorldEvent(
        {
          setup,
          worldState,
          memoryFacts: memoryLog,
          recentSummary,
          recentBackgroundEvents,
          turnNumber: turn
        },
        providerConfig,
        resolvedLanguage
      );

      const event = generation.event;
      if (!event) return;
      if (isNearDuplicateBackgroundEvent(event, backgroundEvents)) return;

      // The tick runs non-blocking: drop its result if the player already advanced to a
      // newer turn (or one is in flight), to avoid clobbering fresher world state.
      if (generating || turnNumber !== turn) return;

      const applied = applyBackgroundWorldEventToRuntime(worldState, memoryLog, backgroundEvents, event, turn);
      worldState = applied.worldState;
      memoryLog = applied.memoryLog;
      backgroundEvents = applied.backgroundEvents;

      if (applied.loggedEvent.visibleNow && applied.loggedEvent.summary) {
        showToast(`Événement galactique: ${applied.loggedEvent.summary}`, 'warning');
      }

      void saveInteractiveSession();
    } catch (error) {
      logger.warn('editor: tick hors-écran ignoré.', error);
    }
  }

  async function persistInteractiveState(setup: StorySetup): Promise<void> {
    updateTitle(buildStoryTitle(setup));
    updateContent(buildJournalContent(chapterHistory));
    await saveInteractiveSession();

    if (storyId) {
      await saveStory();
    }
  }

  async function ensureStoryExists(setup: StorySetup): Promise<string> {
    if (storyId) return storyId;

    const createdStory = await createStory(setup);
    storyId = createdStory.id;
    await goto(`/editor/${createdStory.id}`, { replaceState: true, noScroll: true, keepFocus: true });
    return createdStory.id;
  }

  async function requestStoryChapter(prompt: string, setup: StorySetup, turn: number): Promise<StoryChapter> {
    await refreshRuntimePreferences();

    if (!providerConfig) {
      throw new Error('Aucun provider IA configuré. Ouvre les paramètres IA texte.');
    }

    ({ aiMessages, campaignArchive } = archiveOldTurnsIfNeeded(chapterHistory, aiMessages, campaignArchive));

    const promptMode = resolvePromptMode();
    const memoryFactsForPrompt = Array.from(new Set([
      ...buildCanonicalIdentityFacts(setup),
      ...memoryLog
    ]));
    const systemPrompt = buildSystemPrompt(setup, memoryFactsForPrompt, worldState, promptMode, campaignArchive, resolvedLanguage, turn);
    aiMessages = [{ role: 'system', content: systemPrompt }, ...aiMessages.filter(message => message.role !== 'system')];

    const requestMessages = trimMessages([
      ...aiMessages,
      { role: 'user', content: prompt }
    ]);

    const generation = preferredTextRuntimeMode === 'structured-json'
      ? await generateStoryTurnStructured(requestMessages, providerConfig, turn, resolvedLanguage)
      : await generateStoryTurn(requestMessages, providerConfig, turn, {}, resolvedLanguage, setup);
    storyRuntimeMode = generation.mode;
    const chapter = sanitizeChapterForDisplay(enforceTransitionChoiceQuality(generation.chapter, worldState)) as StoryChapter;
    const assistantContent = buildStoredAssistantContent(chapter, generation.mode, generation.rawResponse);

    aiMessages = trimMessages([
      ...requestMessages,
      { role: 'assistant', content: assistantContent }
    ]);

    return chapter;
  }

  async function launchAdventure(): Promise<void> {
    if (generating) return;

    generationError = '';
    const setup = ensureSetupDefaults();

    if (!providerConfig) {
      generationError = 'Aucun provider IA texte configuré. Ouvre les paramètres pour en choisir un.';
      showToast('Configurez votre IA texte dans Paramètres.', 'warning');
      return;
    }

    generating = true;

    try {
      await ensureStoryExists(setup);

      turnNumber = 1;
      currentChapter = null;
      chapterHistory = [];
      actionHistory = [];
      aiMessages = [];
      memoryLog = [];
      backgroundEvents = [];
      campaignArchive = [];
      customAction = '';
      worldState = initWorldState(setup);
      memoryLog = ensureCanonicalIdentityMemory(memoryLog, setup);

      const trameLabel = TRAMES.find(item => item.id === selectedTrame)?.name || null;
      const prompt = buildStartPrompt(setup, trameLabel, resolvePromptMode(), resolvedLanguage);
      const chapter = await requestStoryChapter(prompt, setup, 1);

      currentChapter = chapter;
      chapterHistory = [chapter];
      actionHistory = ['Prologue IA'];

      applyStateUpdate(chapter);
      memoryLog = appendMemoryFromChapter(memoryLog, chapter);
      ({ aiMessages, campaignArchive } = archiveOldTurnsIfNeeded(chapterHistory, aiMessages, campaignArchive));
      await persistInteractiveState(setup);

      mode = 'play';
      showToast('Aventure IA lancée.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      generationError = message;
      showToast(`Impossible de lancer l'aventure: ${message}`, 'error');
    } finally {
      generating = false;
    }
  }

  async function continueAdventure(actionText: string, choice?: StoryChoice): Promise<void> {
    const action = actionText.trim();
    if (!action || generating) return;

    const setup = ensureSetupDefaults();
    generationError = '';
    generating = true;

    const outcomeDirective = choice
      ? buildOutcomeDirective(
          resolveChoiceOutcome(choice, {
            role: setup.role,
            situationPenalty: situationalDifficultyPenalty(choice, worldState.player)
          }).verdict
        )
      : '';

    try {
      await ensureStoryExists(setup);

      const nextTurn = turnNumber + 1;
      const recentSummary = chapterHistory.slice(-10).map(chapter => summarizeChapterForPrompt(chapter));
      const recentSectionTypes = chapterHistory.slice(-6).map(c => c.section_type).filter(Boolean);
      const recentChoiceTexts = chapterHistory
        .slice(-10)
        .flatMap(chapter => chapter.choices.map(choice => choice.text));

      const lastChapter = chapterHistory[chapterHistory.length - 1];
      const sceneAnchor = lastChapter ? buildSceneAnchor(worldState, lastChapter) : '';

      const prompt = buildContinuePrompt(
        action,
        nextTurn,
        recentSummary,
        resolvePromptMode(),
        recentSectionTypes,
        recentChoiceTexts,
        sceneAnchor,
        outcomeDirective,
        resolvedLanguage
      );

      const chapter = await requestStoryChapter(prompt, setup, nextTurn);

      turnNumber = nextTurn;
      currentChapter = chapter;
      chapterHistory = [...chapterHistory, chapter].slice(-60);
      actionHistory = [...actionHistory, action].slice(-60);

      applyStateUpdate(chapter);
      memoryLog = appendMemoryFromChapter(memoryLog, chapter);
      ({ aiMessages, campaignArchive } = archiveOldTurnsIfNeeded(chapterHistory, aiMessages, campaignArchive));

      await persistInteractiveState(setup);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      generationError = message;
      showToast(`Échec du tour: ${message}`, 'error');
    } finally {
      generating = false;
    }

    // Off-screen world simulation runs after the lock is released so choices unlock
    // immediately; it is throttled and self-guards against stale application.
    // Section types are re-derived inside the tick from chapterHistory.
    if (!generationError) {
      void runBackgroundWorldTick(setup, turnNumber);
    }
  }

  function handleChoice(choice: StoryChoice): void {
    void continueAdventure(choice.text, choice);
  }

  function handleCustomActionSubmit(): void {
    const action = customAction.trim();
    if (!action) return;
    customAction = '';
    void continueAdventure(action);
  }

  async function handleSave(): Promise<void> {
    if (saving) return;
    saving = true;

    try {
      const setup = ensureSetupDefaults();
      await ensureStoryExists(setup);
      await persistInteractiveState(setup);
      showToast('Histoire sauvegardée', 'success');
    } catch (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
      logger.error('editor: sauvegarde manuelle échouée.', error);
    } finally {
      saving = false;
    }
  }

  function goToSettings(): void {
    void goto('/settings');
  }

  function goBackToSetupFromPlay(): void {
    mode = 'setup';
    setupScreenIndex = SETUP_SCREENS.length - 1;
  }

  function startNewStory(): void {
    if (storyId) {
      clearInteractiveSession(storyId);
    }

    resetEditor();
    mode = 'setup';
    storyId = null;
    setupScreenIndex = 0;
    setupSlideDir = 1;
    selectedTrame = null;
    generating = false;
    generationError = '';
    turnNumber = 0;
    currentChapter = null;
    chapterHistory = [];
    actionHistory = [];
    aiMessages = [];
    memoryLog = [];
    storyRuntimeMode = 'agentic-subagents';
    backgroundEvents = [];
    campaignArchive = [];
    customAction = '';

    void goto('/stories/new');
  }

  onMount(async () => {
    const params = get(page).params;
    const id = params.id;

    if (id && id !== 'new') {
      storyId = id;
      await loadStory(id);
    } else {
      resetEditor();
      storyId = null;
    }

    const preferences = await refreshRuntimePreferences();

    if (storyId) {
      const session = await loadInteractiveSession(storyId);
      if (session) {
        turnNumber = session.turnNumber;
        selectedTrame = session.selectedTrame;
        storyRuntimeMode = session.storyRuntimeMode || 'agentic-subagents';
        currentChapter = session.currentChapter
          ? sanitizeChapterForDisplay(session.currentChapter)
          : null;
        chapterHistory = sanitizeChapterList(session.chapterHistory);
        actionHistory = session.actionHistory;
        aiMessages = session.aiMessages;
        memoryLog = normalizeMemoryFacts(session.memoryLog || []);
        backgroundEvents = session.backgroundEvents || [];
        campaignArchive = session.campaignArchive || [];

        const snapshot = session.setupSnapshot || get(currentSetup);
        setSetupField('era', snapshot.era || get(currentSetup).era);
        setSetupField('faction', snapshot.faction || get(currentSetup).faction);
        setSetupField('role', snapshot.role || get(currentSetup).role);
        setSetupField('premise', snapshot.premise || get(currentSetup).premise);
        setSetupField('protagonistFirstName', snapshot.protagonistFirstName);
        setSetupField('protagonistLastName', snapshot.protagonistLastName);
        setSetupField('protagonistAvatar', snapshot.protagonistAvatar || get(currentSetup).protagonistAvatar);
        setSetupField('writingStyle', snapshot.writingStyle || get(currentSetup).writingStyle);
        setSetupField('writingTone', snapshot.writingTone || get(currentSetup).writingTone);
        setSetupField('writingPov', snapshot.writingPov || get(currentSetup).writingPov);
        setSetupField('writingLength', snapshot.writingLength || get(currentSetup).writingLength);
        setSetupField('contentMode', snapshot.contentMode || get(currentSetup).contentMode);

        const setupForRepair = ensureSetupDefaults();
        memoryLog = ensureCanonicalIdentityMemory(memoryLog, setupForRepair);
        if (worldStateNeedsRepair(session.worldState)) {
          worldState = rebuildWorldStateFromHistory(setupForRepair, chapterHistory, session.worldState);
          void saveInteractiveSession();
        } else if (session.worldState) {
          worldState = session.worldState;
        } else {
          worldState = initWorldState(setupForRepair);
        }

        mode = session.currentChapter ? 'play' : 'setup';
      }
    }

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      hudCollapsed = true;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', flushInteractiveState);
      window.addEventListener('beforeunload', flushInteractiveState);
    }

    loading = false;

    if (preferences.autoSave) {
      startAutoSave(preferences.autoSaveInterval);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', flushInteractiveState);
      window.removeEventListener('beforeunload', flushInteractiveState);
    }
    flushInteractiveState();
    stopAutoSave();
  });
</script>

<svelte:head>
  <title>{storyId ? 'Aventure interactive' : 'Nouvelle aventure IA'} — Star Wars Story Manager</title>
</svelte:head>

<div class="editor-layout">
  <main class="editor-main">
    {#if mode !== 'play'}
    <PageHeader
      title={mode === 'setup' ? "Création d'histoire IA" : 'Aventure interactive'}
      showBack={true}
      on:back={() => goto('/')}
      breadcrumbs={[
        { label: 'Mes Histoires', href: '/' },
        { label: mode === 'setup' ? 'Nouvelle aventure' : (currentChapter?.chapter_title || 'Aventure') }
      ]}
    >
      <div class="header-actions">
        <button class="btn btn-ghost btn-icon-label" on:click={startNewStory} disabled={generating || saving} title="Nouvelle partie">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span class="btn-text">Nouvelle</span>
        </button>
        <button class="btn btn-secondary btn-icon-label" on:click={handleSave} disabled={saving || generating} title="Sauvegarder">
          {#if saving}
            <span class="spinner"></span>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" aria-hidden="true">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17,21 17,13 7,13 7,21"/>
              <polyline points="7,3 7,8 15,8"/>
            </svg>
          {/if}
          <span class="btn-text">Sauvegarder</span>
        </button>
      </div>
    </PageHeader>
    {/if}

    <div class="editor-content" class:play-flush={mode === 'play' && !loading}>
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      {:else if mode === 'setup'}
        <SetupWizard
          bind:setupScreenIndex
          bind:setupSlideDir
          bind:selectedTrame
          {generating}
          {generationError}
          {providerStatus}
          {providerMissing}
          on:launch={launchAdventure}
          on:settings={goToSettings}
        />
      {:else}
        <div class="play-shell" class:hud-open={!hudCollapsed}>
          <SceneBackdrop sectionType={currentChapter?.section_type} era={$currentSetup.era} />

          <!-- ── Topbar ──────────────────────────────────── -->
          <div class="play-topbar">
            <a class="topbar-home" href="/" aria-label="Retour à l'accueil" title="Accueil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </a>
            <div class="turn-indicator">
              <span class="turn-dot"></span>
              Tour&nbsp;<strong>{turnNumber || 1}</strong>
            </div>

            <!-- Model chip -->
            {#if providerConfig}
              <div class="model-chip" title={`${providerStatus} · ${storyOrchestration.chipTitle}`}>
                {#if storyOrchestration.isSubagentOrchestration}
                  <span class="model-chip-dot orchestrated"></span>
                {:else}
                  <span class="model-chip-dot"></span>
                {/if}
                <span class="model-chip-name">
                  {(providerConfig.model || 'auto').split('/').pop()?.split(':')[0] ?? 'auto'}
                </span>
                <span class="model-chip-tag">{storyOrchestration.chipTag}</span>
              </div>
            {/if}

            {#if memoryLog.length > 0}
              <div class="mem-badge" title="Faits mémorisés par l'IA">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z"/></svg>
                {memoryLog.length}
              </div>
            {/if}
            <button class="topbar-link" on:click={goBackToSetupFromPlay} disabled={generating}>
              Config
            </button>
          </div>

          <!-- ── Living World HUD ───────────────────────── -->
          <GameHUD
            {worldState}
            bind:collapsed={hudCollapsed}
            {turnNumber}
            playerRoleLabel={currentRoleLabel}
            playerFactionLabel={currentFactionLabel}
            playerFactionId={$currentSetup.faction}
            protagonistFirstName={$currentSetup.protagonistFirstName ?? ''}
            protagonistLastName={$currentSetup.protagonistLastName ?? ''}
            protagonistAvatar={$currentSetup.protagonistAvatar ?? ''}
          />

          <!-- ── Scrollable narrative zone ──────────────── -->
          <div class="play-scroll-area">

            {#if generationError}
              <div class="error-banner">{generationError}</div>
            {/if}

            {#if visibleBackgroundEvents.length > 0}
              <details class="world-events-panel" aria-label="Événements galactiques hors écran">
                <summary class="world-events-header">
                  <h3>Mouvements de la galaxie</h3>
                  <span class="world-events-count">{visibleBackgroundEvents.length}</span>
                </summary>
                <div class="world-events-list">
                  {#each visibleBackgroundEvents.slice(0, 3) as event}
                    <article class="world-event-item">
                      <div class="world-event-meta">
                        <span>Tour {event.turn}</span>
                      </div>
                      <strong>{event.title}</strong>
                      <p>{event.summary}</p>
                    </article>
                  {/each}
                </div>
              </details>
            {/if}

            <!-- ── Loading indicator ───────────────────── -->
            {#if generating}
              <div class="play-generating" in:fly={{ y: 6, duration: 180 }}>
                <div class="holonet-loader" aria-label="Connexion au Holonet en cours">
                  <div class="holonet-ring"></div>
                  <div class="holonet-ring holonet-ring--2"></div>
                  <div class="holonet-core">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  </div>
                </div>
                <p class="gen-label">Connexion au Holonet…</p>
                <p class="gen-sub">L'IA compose la suite</p>
              </div>
            {/if}

            {#if currentChapter}
              <!-- ── Chapter card ────────────────────────── -->
              {#key currentChapter.chapter_number}
                <article class="chapter-card" in:fly={{ y: 20, duration: 280, opacity: 0 }}>

                  <!-- Eyebrow + title -->
                  <header class="chapter-header">
                    <div class="chapter-eyebrow">
                      <span class="chapter-num">Tour {currentChapter.chapter_number || turnNumber}</span>
                      <span class="chapter-sep">·</span>
                      <span class="chapter-type">{currentChapter.section_type}</span>
                    </div>
                    <h2 class="chapter-title">{currentChapter.chapter_title}</h2>
                  </header>

                  <!-- Narrative flow -->
                  <div class="narrative">

                    {#if currentChapter.narrative.context}
                      <div class="n-block n-context">
                        <span class="n-tag">Contexte</span>
                        {#each splitNarrativeParagraphs(currentChapter.narrative.context) as para}
                          <p class="n-paragraph" class:n-paragraph--dialogue={para.kind === 'dialogue'}>{para.text}</p>
                        {/each}
                      </div>
                    {/if}

                    {#if dialogueDisplay.actionParagraphs.length}
                      <div class="n-block n-action">
                        <span class="n-tag n-tag--action">{actionTagLabel}</span>
                        {#each dialogueDisplay.actionParagraphs as para}
                          <p class="n-paragraph" class:n-paragraph--dialogue={para.kind === 'dialogue'}>{para.text}</p>
                        {/each}
                      </div>
                    {/if}

                    {#if dialogueDisplay.dialogueParagraphs.length}
                      <div class="n-block n-dialogue">
                        <span class="n-tag n-tag--dialogue">Dialogue</span>
                        {#each dialogueDisplay.dialogueParagraphs as para}
                          <p class="n-paragraph">{para.text}</p>
                        {/each}
                      </div>
                    {/if}

                    {#if currentChapter.narrative.reflection}
                      <div class="n-block n-reflection">
                        <span class="n-tag n-tag--reflection">Réflexion</span>
                        {#each splitNarrativeParagraphs(currentChapter.narrative.reflection) as para}
                          <p class="n-paragraph" class:n-paragraph--dialogue={para.kind === 'dialogue'}>{para.text}</p>
                        {/each}
                      </div>
                    {/if}

                  </div>
                </article>
              {/key}

              <!-- ── Memory panel (in scroll area) ─────── -->
              <details class="memory-panel">
                <summary>
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
                  Contexte mémorisé <span class="mem-count">({memoryLog.length})</span>
                </summary>
                {#if memoryLog.length}
                  <ul class="mem-list">
                    {#each [...memoryLog].reverse().slice(0, 25) as item}
                      <li>{item}</li>
                    {/each}
                  </ul>
                {:else}
                  <p class="memory-empty">La mémoire se remplit au fil des tours.</p>
                {/if}
              </details>

            {:else}
              <div class="play-empty">
                <p>Aucun chapitre actif. Retournez à la configuration pour lancer l'aventure.</p>
                <button class="btn btn-primary" on:click={goBackToSetupFromPlay}>Retour à la configuration</button>
              </div>
            {/if}

          </div><!-- /.play-scroll-area -->

          <!-- ── Action zone (sticky to bottom on mobile) ── -->
          {#if currentChapter}
            <div class="play-action-zone">

              <!-- Choices -->
              {#if currentChapter.choices.length > 0}
                <section class="choices-section">
                  <h3 class="choices-heading">Que faites-vous ?</h3>
                  <div class="choice-list">
                    {#each currentChapter.choices as choice, i}
                      {@const cons = choiceConsequences(choice)}
                      <button
                        class="choice-btn"
                        data-attr={choice.attribute.toLowerCase()}
                        class:choice-danger={cons.diffBonus > 0}
                        class:choice-disabled={cons.disabled}
                        on:click={() => !cons.disabled && handleChoice(choice)}
                        disabled={generating || cons.disabled}
                      >
                        <span class="choice-key">{String.fromCharCode(65 + i)}</span>
                        <span class="choice-content">
                          <span class="choice-text">{choice.text}</span>
                          <span class="choice-meta">
                            <span class="choice-attr">{choice.attribute}</span>
                            <span class="choice-pips">
                              {#each Array(5) as _, d}
                                <span class="pip" class:on={d < choice.difficulty + cons.diffBonus}
                                  class:pip-bonus={d >= choice.difficulty && d < choice.difficulty + cons.diffBonus}></span>
                              {/each}
                            </span>
                            {#if cons.warning}
                              <span class="choice-warning">{cons.warning}</span>
                            {/if}
                          </span>
                        </span>
                      </button>
                    {/each}
                  </div>
                </section>
              {/if}

              <!-- Custom action -->
              <form class="custom-form" on:submit|preventDefault={handleCustomActionSubmit}>
                <label class="custom-label" for="custom-action">— ou jouez librement</label>
                <div class="custom-row">
                  <div class="custom-avatar-indicator">
                    {#if $currentSetup.protagonistAvatar && ($currentSetup.protagonistAvatar.startsWith('data:') || $currentSetup.protagonistAvatar.startsWith('http'))}
                      <img src={$currentSetup.protagonistAvatar} alt="" class="custom-avatar-img" />
                    {:else}
                      <span class="custom-avatar-emoji">{$currentSetup.protagonistAvatar || '🧑‍🚀'}</span>
                    {/if}
                  </div>
                  <textarea
                    id="custom-action"
                    class="custom-input"
                    bind:value={customAction}
                    placeholder="Décrivez votre action…"
                    rows="2"
                    disabled={generating}
                  ></textarea>
                  <button
                    class="custom-send"
                    type="submit"
                    disabled={generating || !customAction.trim()}
                    title="Envoyer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22,2 15,22 11,13 2,9"/>
                    </svg>
                  </button>
                </div>
              </form>

            </div><!-- /.play-action-zone -->
          {/if}

        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .editor-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .editor-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .editor-content {
    flex: 1;
    padding: var(--space-lg) var(--space-xl);
    overflow-y: auto;
  }

  /* Immersive: the play stage bleeds to the screen edges */
  .editor-content.play-flush {
    padding: 0;
  }

  .loading-state,
  .play-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    min-height: 320px;
    color: var(--color-text-muted);
    text-align: center;
    font-family: var(--font-body);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ═══════════════════════════════════════════
     PLAY SHELL
  ═══════════════════════════════════════════ */
  .play-shell {
    --hud-width: 228px;
    --hud-gap: 18px;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    width: 100%;
    min-height: 100vh;
    padding: var(--space-xl) clamp(var(--space-lg), 5vw, 72px) calc(var(--space-2xl) + var(--space-lg));
    background: var(--color-bg-primary);
  }

  /* Reading column floats left over the cinematic backdrop */
  .play-topbar,
  .play-scroll-area,
  .play-action-zone {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 720px;
    margin-right: auto;
  }

  @media (min-width: 1160px) {
    .play-shell.hud-open {
      padding-right: calc(var(--hud-width) + var(--hud-gap) + var(--space-lg));
    }
  }

  .play-scroll-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .play-action-zone {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* Header icon-label buttons */
  .btn-icon-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .error-banner {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid rgba(215, 107, 107, 0.4);
    border-radius: var(--radius-sm);
    background: rgba(215, 107, 107, 0.06);
    color: var(--color-red);
    font-size: 0.85rem;
    font-family: var(--font-body);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .world-events-panel {
    border: 1px solid var(--border-subtle);
    background: var(--surface-glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .world-events-panel summary { list-style: none; }
  .world-events-panel summary::-webkit-details-marker { display: none; }

  .world-events-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    cursor: pointer;
    user-select: none;
  }

  .world-events-header h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .world-events-count {
    font-family: var(--font-display);
    font-size: 0.65rem;
    color: var(--color-text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 1px 7px;
  }

  .world-events-list {
    display: grid;
    gap: var(--space-xs);
  }

  .world-event-item {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .world-event-item strong {
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .world-event-item p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-family: var(--font-body);
    line-height: 1.45;
  }

  .world-event-meta {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .world-event-meta span {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* ── Topbar ─────────────────────────────── */
  .play-topbar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .topbar-home {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    background: rgba(8, 9, 14, 0.5);
    border: 1px solid var(--border-subtle);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: all var(--transition-fast);
  }

  .topbar-home:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
    background: rgba(255, 255, 255, 0.04);
  }

  .turn-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .turn-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-text-secondary);
  }

  .mem-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
  }

  .topbar-link {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }

  .topbar-link:hover:not(:disabled) {
    color: var(--color-text-primary);
    text-decoration-color: currentColor;
  }

  /* ── Model chip ─────────────────────────── */
  .model-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 5px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    color: var(--color-text-muted);
    max-width: 160px;
    overflow: hidden;
  }

  .model-chip-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-text-muted);
  }

  .model-chip-dot.orchestrated {
    background: var(--color-text-secondary);
  }

  .model-chip-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: monospace;
    font-size: 0.65rem;
  }

  .model-chip-tag {
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  /* ── Generating ─────────────────────────── */
  .play-generating {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: var(--space-xl);
    color: var(--color-text-muted);
  }

  .holonet-loader {
    position: relative;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .holonet-ring {
    position: absolute;
    inset: 0;
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    animation: holonet-spin 1.4s linear infinite;
  }

  .holonet-ring--2 {
    inset: 6px;
    border-color: var(--color-border-hover);
    animation-direction: reverse;
    animation-duration: 0.9s;
  }

  .holonet-core {
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-primary);
  }

  @keyframes holonet-spin {
    to { transform: rotate(360deg); }
  }

  .gen-label {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-primary);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-family: var(--font-display);
  }

  .gen-sub {
    margin: 0;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    font-family: var(--font-body);
  }

  /* ═══════════════════════════════════════════
     CHAPTER — cinematic reading column
  ═══════════════════════════════════════════ */
  .chapter-card {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
  }

  .chapter-header {
    padding: 0 0 var(--space-md);
    border-bottom: none;
  }

  .chapter-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .chapter-num {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .chapter-sep {
    color: var(--color-text-muted);
    opacity: 0.3;
  }

  .chapter-type {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .chapter-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 1.45rem + 1.2vw, 2.4rem);
    font-weight: 500;
    color: var(--color-text-primary);
    line-height: 1.15;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ── Narrative prose — serif reading column ── */
  .narrative {
    padding: 0;
    max-width: var(--reading-measure);
    margin: 0 auto 0 0;
    font-family: var(--font-narrative);
  }

  .n-block {
    padding: 0;
    position: relative;
  }

  .n-block + .n-block { border-top: none; margin-top: 1.25em; }

  .n-tag { display: none; }

  /* Prose shared */
  .n-block p {
    margin: 0;
    font-family: var(--font-narrative);
    line-height: var(--narrative-leading);
    font-size: var(--narrative-size);
    color: var(--color-text-primary);
    text-wrap: pretty;
    text-align: left;
  }

  .n-block p + p { margin-top: 1.05em; }

  .n-paragraph { padding-left: 0; }

  /* Dialogue lines — subtle italic, a quiet accent rule, no heavy box */
  .n-paragraph--dialogue,
  .n-dialogue p {
    font-style: italic;
    color: var(--color-blue);
  }

  .n-action p { font-weight: 400; }

  .n-dialogue {
    padding: 0 0 0 var(--space-md);
    border: none;
    border-left: 1px solid var(--color-blue);
    background: none;
    border-radius: 0;
    margin-top: 1.25em;
  }

  /* Reflection — quiet inner voice, set off by a hairline */
  .n-reflection {
    background: none;
    border: none;
    border-top: 1px solid var(--border-subtle) !important;
    border-radius: 0;
    padding: var(--space-md) 0 0;
    margin-top: var(--space-lg);
  }

  .n-reflection p {
    font-style: italic;
    color: var(--color-text-muted);
    font-size: calc(var(--narrative-size) * 0.95);
  }

  /* ═══════════════════════════════════════════
     CHOICES
  ═══════════════════════════════════════════ */
  .choices-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .choices-heading {
    margin: 0;
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-primary);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .choices-heading::before {
    content: '';
    display: inline-block;
    width: 16px;
    height: 1px;
    background: var(--color-text-muted);
    opacity: 0.5;
    flex-shrink: 0;
  }

  .choice-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .choice-btn {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    transition: all var(--transition-fast);
  }

  .choice-btn:hover:not(:disabled) {
    border-color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .choice-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .choice-btn.choice-danger {
    border-color: rgba(215, 107, 107, 0.3);
  }

  .choice-btn.choice-danger .choice-key {
    background: rgba(215, 107, 107, 0.04);
    border-right-color: rgba(215, 107, 107, 0.2);
    color: var(--color-red);
  }

  .choice-btn.choice-disabled {
    border-color: rgba(255, 255, 255, 0.04);
    opacity: 0.38;
  }

  .choice-warning {
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 500;
    color: var(--color-red);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .pip.pip-bonus { background: var(--color-red); }

  /* Letter key */
  .choice-key {
    flex-shrink: 0;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
    border-right: 1px solid var(--border-subtle);
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    letter-spacing: 0.5px;
    font-variant-numeric: tabular-nums;
    transition: all var(--transition-fast);
  }

  .choice-btn:hover:not(:disabled) .choice-key {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.06);
  }

  /* Content */
  .choice-content {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px var(--space-md);
    min-width: 0;
  }

  .choice-text {
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .choice-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .choice-attr {
    font-family: var(--font-display);
    font-size: 0.58rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
  }

  .choice-pips {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .pip {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--border-subtle);
  }

  .pip.on { background: var(--color-text-primary); }

  /* Dynamic Choice Attributes */
  .choice-btn[data-attr="combat"] .choice-attr { color: var(--color-red); border-color: rgba(215, 107, 107, 0.3); }
  .choice-btn[data-attr="diplomacy"] .choice-attr { color: var(--color-blue); border-color: rgba(143, 182, 214, 0.3); }
  .choice-btn[data-attr="tech"] .choice-attr { color: var(--color-green); border-color: rgba(143, 206, 154, 0.3); }
  .choice-btn[data-attr="survival"] .choice-attr { color: var(--color-gold-dim); border-color: rgba(156, 128, 72, 0.3); }
  .choice-btn[data-attr="force"] .choice-attr { color: var(--color-purple); border-color: rgba(182, 166, 214, 0.3); }

  /* ═══════════════════════════════════════════
     CUSTOM ACTION
  ═══════════════════════════════════════════ */
  .custom-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .custom-label {
    font-family: var(--font-display);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--color-text-muted);
  }

  .custom-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .custom-avatar-indicator {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    overflow: hidden;
    border: 1.5px solid rgba(255, 232, 31, 0.3);
    box-shadow: 0 0 6px rgba(255, 232, 31, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 12, 18, 0.5);
    margin-bottom: 4px;
  }

  .custom-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .custom-avatar-emoji {
    font-size: 0.95rem;
    line-height: 1;
  }

  .custom-input {
    flex: 1;
    border: 1px solid var(--border-subtle);
    background: var(--surface-glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: var(--color-text-primary);
    border-radius: var(--radius-sm);
    padding: 12px var(--space-md);
    resize: none;
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.55;
    transition: all var(--transition-fast);
  }

  .custom-input:focus {
    outline: none;
    border-color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .custom-input::placeholder {
    color: var(--color-text-muted);
  }

  .custom-send {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .custom-send:hover:not(:disabled) {
    border-color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
  }
  .custom-send:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ═══════════════════════════════════════════
     MEMORY PANEL
  ═══════════════════════════════════════════ */
  .memory-panel {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-glass);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    overflow: hidden;
    transition: all var(--transition-fast);
  }

  .memory-panel[open], .memory-panel:hover {
    border-color: var(--color-border-hover);
  }

  .memory-panel summary {
    cursor: pointer;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px var(--space-md);
    display: flex;
    align-items: center;
    gap: 6px;
    list-style: none;
    user-select: none;
  }

  .memory-panel summary::-webkit-details-marker { display: none; }
  .mem-count { opacity: 0.6; }

  .mem-list {
    margin: 0;
    padding: var(--space-xs) var(--space-md) var(--space-sm);
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: 0.78rem;
    list-style: none;
  }

  .mem-list li::before { content: '— '; opacity: 0.4; }

  .memory-empty {
    margin: 0;
    padding: 8px var(--space-md) var(--space-sm);
    border-top: 1px solid var(--border-subtle);
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: 0.8rem;
  }

  @media (max-width: 920px) {
  }

  @media (max-width: 720px) {
    .editor-content {
      padding: var(--space-md);
    }

    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .chapter-header {
      padding: var(--space-lg) var(--space-md) var(--space-md);
    }

    .narrative {
      padding: 0 var(--space-md) var(--space-sm);
      max-width: none;
    }

    .n-block p {
      line-height: 1.72;
      font-size: 0.99rem;
    }

    .n-dialogue {
      padding: var(--space-xs) var(--space-sm);
    }
  }

  /* ── Mobile (≤ 768px) ────────────────────── */
  @media (max-width: 768px) {

    /* ── Header: icon-only buttons ─────────── */
    .btn-text { display: none; }
    .header-actions { gap: 6px; }
    .btn-icon-label { padding: 8px 10px; }

    /* ── editor-content: remove padding, allow flex ── */
    .editor-content {
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Play shell: messenger layout ──────── */
    .play-shell {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 0;
      padding-bottom: 0;
      max-width: 100%;
      margin: 0;
      border: none;
      border-radius: 0;
      box-shadow: none;
    }

    /* Topbar: compact strip */
    .play-topbar {
      flex-shrink: 0;
      flex-wrap: nowrap;
      gap: 6px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--border-subtle);
      overflow: hidden;
    }
    .model-chip {
      display: none; /* Hide on mobile to free up space */
    }

    /* Narrative scroll zone: fills all available height */
    .play-scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px 14px 8px;
    }

    /* Action zone: sticky at bottom, always visible */
    .play-action-zone {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px max(14px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--border-subtle);
      background: rgba(8, 8, 12, 0.97);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.45);
    }

    /* Chapter header & narrative */
    .chapter-header { padding: 14px 14px 10px; }
    .chapter-title { font-size: 1.25rem; }
    .narrative { padding: 0 14px 12px; max-width: none; }
    .n-block p { line-height: 1.7; font-size: 0.97rem; }
    .n-dialogue { padding: var(--space-xs) var(--space-sm); }

    /* World events: collapsed by default on mobile */
    .world-events-panel .world-events-list { margin-top: 8px; }

    /* Choice buttons: bigger touch targets */
    .choice-btn { min-height: 56px; }
    .choice-content { padding: 12px 12px; }
    .choice-text { font-size: 0.88rem; }
    .choices-heading { font-size: 0.88rem; }

    /* Custom action form: stacked */
    .custom-row { flex-direction: row; gap: 8px; }
    .custom-input {
      font-size: 16px; /* prevent iOS zoom */
      min-height: 44px;
      padding: 10px 12px;
    }
    .custom-send {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }
    .custom-label { font-size: 0.68rem; }

    /* Memory panel: smaller on mobile */
    .memory-panel summary { padding: 8px 12px; font-size: 0.72rem; }
    .mem-list { font-size: 0.72rem; }

    /* Play generating: compact */
    .play-generating { padding: 12px; gap: 8px; font-size: 0.78rem; }
  }

  @media (max-width: 420px) {
    .play-topbar { padding: 7px 12px; }
    .play-scroll-area { padding: 10px 12px 6px; }
    .play-action-zone { padding: 10px 12px max(12px, env(safe-area-inset-bottom)); }
    .chapter-header { padding: 12px 12px 8px; }
    .narrative { padding: 0 12px 10px; }
    .chapter-title { font-size: 1.15rem; }
  }
</style>
