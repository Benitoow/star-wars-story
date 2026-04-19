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
  import { showToast } from '$lib/stores/ui';
  import { logger } from '$lib/utils/logger';
  import { getPreferences, type UserPreferences } from '$lib/db';
  import SvgIcon from '$lib/components/SvgIcon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import GameHUD from '$lib/components/GameHUD.svelte';
  import {
    AVATARS,
    CONTENT_MODES,
    defaultRoleForFaction,
    ERA_START_DATES,
    ERAS,
    FACTIONS,
    FACTION_CREDITS,
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
    buildSceneAnchor,
    enforceTransitionChoiceQuality,
    isNearDuplicateBackgroundEvent,
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
    normalizeProviderId,
    summarizeChapterForPrompt,
    supportsAgenticToolCalling,
    type BackgroundWorldEvent,
    type ChatMessage,
    type StoryChapter,
    type StoryChoice,
    type StoryProviderConfig,
    type WorldState,
    type NpcRelation
  } from '$lib/ai/storyEngine';

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
  let chapterHistory: StoryChapter[] = [];
  let actionHistory: string[] = [];
  let aiMessages: ChatMessage[] = [];
  let memoryLog: string[] = [];
  let backgroundEvents: LoggedBackgroundEvent[] = [];
  let campaignArchive: string[] = [];
  let customAction = '';
  let hudCollapsed = false;

  const UNKNOWN_LOCATION_RE = /\b(?:inconnu(?:e)?|unknown|indetermine|ind[ée]termin[ée]|non\s+renseign[ée]|n\/?a|aucun\s+lieu)\b/i;
  const LOCATION_HINTS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /nar\s*shaddaa/i, label: 'Nar Shaddaa' },
    { pattern: /coruscant/i, label: 'Coruscant' },
    { pattern: /tatooine/i, label: 'Tatooine' },
    { pattern: /naboo/i, label: 'Naboo' },
    { pattern: /corellia/i, label: 'Corellia' },
    { pattern: /kamino/i, label: 'Kamino' },
    { pattern: /mustafar/i, label: 'Mustafar' },
    { pattern: /hoth/i, label: 'Hoth' },
    { pattern: /bespin|cite\s*des\s*nuages|cloud\s*city/i, label: 'Bespin' },
    { pattern: /cantina/i, label: 'Cantina locale' },
    { pattern: /hangar|spatioport|dock|quai d['’]arrimage|baie d['’]arrimage/i, label: 'Hangar / Spatioport' }
  ];
  const DIALOGUE_SPEAKER_RE = /[—-]\s*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,48})\s*:/gu;
  const DIALOGUE_SPEAKER_STOPWORDS = new Set(['je', 'tu', 'vous', 'il', 'elle', 'on', 'nous', 'ils', 'elles']);
  const NON_NPC_EXACT = new Set([
    'les', 'le', 'la', 'un', 'une', 'des', 'du', 'de',
    'jundland', 'kashyyyk', 'coruscant', 'tatooine', 'naboo', 'bespin',
    'hangar', 'spatioport', 'cantina', 'canyon', 'secteur',
    'hutt', 'hutts', 'rodien', 'rodiens',
    'yt-1300', 'yv-666', 'scyk'
  ]);
  const NON_NPC_ENTITY_RE = /\b(?:jundland|kashyyyk|coruscant|tatooine|naboo|bespin|mustafar|kamino|hoth|endor|dagobah|nar\s*shaddaa|hangar|spatioport|cantina|canyon|secteur|transport|vaisseau|cargo|navette|yt-1300|yv-666|scyk|x-wing|tie|hutts?|rodiens?)\b/i;
  const ALLOWED_DROID_NAME_RE = /^(?:r2|c-?3|bb|ig|hk|k2|bd|chopper|ch0pper)/i;
  const HOSTILE_RELATION_RE = /\b(?:attaque|menace|hostile|ennemi|trahit|abandonne|frappe|tue|deteste|déteste|insulte|pi[eè]ge|embuscade)\b/i;
  const ALLY_RELATION_RE = /\b(?:aide|sauve|protege|prot[eè]ge|couvre|soutient|soutien|allie|alli[eé]|confiance|merci|secourt)\b/i;
  const MEMORY_LOW_SIGNAL_RELATION_RE = /^rencontre\s+avec\s+/i;

  function normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isLikelyNpcName(value: unknown): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;

    const normalized = normalizeSearchText(raw);
    if (!normalized || isUnknownLocationValue(normalized)) return false;
    if (DIALOGUE_SPEAKER_STOPWORDS.has(normalized)) return false;
    if (NON_NPC_EXACT.has(normalized)) return false;
    if (/^(?:le|la|les|un|une|des|du|de)\s+/.test(normalized)) return false;
    if (NON_NPC_ENTITY_RE.test(normalized)) return false;
    if (normalized.split(/\s+/).length > 3) return false;

    const hasDigits = /\d/.test(normalized);
    if (hasDigits && !ALLOWED_DROID_NAME_RE.test(normalized)) return false;

    return normalized.length >= 2;
  }

  function clampAffinity(value: number): number {
    return Math.max(-100, Math.min(100, Math.round(value)));
  }

  function deriveStatusFromAffinity(affinity: number, currentStatus?: NpcRelation['status']): NpcRelation['status'] {
    if (currentStatus === 'dead') return 'dead';
    if (affinity >= 25) return 'ally';
    if (affinity <= -25) return 'hostile';
    return 'neutral';
  }

  function inferNpcAffinityDelta(chapter: StoryChapter, npcName: string): number {
    const normalizedName = normalizeSearchText(npcName);
    if (!normalizedName) return 0;

    const corpus = normalizeSearchText([
      chapter.narrative.action,
      chapter.narrative.dialogue,
      chapter.narrative.reflection
    ].filter(Boolean).join('\n'));

    if (!corpus || !corpus.includes(normalizedName)) return 0;

    const nameRegex = new RegExp(escapeRegExp(normalizedName), 'gi');
    let score = 0;
    let match: RegExpExecArray | null;

    while ((match = nameRegex.exec(corpus)) !== null) {
      const start = Math.max(0, match.index - 90);
      const end = Math.min(corpus.length, match.index + normalizedName.length + 90);
      const window = corpus.slice(start, end);

      if (ALLY_RELATION_RE.test(window)) score += 12;
      if (HOSTILE_RELATION_RE.test(window)) score -= 12;
    }

    return Math.max(-20, Math.min(20, score));
  }

  function isMeaningfulNpcMemoryEntry(npc: Partial<NpcRelation> & { name: string }): boolean {
    if (!isLikelyNpcName(npc.name)) return false;
    const affinity = typeof npc.affinity === 'number' ? npc.affinity : 0;
    const status = normalizeNpcStatus(npc.status as NpcRelation['status'] | undefined);
    const note = String(npc.note || '').trim();
    return Boolean(note || npc.faction || Math.abs(affinity) >= 15 || status === 'ally' || status === 'hostile' || status === 'dead');
  }

  function isUnknownLocationValue(value: unknown): boolean {
    const text = String(value || '').trim();
    if (!text) return true;
    return UNKNOWN_LOCATION_RE.test(normalizeSearchText(text));
  }

  function inferLocationFromText(...parts: Array<string | undefined>): string | undefined {
    const corpus = parts.filter(Boolean).join('\n');
    if (!corpus) return undefined;

    for (const hint of LOCATION_HINTS) {
      if (hint.pattern.test(corpus)) {
        return hint.label;
      }
    }

    const phraseCapture = corpus.match(/\b(?:dans|sur|à|au|aux|en)\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ' -]{2,48})/u);
    if (phraseCapture?.[1]) {
      return phraseCapture[1].trim();
    }

    return undefined;
  }

  function inferLocationFromChapter(chapter: StoryChapter): string | undefined {
    return inferLocationFromText(
      chapter.narrative.context,
      chapter.narrative.action,
      chapter.narrative.dialogue,
      chapter.narrative.reflection
    );
  }

  function extractNpcSeedsFromDialogue(dialogue: string): string[] {
    const names = new Set<string>();
    for (const match of String(dialogue || '').matchAll(DIALOGUE_SPEAKER_RE)) {
      const candidate = String(match[1] || '').trim();
      if (!candidate) continue;

      const normalized = normalizeSearchText(candidate);
      if (DIALOGUE_SPEAKER_STOPWORDS.has(normalized)) continue;
      if (!isLikelyNpcName(candidate)) continue;
      names.add(candidate);
    }
    return Array.from(names).slice(0, 6);
  }

  function normalizeNpcStatus(status: NpcRelation['status'] | undefined): NpcRelation['status'] {
    if (!status || status === 'unknown') return 'neutral';
    return status;
  }

  function deriveInitialLocation(setup: StorySetup): string {
    const factionSeed: Record<string, string> = {
      empire: 'Coruscant — Secteur Impérial',
      rebels: 'Cellule rebelle en bordure extérieure',
      jedi: 'Enclave Jedi isolée',
      sith: 'Sanctuaire Sith dissimulé',
      hutt: 'Nar Shaddaa',
      mandalore: 'Mandalore'
    };

    if (setup.faction && factionSeed[setup.faction]) {
      return factionSeed[setup.faction];
    }

    const eraSeed: Record<string, string> = {
      old_republic: 'Coruscant',
      clone_wars: 'Coruscant — secteur militaire',
      imperial: 'Coruscant — noyau impérial',
      rebellion: 'Base rebelle mobile',
      new_republic: 'Hosnian Prime',
      first_order: 'Avant-poste de la Bordure Extérieure'
    };

    return eraSeed[setup.era] || 'Secteur frontalier';
  }

  function cloneWorldState(source: WorldState): WorldState {
    return {
      player: {
        hp: source.player.hp,
        credits: source.player.credits,
        location: source.player.location,
        date: source.player.date,
        injuries: source.player.injuries.map(injury => ({ ...injury })),
        inventory: source.player.inventory.map(item => ({ ...item }))
      },
      npcs: source.npcs.map(npc => ({ ...npc })),
      factions: { ...source.factions },
      chronology: source.chronology.map(entry => ({ ...entry }))
    };
  }

  function initWorldState(setup: StorySetup): WorldState {
    const startCredits = FACTION_CREDITS[setup.role] ?? FACTION_CREDITS.default;
    const factions: Record<string, number> = {
      empire: 0, rebel_alliance: 0, jedi_order: 0, sith: 0, hutt: 0, mandalore: 0
    };
    const factionMap: Record<string, string> = {
      jedi: 'jedi_order', sith: 'sith', empire: 'empire',
      rebels: 'rebel_alliance', hutt: 'hutt', mandalore: 'mandalore'
    };
    const playerFaction = factionMap[setup.faction];
    if (playerFaction) factions[playerFaction] = 50;

    return {
      player: {
        hp: 100,
        credits: startCredits,
        location: deriveInitialLocation(setup),
        date: ERA_START_DATES[setup.era] ?? 'Ère inconnue, Jour 1',
        injuries: [],
        inventory: []
      },
      npcs: [],
      factions,
      chronology: []
    };
  }

  let worldState: WorldState = {
    player: { hp: 100, credits: 1000, location: 'Secteur frontalier', date: '', injuries: [], inventory: [] },
    npcs: [],
    factions: {},
    chronology: []
  };
  const INTENSE_SECTION_TYPES = new Set(['action', 'confrontation']);

  function normalizeHpDelta(rawHp: number, currentHp: number): number {
    // Négatif = dégâts (delta clair)
    if (rawHp < 0) return rawHp;
    // Positif > 50 : probablement une valeur absolue envoyée par erreur → convertir en delta
    if (rawHp > 50) return rawHp - currentHp;
    // Petit positif (1–50) : soin delta
    return rawHp;
  }

  function normalizeCreditsDelta(rawCredits: number, currentCredits: number): number {
    // Négatif = dépense (delta clair)
    if (rawCredits < 0) return rawCredits;
    // Très grand positif proche du solde actuel → probablement un snapshot absolu → delta
    const ratio = currentCredits > 0 ? rawCredits / currentCredits : 2;
    if (ratio >= 0.5 && ratio <= 1.8 && rawCredits > 200) return rawCredits - currentCredits;
    // Sinon : traiter comme delta de gain
    return rawCredits;
  }

  function applyStateUpdateToWorldState(sourceState: WorldState, chapter: StoryChapter): WorldState {
    const upd = chapter.state_update;
    const p = sourceState.player;

    const hpDelta = typeof upd?.hp === 'number' ? normalizeHpDelta(upd.hp, p.hp) : undefined;
    const creditsDelta = typeof upd?.credits === 'number' ? normalizeCreditsDelta(upd.credits, p.credits) : undefined;

    const inferredLocation = inferLocationFromChapter(chapter);
    const requestedLocation = String(upd?.location || '').trim();
    const fallbackLocation = isUnknownLocationValue(p.location) ? inferredLocation : undefined;
    let newLocation = requestedLocation || fallbackLocation || p.location;
    if (isUnknownLocationValue(newLocation) && inferredLocation) {
      newLocation = inferredLocation;
    }

    // Player vitals
    const newHp = hpDelta !== undefined ? Math.max(0, Math.min(100, p.hp + hpDelta)) : p.hp;
    const newCredits = creditsDelta !== undefined ? Math.max(0, p.credits + creditsDelta) : p.credits;
    const newDate = upd?.date_advance ? `${p.date.replace(/ \+.*$/, '')} +${upd.date_advance}` : p.date;

    // Injuries: resolve then add new
    const resolvedKeywords = upd?.injuries_resolved ?? [];
    const survivingInjuries = p.injuries.filter(inj =>
      !resolvedKeywords.some(r => inj.description.toLowerCase().includes(r.toLowerCase()))
    );
    const newInjuries = [...survivingInjuries, ...(upd?.injuries_new ?? [])];

    // Inventory
    let inventory = [...p.inventory];
    for (const gained of upd?.inventory_gained ?? []) {
      const existing = inventory.find(i => i.name.toLowerCase() === gained.name.toLowerCase());
      if (existing) existing.qty += gained.qty;
      else inventory.push({ ...gained });
    }
    for (const lost of upd?.inventory_lost ?? []) {
      inventory = inventory
        .map(i => i.name.toLowerCase() === lost.name.toLowerCase() ? { ...i, qty: i.qty - lost.qty } : i)
        .filter(i => i.qty > 0);
    }

    // NPCs: upsert by name — with generic-name deduplication
    const GENERIC_NPC_RE = /^(l['’]inconnu|l['’]homme|la femme|un homme|une femme|le garde|l['’]officier|le soldat|un individu|la silhouette|l['’]etranger|l['’]étranger|un etranger|un étranger)/i;
    let npcs = sourceState.npcs.map(npc => ({ ...npc, status: normalizeNpcStatus(npc.status) }));

    for (const npcUpd of upd?.npcs ?? []) {
      const idx = npcs.findIndex(n => n.name.toLowerCase() === npcUpd.name.toLowerCase());
      if (idx >= 0) {
        // Normal update
        npcs[idx] = {
          ...npcs[idx],
          ...npcUpd,
          status: normalizeNpcStatus((npcUpd.status as NpcRelation['status'] | undefined) ?? npcs[idx].status),
          alive: npcUpd.alive ?? npcs[idx].alive
        } as NpcRelation;
      } else {
        // Check if this is a "name reveal" of an existing generic/anonymous NPC
        const newAff = npcUpd.affinity ?? 0;
        const genericIdx = npcs.findIndex(n =>
          GENERIC_NPC_RE.test(n.name) &&
          Math.abs((n.affinity ?? 0) - newAff) <= 30
        );
        if (genericIdx >= 0) {
          // Merge: rename the generic NPC entry instead of creating a duplicate
          npcs[genericIdx] = {
            ...npcs[genericIdx],
            ...npcUpd,
            status: normalizeNpcStatus((npcUpd.status as NpcRelation['status'] | undefined) ?? npcs[genericIdx].status),
            alive: npcUpd.alive ?? npcs[genericIdx].alive
          } as NpcRelation;
        } else {
          npcs.push({
            name: npcUpd.name,
            affinity: npcUpd.affinity ?? 0,
            status: normalizeNpcStatus(npcUpd.status as NpcRelation['status'] | undefined),
            faction: npcUpd.faction,
            last_seen: npcUpd.last_seen,
            alive: npcUpd.alive !== false,
            note: npcUpd.note
          });
        }
      }
    }

    // Fallback NPC seeds from dialogue when model omitted update_npc
    const speakerSeeds = extractNpcSeedsFromDialogue(chapter.narrative.dialogue);
    const existingNames = new Set(npcs.map(npc => npc.name.toLowerCase()));
    for (const name of speakerSeeds) {
      const key = name.toLowerCase();
      if (existingNames.has(key)) continue;
      if (!isLikelyNpcName(name)) continue;
      npcs.push({
        name,
        affinity: 0,
        status: 'neutral',
        alive: true,
        last_seen: !isUnknownLocationValue(newLocation) ? newLocation : undefined
      });
      existingNames.add(key);
    }

    const explicitNpcUpdates = new Map(
      (upd?.npcs ?? [])
        .filter(item => item?.name)
        .map(item => [String(item.name).toLowerCase(), item] as const)
    );

    for (const npc of npcs) {
      if (!isLikelyNpcName(npc.name)) continue;

      const normalizedName = normalizeSearchText(npc.name);
      const chapterCorpus = normalizeSearchText([
        chapter.narrative.action,
        chapter.narrative.dialogue,
        chapter.narrative.reflection
      ].filter(Boolean).join('\n'));

      const isMentionedThisTurn = Boolean(normalizedName && chapterCorpus.includes(normalizedName));
      if (!isMentionedThisTurn) continue;

      if (!isUnknownLocationValue(newLocation)) {
        npc.last_seen = newLocation;
      }

      const explicit = explicitNpcUpdates.get(npc.name.toLowerCase());
      const hasExplicitRelationSignal = Boolean(
        explicit && (
          typeof explicit.affinity === 'number' ||
          typeof explicit.status === 'string'
        )
      );

      if (!hasExplicitRelationSignal) {
        const delta = inferNpcAffinityDelta(chapter, npc.name);
        if (delta !== 0) {
          npc.affinity = clampAffinity((npc.affinity ?? 0) + delta);
        }
      }

      if (typeof npc.affinity === 'number') {
        npc.status = deriveStatusFromAffinity(npc.affinity, npc.status);
      }
    }

    // Factions: apply deltas, clamp -100..100
    const factions = { ...sourceState.factions };
    for (const [id, delta] of Object.entries(upd?.factions ?? {})) {
      factions[id] = Math.max(-100, Math.min(100, (factions[id] ?? 0) + delta));
    }

    // Chronology entry
    const chronology = [
      ...sourceState.chronology,
      {
        chapter: chapter.chapter_number,
        date: newDate,
        location: newLocation,
        summary: chapter.chapter_title
      }
    ].slice(-40);

    return {
      player: { hp: newHp, credits: newCredits, location: newLocation, date: newDate, injuries: newInjuries, inventory },
      npcs,
      factions,
      chronology
    };
  }

  function applyStateUpdate(chapter: StoryChapter): void {
    worldState = applyStateUpdateToWorldState(worldState, chapter);
  }

  function worldStateNeedsRepair(candidate: WorldState | null | undefined): boolean {
    if (!candidate) return true;
    if (isUnknownLocationValue(candidate.player?.location)) return true;
    if (!candidate.npcs?.length) return true;
    if (!candidate.chronology?.length) return true;
    return false;
  }

  function rebuildWorldStateFromHistory(
    setup: StorySetup,
    chapters: StoryChapter[],
    existingState: WorldState | null | undefined
  ): WorldState {
    const seedState = existingState ? cloneWorldState(existingState) : initWorldState(setup);
    const normalizedSeed: WorldState = {
      ...seedState,
      player: {
        ...seedState.player,
        location: isUnknownLocationValue(seedState.player.location)
          ? deriveInitialLocation(setup)
          : seedState.player.location
      },
      chronology: []
    };

    const orderedChapters = [...chapters].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    return orderedChapters.reduce<WorldState>((acc, chapter) => applyStateUpdateToWorldState(acc, chapter), normalizedSeed);
  }

  // Mechanical consequences: returns display modifiers for a choice
  function choiceConsequences(choice: StoryChoice): { warning: string; diffBonus: number; disabled: boolean } {
    let warning = '';
    let diffBonus = 0;
    let disabled = false;

    const critical = worldState.player.hp < 20;
    const heavyInjury = worldState.player.injuries.some(i => i.severity === 'severe');
    const broke = worldState.player.credits <= 0;

    if (critical && (choice.attribute === 'combat' || choice.attribute === 'force')) {
      warning = '⚠ État critique';
      diffBonus = 2;
    } else if (heavyInjury && (choice.attribute === 'combat' || choice.attribute === 'stealth')) {
      warning = '⚠ Blessure grave';
      diffBonus = 1;
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


  $: activeSetupStep = SETUP_SCREENS[setupScreenIndex];
  $: isLastSetupStep = setupScreenIndex === SETUP_SCREENS.length - 1;
  $: providerMissing = !providerConfig;

  function saveInteractiveSession(): void {
    const payload: InteractiveSessionPayload = {
      version: 1,
      turnNumber,
      selectedTrame,
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

    saveInteractiveSessionPayload(storyId, payload);
  }

  function loadInteractiveSession(id: string): InteractiveSessionPayload | null {
    return loadInteractiveSessionPayload(id, get(currentSetup));
  }

  function clearInteractiveSession(id: string): void {
    clearInteractiveSessionPayload(id);
  }

  function setSetupField<K extends keyof StorySetup>(field: K, value: StorySetup[K]): void {
    const current = get(currentSetup)[field];
    if (current !== value) {
      updateSetupField(field, value);
    }
  }

  function ensureSetupDefaults(): StorySetup {
    const setup = get(currentSetup);
    const next: StorySetup = { ...setup };

    if (!next.era) next.era = ERAS[0].id;
    if (!next.faction) next.faction = FACTIONS[0].id;
    if (!next.role) next.role = defaultRoleForFaction(next.faction);
    if (!next.writingStyle) next.writingStyle = WRITING_STYLES[0].id;
    if (!next.writingTone) next.writingTone = WRITING_TONES[2].id;
    if (!next.writingPov) next.writingPov = WRITING_POVS[1].id;
    if (!next.writingLength) next.writingLength = WRITING_LENGTHS[1].id;
    if (!next.contentMode) next.contentMode = CONTENT_MODES[0].id;
    if (!next.protagonistAvatar) next.protagonistAvatar = AVATARS[0];

    if (!next.premise) {
      const trame = TRAMES.find(item => item.id === selectedTrame);
      next.premise = trame?.premise || 'Un appel de détresse inattendu force votre protagoniste à agir immédiatement.';
    }

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
      ollamaUrl: (preferences.ollamaUrl || '').trim()
    };
  }

  async function refreshRuntimePreferences(): Promise<UserPreferences> {
    const preferences = await getPreferences();
    applySetupDefaultsFromPreferences(preferences);
    providerConfig = buildProviderConfigFromPreferences(preferences);
    providerStatus = providerSummary(providerConfig);

    return preferences;
  }

  function providerSummary(config: StoryProviderConfig | null): string {
    if (!config) return 'Aucun provider texte configuré.';
    const modelLabel = config.model || 'modèle auto';
    const modeLabel = supportsAgenticToolCalling(config.providerId, config.model) ? ' · agentique' : '';
    return `${config.providerId} · ${modelLabel}${modeLabel}`;
  }

  function resolvePromptMode(): 'json' | 'tool-calls' {
    return providerConfig && supportsAgenticToolCalling(providerConfig.providerId, providerConfig.model)
      ? 'tool-calls'
      : 'json';
  }

  function trimMessages(messages: ChatMessage[], maxWithoutSystem = 80): ChatMessage[] {
    const systemMessage = messages.find(message => message.role === 'system');
    const others = messages.filter(message => message.role !== 'system').slice(-maxWithoutSystem);
    return systemMessage ? [systemMessage, ...others] : others;
  }

  function mergeMemoryFacts(nextFacts: string[]): void {
    const cleanedFacts = nextFacts
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .filter(item => item.length >= 10)
      .filter(item => !/^Relation:\s+Rencontre\s+avec\s+/i.test(item))
      .filter(item => !MEMORY_LOW_SIGNAL_RELATION_RE.test(item));

    const merged = Array.from(new Set([...memoryLog, ...cleanedFacts]));
    memoryLog = merged.slice(-120);
  }

  function getRoleLabel(roleId: string): string {
    return ROLES.find(role => role.id === roleId)?.name || roleId;
  }

  function buildCanonicalIdentityFacts(setup: StorySetup): string[] {
    const roleLabel = getRoleLabel(setup.role || 'aventurier');
    return [
      `Canon protagoniste: rôle ${roleLabel} (${setup.role || 'inconnu'}).`,
      `Canon protagoniste: faction ${setup.faction || 'indépendant'} · ère ${setup.era || 'inconnue'}.`,
      `Règle canonique: ne pas changer le rang/role (ex: Padawan ≠ Chevalier/Maître) sans validation explicite du joueur.`
    ];
  }

  function ensureCanonicalIdentityMemory(setup: StorySetup): void {
    mergeMemoryFacts(buildCanonicalIdentityFacts(setup));
  }

  function appendMemoryFromChapter(chapter: StoryChapter): void {
    const explicitFacts = [
      ...chapter.memory_updates.relations
        .filter(item => !MEMORY_LOW_SIGNAL_RELATION_RE.test(item))
        .map(item => `Relation: ${item}`),
      ...chapter.memory_updates.places.map(item => `Lieu: ${item}`),
      ...chapter.memory_updates.injuries.map(item => `Blessure: ${item}`),
      ...chapter.memory_updates.resources.map(item => `Ressource: ${item}`),
      ...chapter.memory_updates.notes.map(item => `Note: ${item}`)
    ].filter(f => f.length > 10);

    const stateFacts: string[] = [];
    const su = chapter.state_update;

    if (su?.location) {
      stateFacts.push(`Tour ${chapter.chapter_number}: déplacement vers ${su.location} (scène: ${chapter.chapter_title})`);
    }

    if (su?.date_advance) {
      stateFacts.push(`Temps avancé: ${su.date_advance}`);
    }

    if (su?.npcs?.length) {
      const meaningfulNpcs = su.npcs
        .filter((npc): npc is Partial<NpcRelation> & { name: string } => Boolean(npc?.name))
        .filter(npc => isMeaningfulNpcMemoryEntry(npc))
        .slice(0, 3);

      for (const npc of meaningfulNpcs) {
        const name = String(npc.name || '').trim();
        if (!name) continue;
        const relation = typeof npc.affinity === 'number'
          ? (npc.affinity > 30 ? 'allié' : npc.affinity < -30 ? 'hostile' : 'neutre')
          : (npc.status && npc.status !== 'unknown' ? npc.status : 'neutre');
        const note = String(npc.note || '').trim();
        stateFacts.push(`PNJ ${name} (${relation}${note ? ` — ${note}` : ''})`);
      }
    }

    if (su?.factions) {
      const factionFacts = Object.entries(su.factions)
        .filter(([, delta]) => delta !== 0)
        .slice(0, 4)
        .map(([id, delta]) => `${id}:${delta > 0 ? '+' : ''}${delta}`);
      if (factionFacts.length) stateFacts.push(`Réputation: ${factionFacts.join(', ')}`);
    }

    if (su?.injuries_new?.length) {
      for (const injury of su.injuries_new.slice(0, 3)) {
        stateFacts.push(`Blessure reçue [${injury.severity}]: ${injury.description}`);
      }
    }

    if (su?.injuries_resolved?.length) {
      stateFacts.push(`Blessures résolues: ${su.injuries_resolved.slice(0, 3).join(', ')}`);
    }

    if (su?.inventory_gained?.length) {
      stateFacts.push(`Obtenu: ${su.inventory_gained.slice(0, 3).map(item => item.qty > 1 ? `${item.qty}× ${item.name}` : item.name).join(', ')}`);
    }

    const mergedFacts = [...explicitFacts, ...stateFacts.filter(f => f.length > 10)];

    const narrativeSnippet = sanitizeNarrativeTextForDisplay(
      chapter.narrative.action || chapter.narrative.context || chapter.narrative.dialogue || ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

    if (narrativeSnippet) {
      mergedFacts.unshift(`Tour ${chapter.chapter_number}: ${chapter.chapter_title} — ${narrativeSnippet}`);
    }

    // Safety net: always keep at least one memory breadcrumb per chapter,
    // even when models omit memory_updates/state_update.
    if (!mergedFacts.length) {
      if (narrativeSnippet) {
        mergedFacts.push(`Tour ${chapter.chapter_number}: ${chapter.chapter_title} — ${narrativeSnippet}`);
      }
    }

    mergeMemoryFacts(mergedFacts);
  }

  const ARCHIVE_TRIGGER_TURN = 30;
  const KEEP_RAW_TURNS = 20;

  function archiveOldTurnsIfNeeded(): void {
    const archiveCount = Math.max(0, chapterHistory.length - KEEP_RAW_TURNS);
    if (chapterHistory.length <= ARCHIVE_TRIGGER_TURN || archiveCount <= campaignArchive.length) return;

    const newlyOld = chapterHistory.slice(campaignArchive.length, archiveCount);
    if (newlyOld.length) {
      campaignArchive = [...campaignArchive, ...newlyOld.map(chapter => summarizeChapterForPrompt(chapter))];
    }

    const systemMessage = aiMessages.find(message => message.role === 'system');
    const otherMessages = aiMessages.filter(message => message.role !== 'system');
    if (otherMessages.length > KEEP_RAW_TURNS * 2) {
      const recentMessages = otherMessages.slice(-(KEEP_RAW_TURNS * 2));
      aiMessages = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
    }
  }

  function backgroundEventToSyntheticChapter(event: BackgroundWorldEvent, turn: number): StoryChapter {
    return {
      chapter_title: event.title || 'Mouvement de la galaxie',
      chapter_number: turn,
      section_type: 'background',
      narrative: {
        context: '',
        action: event.summary_public || '',
        dialogue: '',
        reflection: '',
        atmosphere: 'tense'
      },
      choices: [],
      memory_updates: event.memory_updates,
      scene_description: 'Off-screen galactic world event',
      user_edits_applied: null,
      state_update: event.state_update
    };
  }

  function appendMemoryFromBackgroundEvent(event: BackgroundWorldEvent, turn: number): void {
    const explicitFacts = [
      ...event.memory_updates.relations.map(item => `Relation (off-screen): ${item}`),
      ...event.memory_updates.places.map(item => `Lieu (off-screen): ${item}`),
      ...event.memory_updates.injuries.map(item => `Blessure (off-screen): ${item}`),
      ...event.memory_updates.resources.map(item => `Ressource (off-screen): ${item}`),
      ...event.memory_updates.notes.map(item => `Note (off-screen): ${item}`)
    ];

    const summary = event.summary_private || event.summary_public;
    const syntheticFacts = [
      summary ? `Tour ${turn} (galaxie): ${summary}` : '',
      event.prompt_hook ? `Hook MJ: ${event.prompt_hook}` : ''
    ];

    mergeMemoryFacts([...explicitFacts, ...syntheticFacts]);
  }

  function createBackgroundEventId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `bg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function runBackgroundWorldTick(setup: StorySetup, turn: number, recentSectionTypes: string[] = []): Promise<void> {
    if (!providerConfig) return;
    if (!supportsAgenticToolCalling(providerConfig.providerId, providerConfig.model)) return;

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
        providerConfig
      );

      const event = generation.event;
      if (!event || !event.inject_now) return;
      if (isNearDuplicateBackgroundEvent(event, backgroundEvents)) return;

      if (event.state_update) {
        applyStateUpdate(backgroundEventToSyntheticChapter(event, turn));
      }

      appendMemoryFromBackgroundEvent(event, turn);

      const summary = event.summary_public || event.prompt_hook || event.title;
      backgroundEvents = [
        {
          id: createBackgroundEventId(),
          turn,
          title: event.title || 'Mouvement de la galaxie',
          summary,
          promptHook: event.prompt_hook,
          privateSummary: event.summary_private
        },
        ...backgroundEvents
      ].slice(0, 24);

      if (summary) {
        showToast(`Événement galactique: ${summary}`, 'warning');
      }
    } catch (error) {
      logger.warn('editor: tick hors-écran ignoré.', error);
    }
  }

  async function persistInteractiveState(setup: StorySetup): Promise<void> {
    updateTitle(buildStoryTitle(setup));
    updateContent(buildJournalContent(chapterHistory));

    if (storyId) {
      await saveStory();
    }

    saveInteractiveSession();
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

    archiveOldTurnsIfNeeded();

    const promptMode = resolvePromptMode();
    const memoryFactsForPrompt = Array.from(new Set([
      ...buildCanonicalIdentityFacts(setup),
      ...memoryLog
    ]));
    const systemPrompt = buildSystemPrompt(setup, memoryFactsForPrompt, worldState, promptMode, turn, campaignArchive);
    aiMessages = [{ role: 'system', content: systemPrompt }, ...aiMessages.filter(message => message.role !== 'system')];

    const requestMessages = trimMessages([
      ...aiMessages,
      { role: 'user', content: prompt }
    ]);

    const generation = await generateStoryTurn(requestMessages, providerConfig, turn);
    const chapter = sanitizeChapterForDisplay(enforceTransitionChoiceQuality(generation.chapter, worldState)) as StoryChapter;
    const assistantContent = generation.rawResponse || JSON.stringify(chapter);

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
      ensureCanonicalIdentityMemory(setup);

      const trameLabel = TRAMES.find(item => item.id === selectedTrame)?.name || null;
      const prompt = buildStartPrompt(setup, trameLabel, resolvePromptMode());
      const chapter = await requestStoryChapter(prompt, setup, 1);

      currentChapter = chapter;
      chapterHistory = [chapter];
      actionHistory = ['Prologue IA'];

      applyStateUpdate(chapter);
      appendMemoryFromChapter(chapter);
      archiveOldTurnsIfNeeded();
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

  async function continueAdventure(actionText: string): Promise<void> {
    const action = actionText.trim();
    if (!action || generating) return;

    const setup = ensureSetupDefaults();
    generationError = '';
    generating = true;

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
        sceneAnchor
      );

      const chapter = await requestStoryChapter(prompt, setup, nextTurn);

      turnNumber = nextTurn;
      currentChapter = chapter;
      chapterHistory = [...chapterHistory, chapter].slice(-60);
      actionHistory = [...actionHistory, action].slice(-60);

      applyStateUpdate(chapter);
      appendMemoryFromChapter(chapter);
      archiveOldTurnsIfNeeded();

      await runBackgroundWorldTick(setup, nextTurn, recentSectionTypes);
      await persistInteractiveState(setup);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      generationError = message;
      showToast(`Échec du tour: ${message}`, 'error');
    } finally {
      generating = false;
    }
  }

  function handleChoice(choice: StoryChoice): void {
    void continueAdventure(choice.text);
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

  function goToSetupStep(index: number): void {
    const boundedIndex = Math.max(0, Math.min(SETUP_SCREENS.length - 1, index));
    if (boundedIndex === setupScreenIndex) return;
    setupSlideDir = boundedIndex > setupScreenIndex ? 1 : -1;
    setupScreenIndex = boundedIndex;
  }

  function nextSetupStep(): void {
    if (isLastSetupStep) {
      void launchAdventure();
      return;
    }
    goToSetupStep(setupScreenIndex + 1);
  }

  function previousSetupStep(): void {
    goToSetupStep(setupScreenIndex - 1);
  }

  function selectEra(eraId: string): void {
    updateSetupField('era', eraId);
  }

  function selectFaction(factionId: string): void {
    updateSetupField('faction', factionId);
    const setup = get(currentSetup);
    if (!setup.role) {
      updateSetupField('role', defaultRoleForFaction(factionId));
    }
  }

  function selectRole(roleId: string): void {
    updateSetupField('role', roleId);
  }

  function selectTrame(trame: (typeof TRAMES)[number]): void {
    selectedTrame = trame.id;
    if (trame.premise) {
      updateSetupField('premise', trame.premise);
    }
  }

  function selectWritingStyle(styleId: string): void {
    updateSetupField('writingStyle', styleId);
  }

  function selectWritingTone(toneId: string): void {
    updateSetupField('writingTone', toneId);
  }

  function selectWritingPov(povId: string): void {
    updateSetupField('writingPov', povId);
  }

  function selectWritingLength(lengthId: string): void {
    updateSetupField('writingLength', lengthId);
  }

  function selectContentMode(modeId: string): void {
    updateSetupField('contentMode', modeId);
  }

  function selectAvatar(avatar: string): void {
    updateSetupField('protagonistAvatar', avatar);
  }

  function handleFirstNameInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    updateSetupField('protagonistFirstName', target.value);
  }

  function handleLastNameInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    updateSetupField('protagonistLastName', target.value);
  }

  function handlePremiseInput(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement;
    updateSetupField('premise', target.value);
  }

  function getFilteredRoles() {
    const selectedFaction = get(currentSetup).faction;
    if (!selectedFaction) return ROLES;

    const byPriority = (faction: string): number => {
      if (faction === selectedFaction) return 0;
      if (faction === 'neutral') return 1;
      return 2;
    };

    return [...ROLES].sort((left, right) => {
      const diff = byPriority(left.faction) - byPriority(right.faction);
      if (diff !== 0) return diff;
      return left.name.localeCompare(right.name);
    });
  }

  function getCurrentEraLabel(): string {
    return ERAS.find(era => era.id === get(currentSetup).era)?.name || '—';
  }

  function getCurrentFactionLabel(): string {
    return FACTIONS.find(faction => faction.id === get(currentSetup).faction)?.name || '—';
  }

  function getCurrentRoleLabel(): string {
    return ROLES.find(role => role.id === get(currentSetup).role)?.name || '—';
  }

  function getCurrentStyleLabel(): string {
    return WRITING_STYLES.find(style => style.id === get(currentSetup).writingStyle)?.name || '—';
  }

  function getCurrentToneLabel(): string {
    return WRITING_TONES.find(tone => tone.id === get(currentSetup).writingTone)?.name || '—';
  }

  function getCurrentContentModeLabel(): string {
    return CONTENT_MODES.find(modeItem => modeItem.id === get(currentSetup).contentMode)?.name || '—';
  }

  function goToSettings(): void {
    void goto('/settings');
  }

  function goBackToSetupFromPlay(): void {
    mode = 'setup';
    goToSetupStep(SETUP_SCREENS.length - 1);
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
      const session = loadInteractiveSession(storyId);
      if (session) {
        turnNumber = session.turnNumber;
        selectedTrame = session.selectedTrame;
        currentChapter = sanitizeChapterForDisplay(session.currentChapter);
        chapterHistory = sanitizeChapterList(session.chapterHistory);
        actionHistory = session.actionHistory;
        aiMessages = session.aiMessages;
        memoryLog = session.memoryLog;
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
        ensureCanonicalIdentityMemory(setupForRepair);
        if (worldStateNeedsRepair(session.worldState)) {
          worldState = rebuildWorldStateFromHistory(setupForRepair, chapterHistory, session.worldState);
          saveInteractiveSession();
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

    loading = false;

    if (preferences.autoSave) {
      startAutoSave(preferences.autoSaveInterval);
    }
  });

  onDestroy(() => {
    stopAutoSave();
  });
</script>

<svelte:head>
  <title>{storyId ? 'Aventure interactive' : 'Nouvelle aventure IA'} — Star Wars Story Manager</title>
</svelte:head>

<div class="editor-layout">
  <main class="editor-main">
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

    <div class="editor-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      {:else if mode === 'setup'}
        <div class="setup-shell">
          <div class="setup-progress" role="tablist" aria-label="Étapes de configuration">
            {#each SETUP_SCREENS as screen, index}
              <button
                type="button"
                class="progress-pill"
                class:active={index === setupScreenIndex}
                class:done={index < setupScreenIndex}
                on:click={() => goToSetupStep(index)}
              >
                <span class="pill-index">{index + 1}</span>
                <span class="pill-label">{screen.label}</span>
              </button>
            {/each}
          </div>

          <div class="setup-stage">
            {#key activeSetupStep.id}
              <section
                class="setup-screen"
                in:fly={{ x: setupSlideDir * 80, duration: 220, opacity: 0 }}
                out:fly={{ x: -setupSlideDir * 80, duration: 180, opacity: 0 }}
              >
                <header class="setup-screen-header">
                  <h1>{activeSetupStep.label}</h1>
                  <p>{activeSetupStep.subtitle}</p>
                </header>

                {#if activeSetupStep.id === 'era'}
                  <div class="era-grid">
                    {#each ERAS as era}
                      <button
                        class="era-card"
                        class:selected={$currentSetup.era === era.id}
                        on:click={() => selectEra(era.id)}
                      >
                        <span class="era-icon">
                          <SvgIcon filename={era.icon} size={40} color="currentColor" alt={era.name} />
                        </span>
                        <span class="era-name">{era.name}</span>
                        <span class="era-years">{era.years}</span>
                      </button>
                    {/each}
                  </div>
                {:else if activeSetupStep.id === 'faction_role'}
                  <div class="split-grid">
                    <section>
                      <h2 class="subheading">Faction</h2>
                      <div class="faction-grid">
                        {#each FACTIONS as faction}
                          <button
                            class="faction-card"
                            class:selected={$currentSetup.faction === faction.id}
                            style="--faction-color: {faction.color}"
                            on:click={() => selectFaction(faction.id)}
                          >
                            <span class="faction-icon">
                              <SvgIcon filename={faction.icon} size={34} color="currentColor" alt={faction.name} />
                            </span>
                            <span class="faction-name">{faction.name}</span>
                          </button>
                        {/each}
                      </div>
                    </section>

                    <section>
                      <h2 class="subheading">Rôle</h2>
                      <div class="role-grid">
                        {#each getFilteredRoles() as role}
                          <button
                            class="role-card"
                            class:selected={$currentSetup.role === role.id}
                            class:recommended={$currentSetup.faction && (role.faction === $currentSetup.faction || role.faction === 'neutral')}
                            on:click={() => selectRole(role.id)}
                          >
                            <span class="role-icon">
                              <SvgIcon filename={role.icon} size={26} color="currentColor" alt={role.name} />
                            </span>
                            <span class="role-name">{role.name}</span>
                          </button>
                        {/each}
                      </div>
                    </section>
                  </div>
                {:else if activeSetupStep.id === 'premise'}
                  <div class="trame-grid">
                    {#each TRAMES as trame}
                      <button
                        class="trame-card"
                        class:selected={selectedTrame === trame.id}
                        on:click={() => selectTrame(trame)}
                      >
                        <span class="trame-icon">{trame.icon}</span>
                        <span class="trame-name">{trame.name}</span>
                      </button>
                    {/each}
                  </div>

                  <label class="premise-label" for="premise-input">Prémisse (modifiable, facultative)</label>
                  <textarea
                    id="premise-input"
                    class="premise-input"
                    placeholder="Laissez vide pour une ouverture générée automatiquement..."
                    value={$currentSetup.premise}
                    on:input={handlePremiseInput}
                    rows="5"
                  ></textarea>
                {:else if activeSetupStep.id === 'style'}
                  <div class="style-stack">
                    <section>
                      <h2 class="subheading">Style</h2>
                      <div class="style-grid">
                        {#each WRITING_STYLES as style}
                          <button
                            class="style-card"
                            class:selected={$currentSetup.writingStyle === style.id}
                            on:click={() => selectWritingStyle(style.id)}
                          >
                            <span class="style-name">{style.name}</span>
                            <span class="style-desc">{style.desc}</span>
                          </button>
                        {/each}
                      </div>
                    </section>

                    <section>
                      <h2 class="subheading">Ton</h2>
                      <div class="tone-grid">
                        {#each WRITING_TONES as tone}
                          <button
                            class="tone-chip"
                            class:selected={$currentSetup.writingTone === tone.id}
                            on:click={() => selectWritingTone(tone.id)}
                          >
                            {tone.name}
                          </button>
                        {/each}
                      </div>
                    </section>

                    <section class="double-stack">
                      <div>
                        <h2 class="subheading">Point de vue</h2>
                        <div class="toggle-chip-group">
                          {#each WRITING_POVS as pov}
                            <button
                              class="toggle-chip"
                              class:active={$currentSetup.writingPov === pov.id}
                              on:click={() => selectWritingPov(pov.id)}
                            >
                              {pov.name}
                            </button>
                          {/each}
                        </div>
                      </div>
                      <div>
                        <h2 class="subheading">Longueur</h2>
                        <div class="toggle-chip-group">
                          {#each WRITING_LENGTHS as length}
                            <button
                              class="toggle-chip"
                              class:active={$currentSetup.writingLength === length.id}
                              on:click={() => selectWritingLength(length.id)}
                            >
                              {length.name}
                            </button>
                          {/each}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 class="subheading">Intensité</h2>
                      <div class="content-mode-grid">
                        {#each CONTENT_MODES as modeOption}
                          <button
                            class="content-mode-card"
                            class:selected={$currentSetup.contentMode === modeOption.id}
                            on:click={() => selectContentMode(modeOption.id)}
                          >
                            <span class="content-mode-icon">{modeOption.icon}</span>
                            <span class="content-mode-name">{modeOption.name}</span>
                            <span class="content-mode-desc">{modeOption.desc}</span>
                          </button>
                        {/each}
                      </div>
                    </section>
                  </div>
                {:else if activeSetupStep.id === 'profile'}
                  <div class="profile-card">
                    <p class="helper-text">Le nom est facultatif. Vous pouvez lancer l'aventure sans le renseigner.</p>

                    <div class="avatar-row">
                      {#each AVATARS as avatar}
                        <button
                          class="avatar-btn"
                          class:selected={$currentSetup.protagonistAvatar === avatar}
                          on:click={() => selectAvatar(avatar)}
                          aria-label={`Avatar ${avatar}`}
                        >
                          {avatar}
                        </button>
                      {/each}
                    </div>

                    <div class="name-grid">
                      <label class="name-field">
                        <span>Prénom (facultatif)</span>
                        <input
                          class="name-input"
                          type="text"
                          placeholder="Ex: Luke"
                          value={$currentSetup.protagonistFirstName || ''}
                          on:input={handleFirstNameInput}
                        />
                      </label>
                      <label class="name-field">
                        <span>Nom (facultatif)</span>
                        <input
                          class="name-input"
                          type="text"
                          placeholder="Ex: Skywalker"
                          value={$currentSetup.protagonistLastName || ''}
                          on:input={handleLastNameInput}
                        />
                      </label>
                    </div>
                  </div>
                {:else}
                  <div class="review-grid">
                    <div class="review-card">
                      <h2>Résumé</h2>
                      <ul>
                        <li><strong>Ère:</strong> {getCurrentEraLabel()}</li>
                        <li><strong>Faction:</strong> {getCurrentFactionLabel()}</li>
                        <li><strong>Rôle:</strong> {getCurrentRoleLabel()}</li>
                        <li><strong>Style:</strong> {getCurrentStyleLabel()} / {getCurrentToneLabel()}</li>
                        <li><strong>Intensité:</strong> {getCurrentContentModeLabel()}</li>
                        <li><strong>Provider:</strong> {providerStatus}</li>
                      </ul>
                    </div>

                    <div class="review-card">
                      <h2>Ce qui change maintenant</h2>
                      <ul class="feature-list">
                        <li>✅ L'histoire démarre immédiatement (pas besoin d'écrire à la main).</li>
                        <li>✅ Les noms sont facultatifs.</li>
                        <li>✅ Vous jouez avec des choix + réponse personnalisée.</li>
                        <li>✅ Une mémoire de session est conservée pour la cohérence.</li>
                      </ul>

                      {#if providerMissing}
                        <div class="provider-warning">
                          <p>Aucun provider texte actif. Configurez l'IA texte avant de lancer.</p>
                          <button class="btn btn-secondary" on:click={goToSettings}>Ouvrir les paramètres IA</button>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </section>
            {/key}
          </div>

          <div class="setup-nav">
            <button class="btn btn-secondary" on:click={previousSetupStep} disabled={setupScreenIndex === 0 || generating}>
              ← Retour
            </button>

            <button class="btn btn-primary" on:click={nextSetupStep} disabled={generating}>
              {#if isLastSetupStep}
                {#if generating}
                  Lancement de l'aventure…
                {:else}
                  Lancer l'aventure IA
                {/if}
              {:else}
                Suivant →
              {/if}
            </button>
          </div>

          {#if generationError}
            <div class="error-banner">{generationError}</div>
          {/if}
        </div>
      {:else}
        <div class="play-shell" class:hud-open={!hudCollapsed}>

          <!-- ── Topbar ──────────────────────────────────── -->
          <div class="play-topbar">
            <div class="turn-indicator">
              <span class="turn-dot"></span>
              Tour&nbsp;<strong>{turnNumber || 1}</strong>
            </div>

            <!-- Model chip -->
            {#if providerConfig}
              <div class="model-chip" title={providerStatus}>
                {#if supportsAgenticToolCalling(providerConfig.providerId, providerConfig.model)}
                  <span class="model-chip-dot agentic"></span>
                {:else}
                  <span class="model-chip-dot"></span>
                {/if}
                <span class="model-chip-name">
                  {(providerConfig.model || 'auto').split('/').pop()?.split(':')[0] ?? 'auto'}
                </span>
                {#if supportsAgenticToolCalling(providerConfig.providerId, providerConfig.model)}
                  <span class="model-chip-tag">⚡</span>
                {/if}
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
          <GameHUD {worldState} bind:collapsed={hudCollapsed} {turnNumber} />

          <!-- ── Scrollable narrative zone ──────────────── -->
          <div class="play-scroll-area">

            {#if generationError}
              <div class="error-banner">{generationError}</div>
            {/if}

            {#if backgroundEvents.length > 0}
              <details class="world-events-panel" aria-label="Événements galactiques hors écran">
                <summary class="world-events-header">
                  <h3>Mouvements de la galaxie</h3>
                  <span class="world-events-count">{backgroundEvents.length}</span>
                </summary>
                <div class="world-events-list">
                  {#each backgroundEvents.slice(0, 3) as event}
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

                    {#if currentChapter.narrative.action}
                      <div class="n-block n-action">
                        <span class="n-tag n-tag--action">Action</span>
                        {#each splitNarrativeParagraphs(currentChapter.narrative.action) as para}
                          <p class="n-paragraph" class:n-paragraph--dialogue={para.kind === 'dialogue'}>{para.text}</p>
                        {/each}
                      </div>
                    {/if}

                    {#if currentChapter.narrative.dialogue}
                      <div class="n-block n-dialogue">
                        <span class="n-tag n-tag--dialogue">Dialogue</span>
                        {#each splitNarrativeParagraphs(currentChapter.narrative.dialogue) as para}
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
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .editor-content {
    flex: 1;
    padding: var(--space-lg) var(--space-xl);
    overflow-y: auto;
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
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .setup-shell {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    min-height: calc(100vh - 180px);
  }

  .setup-progress {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .progress-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 6px 12px;
    background: var(--color-bg-secondary);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.75rem;
  }

  .progress-pill.active {
    border-color: var(--color-gold);
    color: var(--color-gold);
    background: rgba(255, 232, 31, 0.1);
  }

  .progress-pill.done {
    border-color: color-mix(in srgb, var(--color-gold) 55%, var(--color-border));
    color: var(--color-text-secondary);
  }

  .pill-index {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    font-size: 0.65rem;
    font-weight: 700;
  }

  .setup-stage {
    position: relative;
    flex: 1;
    min-height: 560px;
    overflow: hidden;
  }

  .setup-screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-bg-secondary);
    overflow-y: auto;
  }

  .setup-screen-header h1 {
    margin: 0;
    font-size: 1.6rem;
    color: var(--color-text-primary);
  }

  .setup-screen-header p {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-muted);
  }

  .setup-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .subheading {
    margin: 0 0 var(--space-sm);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .era-grid,
  .faction-grid,
  .role-grid,
  .trame-grid,
  .style-grid,
  .content-mode-grid {
    display: grid;
    gap: var(--space-sm);
  }

  .era-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .faction-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .role-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    max-height: 360px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .trame-grid {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }

  .style-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .content-mode-grid {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }

  .split-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-lg);
  }

  .era-card,
  .faction-card,
  .role-card,
  .trame-card,
  .style-card,
  .content-mode-card,
  .tone-chip,
  .toggle-chip,
  .avatar-btn {
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .era-card,
  .faction-card,
  .trame-card,
  .style-card,
  .content-mode-card {
    text-align: left;
    padding: var(--space-md);
  }

  .era-card:hover,
  .faction-card:hover,
  .role-card:hover,
  .trame-card:hover,
  .style-card:hover,
  .content-mode-card:hover,
  .tone-chip:hover,
  .toggle-chip:hover,
  .avatar-btn:hover {
    border-color: var(--color-gold);
  }

  .era-card.selected,
  .faction-card.selected,
  .role-card.selected,
  .trame-card.selected,
  .style-card.selected,
  .content-mode-card.selected,
  .tone-chip.selected,
  .toggle-chip.active,
  .avatar-btn.selected {
    border-color: var(--color-gold);
    background: rgba(255, 232, 31, 0.1);
  }

  .era-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    align-items: center;
    text-align: center;
  }

  .era-icon,
  .faction-icon,
  .role-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gold);
  }

  .era-years {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .faction-card {
    border-left-color: var(--faction-color);
  }

  .faction-card.selected {
    border-color: var(--faction-color);
    background: color-mix(in srgb, var(--faction-color) 14%, transparent);
  }

  .role-card {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    text-align: left;
  }

  .role-card.recommended {
    border-color: color-mix(in srgb, var(--color-gold) 40%, var(--color-border));
  }

  .trame-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-xs);
    padding: var(--space-md) var(--space-sm);
  }

  .trame-icon {
    font-size: 1.35rem;
  }

  .trame-name {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .premise-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .premise-input,
  .name-input {
    width: 100%;
    border: 1px solid var(--color-border);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    resize: vertical;
    font: inherit;
    transition: border-color var(--transition-fast);
  }

  .premise-input:focus,
  .name-input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .style-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .style-name {
    font-weight: 600;
  }

  .style-desc,
  .content-mode-desc {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .tone-grid,
  .toggle-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .tone-chip,
  .toggle-chip {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.85rem;
  }

  .double-stack {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-md);
  }

  .content-mode-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .content-mode-icon {
    font-size: 1.25rem;
  }

  .profile-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .helper-text {
    margin: 0;
    color: var(--color-text-muted);
  }

  .avatar-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .avatar-btn {
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
  }

  .name-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-md);
  }

  .name-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .name-field span {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-md);
  }

  .review-card {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }

  .review-card h2 {
    margin: 0 0 var(--space-sm);
    font-size: 1rem;
  }

  .review-card ul {
    margin: 0;
    padding-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .feature-list {
    list-style: none;
    padding-left: 0;
  }

  .provider-warning {
    margin-top: var(--space-md);
    padding: var(--space-sm);
    border: 1px solid rgba(255, 23, 68, 0.45);
    border-radius: var(--radius-sm);
    background: rgba(255, 23, 68, 0.08);
  }

  .provider-warning p {
    margin: 0 0 var(--space-sm);
    color: var(--color-red);
  }

  .error-banner {
    border: 1px solid rgba(255, 23, 68, 0.5);
    background: rgba(255, 23, 68, 0.1);
    color: #ff8fa3;
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    font-size: 0.9rem;
  }

  /* ═══════════════════════════════════════════
     PLAY SHELL
  ═══════════════════════════════════════════ */
  .play-shell {
    --hud-width: 228px;
    --hud-gap: 18px;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    max-width: 740px;
    margin: 0 auto;
    width: 100%;
    padding-bottom: calc(var(--space-xl) * 2);
  }

  @media (min-width: 1160px) {
    .play-shell.hud-open {
      max-width: calc(740px + var(--hud-width) + var(--hud-gap));
      padding-right: calc(var(--hud-width) + var(--hud-gap));
    }
  }

  /* Scroll / action zone wrappers — desktop: regular flex columns */
  .play-scroll-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .play-action-zone {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  /* Header icon-label buttons */
  .btn-icon-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .world-events-panel {
    border: 1px solid color-mix(in srgb, var(--color-gold) 25%, var(--color-border));
    background: color-mix(in srgb, var(--color-gold) 4%, var(--color-bg-secondary));
    border-radius: var(--radius-lg);
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
    font-size: 0.82rem;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .world-events-count {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 1px 7px;
  }

  .world-events-list {
    display: grid;
    gap: var(--space-xs);
  }

  .world-event-item {
    border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-bg-tertiary) 65%, transparent);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .world-event-item strong {
    font-size: 0.88rem;
    color: var(--color-text-secondary);
  }

  .world-event-item p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .world-event-meta {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .world-event-meta span {
    font-size: 0.62rem;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--color-gold);
    opacity: 0.85;
  }

  /* ── Topbar ─────────────────────────────── */
  .play-topbar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .turn-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .turn-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-gold);
    box-shadow: 0 0 5px var(--color-gold);
    animation: pulse-dot 2.4s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  .mem-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 2px 8px;
    opacity: 0.6;
  }

  .topbar-link {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }

  .topbar-link:hover:not(:disabled) {
    color: var(--color-text-secondary);
    text-decoration-color: currentColor;
  }

  /* ── Model chip ─────────────────────────── */
  .model-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 5px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    font-size: 0.68rem;
    color: var(--color-text-muted);
    max-width: 160px;
    overflow: hidden;
  }

  .model-chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-text-muted);
  }

  .model-chip-dot.agentic {
    background: #4ade80;
    box-shadow: 0 0 5px rgba(74,222,128,0.6);
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
    font-size: 0.6rem;
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
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .holonet-ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(255, 232, 31, 0.15);
    border-radius: 50%;
    animation: holonet-spin 1.4s linear infinite;
  }

  .holonet-ring--2 {
    inset: 7px;
    border-color: rgba(255, 232, 31, 0.3);
    animation-direction: reverse;
    animation-duration: 0.9s;
  }

  .holonet-core {
    width: 24px;
    height: 24px;
    background: rgba(255, 232, 31, 0.12);
    border: 1px solid rgba(255, 232, 31, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gold);
    animation: holonet-pulse 1.4s ease-in-out infinite;
  }

  @keyframes holonet-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes holonet-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 232, 31, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(255, 232, 31, 0); }
  }

  .gen-label {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--color-gold);
    letter-spacing: 0.3px;
    font-family: var(--font-display);
  }

  .gen-sub {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  /* ═══════════════════════════════════════════
     CHAPTER CARD
  ═══════════════════════════════════════════ */
  .chapter-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  /* Header */
  .chapter-header {
    padding: var(--space-xl) var(--space-xl) var(--space-lg);
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  }

  .chapter-eyebrow {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .chapter-num {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--color-gold);
  }

  .chapter-sep {
    color: var(--color-text-muted);
    opacity: 0.4;
  }

  .chapter-type {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .chapter-title {
    margin: 0;
    font-size: clamp(1.72rem, 1.56rem + 0.45vw, 1.95rem);
    font-weight: 800;
    color: var(--color-text-primary);
    line-height: 1.2;
    letter-spacing: -0.025em;
  }

  /* ── Narrative flow ─────────────────────── */
  .narrative {
    padding: 0 var(--space-xl) var(--space-md);
    max-width: 680px;
    margin: 0 auto;
  }

  .n-block {
    padding: calc(var(--space-md) + 4px) 0;
    position: relative;
  }

  .n-block + .n-block {
    border-top: 1px solid rgba(255, 232, 31, 0.12);
    margin-top: var(--space-sm);
  }

  .n-tag {
    display: block;
    font-size: 0.65rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--color-gold);
    margin-bottom: 10px;
    opacity: 0.9;
  }

  .n-tag--action     { color: #c8960f; }
  .n-tag--dialogue   { color: #5aaed4; }
  .n-tag--reflection { color: #8e7ab8; }

  /* Prose shared */
  .n-block p {
    margin: 0;
    line-height: 1.9;
    font-size: clamp(1rem, 0.97rem + 0.2vw, 1.07rem);
    text-wrap: pretty;
    text-align: left;
  }

  .n-block p + p { margin-top: 1.1em; }

  .n-paragraph {
    padding-left: 0;
  }

  .n-paragraph--dialogue {
    margin-left: 0.5rem;
    padding: 0.4rem 0 0.4rem 1rem;
    border-left: 3px solid #4FC3F7;
    background: rgba(79, 195, 247, 0.1);
    color: #b8e4f4;
    font-style: italic;
    border-radius: 0 4px 4px 0;
    font-size: 1.02em;
  }

  /* Context */
  .n-context p { color: color-mix(in srgb, var(--color-text-primary) 90%, white 10%); }

  /* Action — slightly more weight */
  .n-action p {
    color: var(--color-text-primary);
    font-size: clamp(1.02rem, 1rem + 0.2vw, 1.1rem);
    font-weight: 500;
  }

  /* Dialogue — screenplay style */
  .n-dialogue {
    padding: var(--space-sm) var(--space-md);
    border-left: 3px solid color-mix(in srgb, #5aaed4 45%, transparent);
    background: color-mix(in srgb, #5aaed4 8%, transparent);
    border-radius: var(--radius-md);
  }

  .n-dialogue p {
    color: color-mix(in srgb, #5aaed4 90%, white 10%);
    font-style: italic;
  }

  /* Reflection — tinted box */
  .n-reflection {
    background: color-mix(in srgb, #8e7ab8 10%, var(--color-bg-tertiary));
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    border-top: none !important;
    margin-top: var(--space-lg);
    border: 1px solid color-mix(in srgb, #8e7ab8 25%, var(--color-border));
  }

  .n-reflection p {
    color: color-mix(in srgb, var(--color-text-secondary) 88%, white 12%);
    font-style: normal;
    font-size: clamp(0.98rem, 0.95rem + 0.15vw, 1.02rem);
  }

  /* ═══════════════════════════════════════════
     CHOICES
  ═══════════════════════════════════════════ */
  .choices-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
    padding-top: var(--space-md);
    border-top: 1px solid rgba(255, 232, 31, 0.2);
  }

  .choices-heading {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .choices-heading::before {
    content: '';
    display: inline-block;
    width: 24px;
    height: 2px;
    background: var(--color-gold);
    border-radius: 1px;
    flex-shrink: 0;
  }

  .choice-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .choice-btn {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    transition:
      border-color var(--transition-fast),
      background   var(--transition-fast),
      transform    var(--transition-fast);
  }

  .choice-btn:hover:not(:disabled) {
    border-color: var(--color-gold);
    background: color-mix(in srgb, var(--color-gold) 5%, var(--color-bg-secondary));
    transform: translateX(3px);
  }

  .choice-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .choice-btn.choice-danger {
    border-color: rgba(248, 113, 113, 0.4);
  }

  .choice-btn.choice-danger .choice-key {
    background: color-mix(in srgb, #f87171 15%, transparent);
    border-right-color: color-mix(in srgb, #f87171 20%, transparent);
    color: #f87171;
  }

  .choice-btn.choice-disabled {
    border-color: rgba(255,255,255,0.06);
    opacity: 0.38;
  }

  .choice-warning {
    font-size: 0.6rem;
    font-weight: 700;
    color: #f87171;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .pip.pip-bonus { background: #f87171; }

  /* Letter key */
  .choice-key {
    flex-shrink: 0;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--color-gold) 15%, transparent);
    border-right: 1px solid color-mix(in srgb, var(--color-gold) 20%, transparent);
    font-size: 0.72rem;
    font-weight: 900;
    color: var(--color-gold);
    letter-spacing: 0.5px;
    font-variant-numeric: tabular-nums;
  }

  .choice-btn:hover:not(:disabled) .choice-key {
    background: color-mix(in srgb, var(--color-gold) 22%, transparent);
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
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .choice-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .choice-attr {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: capitalize;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 2px 6px;
  }

  .choice-pips {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-border);
  }

  .pip.on { background: var(--color-gold); }

  /* Dynamic Choice Attributes */
  .choice-btn[data-attr="combat"] .choice-attr { color: #f87171; border-color: rgba(248, 113, 113, 0.4); background: rgba(248, 113, 113, 0.08); }
  .choice-btn[data-attr="diplomacy"] .choice-attr { color: #5aaed4; border-color: rgba(90, 174, 212, 0.4); background: rgba(90, 174, 212, 0.08); }
  .choice-btn[data-attr="tech"] .choice-attr { color: #4ade80; border-color: rgba(74, 222, 128, 0.4); background: rgba(74, 222, 128, 0.08); }
  .choice-btn[data-attr="survival"] .choice-attr { color: #f59e0b; border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.08); }
  .choice-btn[data-attr="force"] .choice-attr { color: #c084fc; border-color: rgba(192, 132, 252, 0.4); background: rgba(192, 132, 252, 0.08); }

  /* ═══════════════════════════════════════════
     CUSTOM ACTION
  ═══════════════════════════════════════════ */
  .custom-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .custom-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
    letter-spacing: 0.5px;
  }

  .custom-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .custom-input {
    flex: 1;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg-secondary) 50%, var(--color-bg-tertiary));
    color: var(--color-text-primary);
    border-radius: var(--radius-lg);
    padding: 12px var(--space-md);
    resize: none;
    font: inherit;
    font-size: 0.95rem;
    line-height: 1.55;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .custom-input:focus {
    outline: none;
    border-color: var(--color-gold);
    background: var(--color-bg-tertiary);
  }

  .custom-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.85;
  }

  .custom-send {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-gold);
    background: var(--color-gold);
    color: #0a0a0a;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }

  .custom-send:hover:not(:disabled) { opacity: 0.85; transform: scale(1.05); }
  .custom-send:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ═══════════════════════════════════════════
     MEMORY PANEL
  ═══════════════════════════════════════════ */
  .memory-panel {
    border: 1px dashed color-mix(in srgb, var(--color-border) 60%, transparent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-bg-secondary) 40%, transparent);
    overflow: hidden;
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }

  .memory-panel[open], .memory-panel:hover {
    border-style: solid;
    border-color: var(--color-border);
    background: var(--color-bg-secondary);
  }

  .memory-panel summary {
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    font-weight: 600;
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
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    list-style: none;
  }

  .mem-list li::before { content: '— '; opacity: 0.4; }

  .memory-empty {
    margin: 0;
    padding: 8px var(--space-md) var(--space-sm);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  @media (max-width: 920px) {
    .split-grid {
      grid-template-columns: 1fr;
    }

    .setup-screen {
      padding: var(--space-md);
    }
  }

  @media (max-width: 720px) {
    .editor-content {
      padding: var(--space-md);
    }

    .setup-shell {
      min-height: calc(100vh - 150px);
    }

    .setup-stage {
      min-height: 520px;
    }

    .progress-pill {
      font-size: 0.7rem;
      padding: 6px 10px;
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
    }

    /* Topbar: compact strip */
    .play-topbar {
      flex-shrink: 0;
      flex-wrap: nowrap;
      gap: 6px;
      padding: 8px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
      border-top: 1px solid rgba(255, 255, 255, 0.08);
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

    /* Setup — grids 2 colonnes */
    .era-grid,
    .faction-grid,
    .role-grid,
    .trame-grid,
    .style-grid,
    .content-mode-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }

    /* Setup stage */
    .setup-stage { min-height: auto; }
    .setup-screen { position: static; }
    .split-grid { grid-template-columns: 1fr; }
    .setup-shell { min-height: calc(100dvh - 140px); gap: 12px; }
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
