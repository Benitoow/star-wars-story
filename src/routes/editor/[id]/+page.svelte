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
  import { getPreferences, type UserPreferences } from '$lib/db';
  import SvgIcon from '$lib/components/SvgIcon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import GameHUD from '$lib/components/GameHUD.svelte';
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

  type SetupScreenId = 'era' | 'faction_role' | 'premise' | 'style' | 'profile' | 'review';
  type SetupScreen = {
    id: SetupScreenId;
    label: string;
    subtitle: string;
  };

  const SETUP_SCREENS: SetupScreen[] = [
    { id: 'era', label: 'Ère', subtitle: 'Quand commence votre histoire ?' },
    { id: 'faction_role', label: 'Faction & rôle', subtitle: 'Qui êtes-vous dans cette galaxie ?' },
    { id: 'premise', label: 'Trame', subtitle: 'Quel est le point de départ ?' },
    { id: 'style', label: 'Style IA', subtitle: `Comment doit écrire l'IA ?` },
    { id: 'profile', label: 'Protagoniste', subtitle: 'Nom facultatif, avatar rapide' },
    { id: 'review', label: 'Lancement', subtitle: `On démarre l'aventure immédiatement` }
  ];

  const INTERACTIVE_SESSION_PREFIX = 'sw_svelte_interactive_story_';

  interface LoggedBackgroundEvent {
    id: string;
    turn: number;
    title: string;
    summary: string;
    promptHook?: string;
    privateSummary?: string;
  }

  interface InteractiveSessionPayload {
    version: 1;
    turnNumber: number;
    selectedTrame: string | null;
    currentChapter: StoryChapter | null;
    chapterHistory: StoryChapter[];
    actionHistory: string[];
    aiMessages: ChatMessage[];
    memoryLog: string[];
    setupSnapshot: StorySetup;
    backgroundEvents?: LoggedBackgroundEvent[];
    worldState?: WorldState;
  }

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
  let customAction = '';
  let hudCollapsed = false;

  const ERA_START_DATES: Record<string, string> = {
    old_republic: '3950 AVBY, Jour 1',
    clone_wars: '22 AVBY, Jour 1',
    imperial: '19 AVBY, Jour 1',
    new_republic: '4 APBY, Jour 1',
    first_order: '34 APBY, Jour 1'
  };

  const FACTION_CREDITS: Record<string, number> = {
    imperial_officer: 3000, bounty_hunter: 1500, hutt_enforcer: 2000,
    smuggler: 800, rebel_pilot: 600, rebel_leader: 900,
    jedi_knight: 500, jedi_master: 800, sith_lord: 2500, sith_apprentice: 1000,
    mandalorian_warrior: 1200, senator: 5000, scavenger: 300, default: 1000
  };

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
        location: 'Inconnu',
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
    player: { hp: 100, credits: 1000, location: 'Inconnu', date: '', injuries: [], inventory: [] },
    npcs: [],
    factions: {},
    chronology: []
  };

  const TRANSITION_CHAPTER_REGEX = /(transition|transit|travel|journey|voyage|trajet|marche|route|en route|approche|attente|interlude|repos|pause|accalmie|campement|surveillance|transfert|navette)/i;
  const DIALOGUE_CHOICE_REGEX = /(parler|discuter|dialogue|dialoguer|interroger|questionner|négocier|convaincre|échanger|demander|écouter|sonder)/i;
  const TIME_PASS_CHOICE_REGEX = /(attendre|patienter|passer le temps|se reposer|méditer|observer|planifier|faire le point|préparer|laisser avancer|laisser filer|récupérer)/i;
  const ACTION_HEAVY_CHOICE_REGEX = /(attaquer|assaut|fusillade|duel|foncer|abattre|détruire|exploser|charge|combat|sabre|blaster|éliminer)/i;
  const TOOL_CALL_LEAK_TEXT_REGEX = /<\|?tool_call\|?>|tool_call|(?:^|\s)call:[a-z_]+\s*\{/i;

  function sanitizeNarrativeLeak(text: string): string {
    if (!TOOL_CALL_LEAK_TEXT_REGEX.test(text || '')) return text;
    return `Le système IA a renvoyé une sortie technique non lisible pour ce passage. L'histoire continue normalement via les choix ci-dessous.`;
  }

  function sanitizeChapterForDisplay(chapter: StoryChapter | null): StoryChapter | null {
    if (!chapter) return null;

    return {
      ...chapter,
      narrative: {
        ...chapter.narrative,
        action: sanitizeNarrativeLeak(chapter.narrative.action),
        context: sanitizeNarrativeLeak(chapter.narrative.context),
        dialogue: sanitizeNarrativeLeak(chapter.narrative.dialogue),
        reflection: sanitizeNarrativeLeak(chapter.narrative.reflection)
      }
    };
  }

  function sanitizeChapterList(chapters: StoryChapter[]): StoryChapter[] {
    return chapters.map(chapter => sanitizeChapterForDisplay(chapter) as StoryChapter);
  }

  function normalizeEventText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function eventTokenSet(value: string): Set<string> {
    return new Set(
      normalizeEventText(value)
        .split(' ')
        .map(token => token.trim())
        .filter(token => token.length >= 4)
    );
  }

  function tokenOverlapRatio(left: string, right: string): number {
    const a = eventTokenSet(left);
    const b = eventTokenSet(right);
    if (!a.size || !b.size) return 0;

    let common = 0;
    for (const token of a) {
      if (b.has(token)) common += 1;
    }

    return common / Math.max(a.size, b.size);
  }

  function isNearDuplicateBackgroundEvent(event: BackgroundWorldEvent): boolean {
    const incomingTitle = normalizeEventText(event.title);
    const incomingSummary = normalizeEventText(event.summary_public || event.prompt_hook || '');
    if (!incomingTitle && !incomingSummary) return false;

    return backgroundEvents.slice(0, 6).some(previous => {
      const previousTitle = normalizeEventText(previous.title);
      const previousSummary = normalizeEventText(previous.summary);

      const titleMatch = Boolean(
        incomingTitle &&
        previousTitle &&
        (incomingTitle === previousTitle || incomingTitle.includes(previousTitle) || previousTitle.includes(incomingTitle))
      );

      const summaryMatch = Boolean(
        incomingSummary &&
        previousSummary &&
        (incomingSummary === previousSummary || incomingSummary.includes(previousSummary) || previousSummary.includes(incomingSummary))
      );

      const overlap = tokenOverlapRatio(incomingSummary || incomingTitle, previousSummary || previousTitle);
      return (titleMatch && (summaryMatch || overlap >= 0.72)) || (summaryMatch && overlap >= 0.72) || overlap >= 0.85;
    });
  }

  function normalizeSearchText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function chapterCorpusForNpcDetection(chapter: StoryChapter): string {
    return [
      chapter.chapter_title,
      chapter.narrative.context,
      chapter.narrative.action,
      chapter.narrative.dialogue,
      chapter.narrative.reflection,
      ...chapter.choices.map(choice => choice.text)
    ].join(' ');
  }

  function textMentionsNpc(corpus: string, npcName: string): boolean {
    const haystack = ` ${normalizeSearchText(corpus)} `;
    const normalizedName = normalizeSearchText(npcName).trim();
    if (!normalizedName) return false;

    const fullNamePattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedName)}([^a-z0-9]|$)`);
    if (fullNamePattern.test(haystack)) return true;

    const parts = normalizedName
      .split(/\s+/)
      .map(part => part.trim())
      .filter(part => part.length >= 4);

    return parts.some(part => {
      const partPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(part)}([^a-z0-9]|$)`);
      return partPattern.test(haystack);
    });
  }

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

  function applyStateUpdate(chapter: StoryChapter): void {
    const upd = chapter.state_update;
    if (!upd) return;

    const p = worldState.player;

    const hpDelta = upd.hp !== undefined ? normalizeHpDelta(upd.hp, p.hp) : undefined;
    const creditsDelta = upd.credits !== undefined ? normalizeCreditsDelta(upd.credits, p.credits) : undefined;

    // Player vitals
    const newHp = hpDelta !== undefined ? Math.max(0, Math.min(100, p.hp + hpDelta)) : p.hp;
    const newCredits = creditsDelta !== undefined ? Math.max(0, p.credits + creditsDelta) : p.credits;
    const newLocation = upd.location || p.location;
    const newDate = upd.date_advance ? `${p.date.replace(/ \+.*$/, '')} +${upd.date_advance}` : p.date;

    // Injuries: resolve then add new
    const resolvedKeywords = upd.injuries_resolved ?? [];
    const survivingInjuries = p.injuries.filter(inj =>
      !resolvedKeywords.some(r => inj.description.toLowerCase().includes(r.toLowerCase()))
    );
    const newInjuries = [...survivingInjuries, ...(upd.injuries_new ?? [])];

    // Inventory
    let inventory = [...p.inventory];
    for (const gained of upd.inventory_gained ?? []) {
      const existing = inventory.find(i => i.name.toLowerCase() === gained.name.toLowerCase());
      if (existing) existing.qty += gained.qty;
      else inventory.push({ ...gained });
    }
    for (const lost of upd.inventory_lost ?? []) {
      inventory = inventory
        .map(i => i.name.toLowerCase() === lost.name.toLowerCase() ? { ...i, qty: i.qty - lost.qty } : i)
        .filter(i => i.qty > 0);
    }

    // NPCs: upsert by name
    let npcs = [...worldState.npcs];
    for (const npcUpd of upd.npcs ?? []) {
      const idx = npcs.findIndex(n => n.name.toLowerCase() === npcUpd.name.toLowerCase());
      if (idx >= 0) {
        npcs[idx] = { ...npcs[idx], ...npcUpd } as NpcRelation;
      } else {
        npcs.push({
          name: npcUpd.name,
          affinity: npcUpd.affinity ?? 0,
          status: npcUpd.status ?? 'neutral',
          faction: npcUpd.faction,
          last_seen: npcUpd.last_seen,
          alive: npcUpd.alive !== false,
          note: npcUpd.note
        });
      }
    }

    // Factions: apply deltas, clamp -100..100
    const factions = { ...worldState.factions };
    for (const [id, delta] of Object.entries(upd.factions ?? {})) {
      factions[id] = Math.max(-100, Math.min(100, (factions[id] ?? 0) + delta));
    }

    // Chronology entry
    const chronology = [
      ...worldState.chronology,
      {
        chapter: chapter.chapter_number,
        date: newDate,
        location: newLocation,
        summary: chapter.chapter_title
      }
    ].slice(-40);

    worldState = {
      player: { hp: newHp, credits: newCredits, location: newLocation, date: newDate, injuries: newInjuries, inventory },
      npcs,
      factions,
      chronology
    };
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

  function chapterLooksLikeTransition(chapter: StoryChapter): boolean {
    const sectionType = chapter.section_type || '';
    if (TRANSITION_CHAPTER_REGEX.test(sectionType)) return true;

    const corpus = [
      chapter.chapter_title,
      chapter.narrative.context,
      chapter.narrative.action,
      chapter.narrative.dialogue,
      chapter.narrative.reflection
    ].join(' ');

    return TRANSITION_CHAPTER_REGEX.test(corpus);
  }

  function getNearbyNpcNames(chapter: StoryChapter, max = 2): string[] {
    const location = normalizeSearchText((worldState.player.location || '').trim());
    const aliveNpcs = worldState.npcs.filter(npc => npc.alive !== false && npc.status !== 'dead' && npc.name.trim());
    if (!aliveNpcs.length) return [];

    const chapterCorpus = chapterCorpusForNpcDetection(chapter);

    const mentionedNpcs = aliveNpcs.filter(npc => textMentionsNpc(chapterCorpus, npc.name));

    const localNpcs = aliveNpcs.filter(npc => {
      const lastSeen = normalizeSearchText((npc.last_seen || '').trim());
      if (!lastSeen || !location || location === 'inconnu') return false;
      return lastSeen.includes(location) || location.includes(lastSeen);
    });

    const sociallyRelevantNpcs = aliveNpcs
      .filter(npc => npc.status === 'ally' || npc.status === 'neutral')
      .sort((left, right) => (right.affinity ?? 0) - (left.affinity ?? 0));

    const rankedNpcs = [
      ...localNpcs,
      ...mentionedNpcs,
      ...((!location || location === 'inconnu') ? sociallyRelevantNpcs : [])
    ];

    const unique = Array.from(new Map(
      rankedNpcs.map(npc => [normalizeSearchText(npc.name), npc])
    ).values());

    return unique
      .map(npc => npc.name.trim())
      .filter(Boolean)
      .slice(0, max);
  }

  function enforceTransitionChoiceQuality(chapter: StoryChapter): StoryChapter {
    if (!chapterLooksLikeTransition(chapter)) return chapter;

    const choices = [...chapter.choices];
    if (!choices.length) return chapter;

    const hasDialogueChoice = choices.some(choice => DIALOGUE_CHOICE_REGEX.test(choice.text));
    const hasTimePassChoice = choices.some(choice => TIME_PASS_CHOICE_REGEX.test(choice.text));

    const nearbyNpcs = getNearbyNpcNames(chapter);
    let injectedChoice: StoryChoice | null = null;

    if (nearbyNpcs.length > 0 && !hasDialogueChoice) {
      const npcLabel = nearbyNpcs.length > 1
        ? `${nearbyNpcs[0]} et ${nearbyNpcs[1]}`
        : nearbyNpcs[0];

      injectedChoice = {
        text: `Engager la conversation avec ${npcLabel} pour clarifier la situation avant d'agir.`,
        attribute: 'diplomacy',
        difficulty: 2,
        faction_impact: {}
      };
    } else if (!hasTimePassChoice) {
      injectedChoice = {
        text: 'Profiter du trajet pour observer, planifier la suite et laisser le temps avancer.',
        attribute: 'survival',
        difficulty: 1,
        faction_impact: {}
      };
    }

    if (!injectedChoice) return chapter;

    const dedup = new Set(choices.map(choice => choice.text.trim().toLowerCase()));
    if (dedup.has(injectedChoice.text.trim().toLowerCase())) return chapter;

    if (choices.length >= 4) {
      const replaceIndex = choices.findIndex(choice =>
        choice.attribute === 'combat' ||
        choice.attribute === 'force' ||
        ACTION_HEAVY_CHOICE_REGEX.test(choice.text)
      );
      const targetIndex = replaceIndex >= 0 ? replaceIndex : choices.length - 1;
      choices[targetIndex] = injectedChoice;
    } else {
      choices.push(injectedChoice);
    }

    return {
      ...chapter,
      choices
    };
  }

  let providerConfig: StoryProviderConfig | null = null;
  let providerStatus = 'Aucun provider texte configuré.';

  const ERAS = [
    { id: 'old_republic', name: 'Ancienne République', years: '25 000 - 1000 AVBY', icon: 'AncientRepublic.svg' },
    { id: 'clone_wars', name: 'Guerres des Clones', years: '22 - 19 AVBY', icon: 'jedi-order-svgrepo-com.svg' },
    { id: 'imperial', name: 'Ère Impériale', years: '19 - 4 AVBY', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
    { id: 'new_republic', name: 'Nouvelle République', years: '4 - 28 APBY', icon: 'NR_Seal.svg' },
    { id: 'first_order', name: 'Premier Ordre', years: '28 - 35 APBY', icon: 'Emblem_of_the_First_Order.svg' }
  ];

  const FACTIONS = [
    { id: 'jedi', name: 'Ordre Jedi', color: '#4ec9b0', icon: 'jedi-order-svgrepo-com.svg' },
    { id: 'sith', name: 'Ordre Sith', color: '#e51414', icon: 'starwars-sith-svgrepo-com.svg' },
    { id: 'empire', name: 'Empire Galactique', color: '#c41e3a', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
    { id: 'rebels', name: 'Alliance Rebelle', color: '#f39c12', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'republic', name: 'République Galactique', color: '#3498db', icon: 'brand-galactic-republic-svgrepo-com.svg' },
    { id: 'mandalore', name: 'Mandaloriens', color: '#9b59b6', icon: 'mandalorian-svgrepo-com.svg' },
    { id: 'first_order', name: 'Premier Ordre', color: '#1a1a2e', icon: 'Emblem_of_the_First_Order.svg' },
    { id: 'hutt', name: 'Cartel Hutt', color: '#27ae60', icon: 'Desilijic_clan_vector.svg' },
    { id: 'neutral', name: 'Indépendant', color: '#95a5a6', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
  ];

  const ROLES = [
    { id: 'jedi_knight', name: 'Chevalier Jedi', faction: 'jedi', icon: 'luke-skywalker-lightsaber-svgrepo-com.svg' },
    { id: 'jedi_master', name: 'Maître Jedi', faction: 'jedi', icon: 'jedi-order-svgrepo-com.svg' },
    { id: 'padawan', name: 'Padawan', faction: 'jedi', icon: 'lightsaber-svgrepo-com.svg' },
    { id: 'sith_lord', name: 'Seigneur Sith', faction: 'sith', icon: 'SithEmblem-Traced-TORkit.svg' },
    { id: 'sith_apprentice', name: 'Apprenti Sith', faction: 'sith', icon: 'starwars-sith-svgrepo-com.svg' },
    { id: 'imperial_officer', name: 'Officier Impérial', faction: 'empire', icon: 'Emblem_of_the_First_Galactic_Empire.svg' },
    { id: 'stormtrooper', name: 'Stormtrooper', faction: 'empire', icon: 'noun-storm-trooper-49992.svg' },
    { id: 'rebel_pilot', name: 'Pilote Rebelle', faction: 'rebels', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'rebel_leader', name: 'Leader Rebelle', faction: 'rebels', icon: 'brand-galactic-republic-svgrepo-com.svg' },
    { id: 'senator', name: 'Sénateur', faction: 'republic', icon: 'brand-galactic-republic-svgrepo-com.svg' },
    { id: 'clone_trooper', name: 'Clone Trooper', faction: 'republic', icon: 'noun-storm-trooper-49992.svg' },
    { id: 'mandalorian_warrior', name: 'Guerrier Mandalorien', faction: 'mandalore', icon: 'mandalorian-svgrepo-com.svg' },
    { id: 'first_order_trooper', name: 'Soldat du Premier Ordre', faction: 'first_order', icon: 'Emblem_of_the_First_Order.svg' },
    { id: 'resistance_member', name: 'Membre de la Résistance', faction: 'rebels', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'hutt_enforcer', name: 'Main du Hutt', faction: 'hutt', icon: 'Desilijic_clan_vector.svg' },
    { id: 'bounty_hunter', name: 'Chasseur de Primes', faction: 'neutral', icon: 'scifi-starwars-boba-fett-svgrepo-com.svg' },
    { id: 'smuggler', name: 'Contrebandier', faction: 'neutral', icon: 'millennium-falcon-svgrepo-com.svg' },
    { id: 'scavenger', name: 'Éclaireur', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' },
    { id: 'force_sensitive', name: 'Sensible à la Force', faction: 'neutral', icon: 'lightsaber-svgrepo-com.svg' },
    { id: 'jedi_exile', name: 'Jedi Banni', faction: 'neutral', icon: 'alone-characterized-embodied-svgrepo-com.svg' }
  ];

  const TRAMES = [
    { id: 'solo',     name: 'Le Solitaire',   icon: '🚀', premise: `Vous acceptez un contrat en apparence simple, mais il vous entraîne dans un conflit galactique majeur.` },
    { id: 'chosen',   name: "L'Élu",          icon: '✨', premise: `Une intuition de la Force vous pousse sur une piste que personne ne comprend encore.` },
    { id: 'exile',    name: 'Le Banni',        icon: '🌑', premise: `Exilé après un incident obscur, vous survivez dans l'ombre jusqu'au jour où tout bascule.` },
    { id: 'rebel',    name: 'Le Résistant',    icon: '⚡', premise: `Vous combattez l'oppresseur et découvrez un enjeu plus grand que votre vengeance.` },
    { id: 'redeemed', name: 'La Rédemption',   icon: '🔥', premise: `Ancien serviteur de l'Obscur, vous tentez de réparer ce qui peut encore l'être.` },
    { id: 'spy',      name: "L'Infiltrateur",  icon: '🕵️', premise: `Votre mission d'infiltration brouille progressivement la frontière entre vos deux identités.` },
    { id: 'custom',   name: 'Libre',           icon: '✏️', premise: '' }
  ];

  const AVATARS = ['🧑‍🚀', '👩‍🚀', '🧙', '🧙‍♀️', '⚔️', '🤖', '👾', '🦾', '🌌', '💫', '🔵', '🔴'];

  const WRITING_STYLES = [
    { id: 'cinematique', name: 'Cinématique', desc: 'Scènes courtes, rythme intense' },
    { id: 'litteraire', name: 'Littéraire', desc: 'Descriptions riches et profondes' },
    { id: 'epique', name: 'Épique', desc: 'Grandeur et destin héroïque' },
    { id: 'immersif', name: 'Immersif', desc: 'Mode jeu de rôle très direct' }
  ];

  const WRITING_TONES = [
    { id: 'heroique', name: 'Héroïque' },
    { id: 'sombre', name: 'Sombre' },
    { id: 'aventure', name: 'Aventure' },
    { id: 'drame', name: 'Dramatique' }
  ];

  const WRITING_POVS = [
    { id: 'premiere', name: '1ère personne — Je' },
    { id: 'troisieme', name: '3ème personne — Il/Elle' }
  ];

  const WRITING_LENGTHS = [
    { id: 'court', name: 'Court' },
    { id: 'moyen', name: 'Moyen' },
    { id: 'long', name: 'Long' }
  ];

  const CONTENT_MODES = [
    { id: 'cinematic', icon: '🎬', name: 'Cinéma', desc: 'Intense mais équilibré' },
    { id: 'dark', icon: '🌒', name: 'Sombre', desc: 'Ambiance dure et tendue' },
    { id: 'adult', icon: '🔞', name: 'Adulte', desc: 'Mature et frontal' },
    { id: 'raw', icon: '⚠️', name: 'Brut', desc: 'Très frontal quand le modèle le permet' }
  ];

  $: activeSetupStep = SETUP_SCREENS[setupScreenIndex];
  $: isLastSetupStep = setupScreenIndex === SETUP_SCREENS.length - 1;
  $: providerMissing = !providerConfig;

  function textToParagraphs(text: string): string[] {
    return String(text || '')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  function storySessionKey(id: string): string {
    return `${INTERACTIVE_SESSION_PREFIX}${id}`;
  }

  function saveInteractiveSession(): void {
    if (!storyId || typeof localStorage === 'undefined') return;

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
      worldState
    };

    localStorage.setItem(storySessionKey(storyId), JSON.stringify(payload));
  }

  function loadInteractiveSession(id: string): InteractiveSessionPayload | null {
    if (typeof localStorage === 'undefined') return null;

    const raw = localStorage.getItem(storySessionKey(id));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<InteractiveSessionPayload>;
      if (!Array.isArray(parsed.chapterHistory) || !parsed.chapterHistory.length) return null;

      return {
        version: 1,
        turnNumber: Number(parsed.turnNumber || parsed.chapterHistory.length || 0),
        selectedTrame: typeof parsed.selectedTrame === 'string' ? parsed.selectedTrame : null,
        currentChapter: parsed.currentChapter ?? parsed.chapterHistory[parsed.chapterHistory.length - 1] ?? null,
        chapterHistory: parsed.chapterHistory,
        actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory : [],
        aiMessages: Array.isArray(parsed.aiMessages) ? parsed.aiMessages : [],
        memoryLog: Array.isArray(parsed.memoryLog) ? parsed.memoryLog : [],
        backgroundEvents: Array.isArray(parsed.backgroundEvents) ? parsed.backgroundEvents : [],
        setupSnapshot: (parsed.setupSnapshot as StorySetup) || get(currentSetup),
        worldState: parsed.worldState as WorldState | undefined
      };
    } catch {
      return null;
    }
  }

  function clearInteractiveSession(id: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(storySessionKey(id));
  }

  function setSetupField<K extends keyof StorySetup>(field: K, value: StorySetup[K]): void {
    const current = get(currentSetup)[field];
    if (current !== value) {
      updateSetupField(field, value);
    }
  }

  function defaultRoleForFaction(factionId: string): string {
    return ROLES.find(role => role.faction === factionId)?.id || ROLES[0].id;
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

  function providerSummary(config: StoryProviderConfig | null): string {
    if (!config) return 'Aucun provider texte configuré.';
    const modelLabel = config.model || 'modèle auto';
    const modeLabel = supportsAgenticToolCalling(config.providerId) ? ' · agentique' : '';
    return `${config.providerId} · ${modelLabel}${modeLabel}`;
  }

  function resolvePromptMode(): 'json' | 'tool-calls' {
    return providerConfig && supportsAgenticToolCalling(providerConfig.providerId)
      ? 'tool-calls'
      : 'json';
  }

  function trimMessages(messages: ChatMessage[], maxWithoutSystem = 18): ChatMessage[] {
    const systemMessage = messages.find(message => message.role === 'system');
    const others = messages.filter(message => message.role !== 'system').slice(-maxWithoutSystem);
    return systemMessage ? [systemMessage, ...others] : others;
  }

  function mergeMemoryFacts(nextFacts: string[]): void {
    const merged = Array.from(new Set([...memoryLog, ...nextFacts].filter(Boolean)));
    memoryLog = merged.slice(-120);
  }

  function appendMemoryFromChapter(chapter: StoryChapter): void {
    const explicitFacts = [
      ...chapter.memory_updates.relations.map(item => `Relation: ${item}`),
      ...chapter.memory_updates.places.map(item => `Lieu: ${item}`),
      ...chapter.memory_updates.injuries.map(item => `Blessure: ${item}`),
      ...chapter.memory_updates.resources.map(item => `Ressource: ${item}`),
      ...chapter.memory_updates.notes.map(item => `Note: ${item}`)
    ];

    const corpus = [
      chapter.narrative.context,
      chapter.narrative.action,
      chapter.narrative.dialogue,
      chapter.narrative.reflection
    ].join(' ');

    const implicitFacts: string[] = [];
    if (/(bless|hémorrag|fracture|wound|injur|brûlure)/i.test(corpus)) {
      implicitFacts.push(`Tour ${chapter.chapter_number}: état physique du protagoniste potentiellement dégradé.`);
    }
    if (/(crédit|credits|prime|dette|ressource|équipement|blaster|sabrelaser|vaisseau)/i.test(corpus)) {
      implicitFacts.push(`Tour ${chapter.chapter_number}: ressources matérielles ou financières modifiées.`);
    }
    if (/(coruscant|tatouine|mustafar|hoth|dagobah|temple|cantina|station|base|croiseur)/i.test(corpus)) {
      implicitFacts.push(`Tour ${chapter.chapter_number}: nouveaux lieux importants visités.`);
    }

    mergeMemoryFacts([...explicitFacts, ...implicitFacts]);
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

  async function runBackgroundWorldTick(setup: StorySetup, turn: number): Promise<void> {
    if (!providerConfig) return;
    if (!supportsAgenticToolCalling(providerConfig.providerId)) return;

    const recentSummary = chapterHistory.slice(-4).map(chapter => summarizeChapterForPrompt(chapter));
    const recentBackgroundEvents = backgroundEvents
      .slice(0, 6)
      .map(event => ({ title: event.title, summary: event.summary }));

    try {
      const generation = await generateBackgroundWorldEvent(
        {
          setup,
          worldState,
          memoryFacts: memoryLog.slice(-25),
          recentSummary,
          recentBackgroundEvents,
          turnNumber: turn
        },
        providerConfig
      );

      const event = generation.event;
      if (!event || !event.inject_now) return;
      if (isNearDuplicateBackgroundEvent(event)) return;

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
      console.warn('[editor] Tick hors-écran ignoré:', error);
    }
  }

  function chapterToJournalMarkdown(chapter: StoryChapter, index: number): string {
    const lines: string[] = [];
    lines.push(`## Chapitre ${chapter.chapter_number || index + 1} — ${chapter.chapter_title}`);

    if (chapter.narrative.context) lines.push(`**Contexte**\n${chapter.narrative.context}`);
    if (chapter.narrative.action) lines.push(`**Action**\n${chapter.narrative.action}`);
    if (chapter.narrative.dialogue) lines.push(`**Dialogue**\n${chapter.narrative.dialogue}`);
    if (chapter.narrative.reflection) lines.push(`**Réflexion**\n${chapter.narrative.reflection}`);

    if (chapter.choices.length) {
      lines.push('**Choix proposés**');
      chapter.choices.forEach((choice, choiceIndex) => {
        lines.push(`${choiceIndex + 1}. ${choice.text} [${choice.attribute} · diff ${choice.difficulty}]`);
      });
    }

    if (chapter.memory_updates.notes.length) {
      lines.push(`**Mémoire (notes)**\n- ${chapter.memory_updates.notes.join('\n- ')}`);
    }

    return lines.join('\n\n');
  }

  function buildJournalContent(): string {
    if (!chapterHistory.length) return '';
    return chapterHistory.map((chapter, index) => chapterToJournalMarkdown(chapter, index)).join('\n\n---\n\n');
  }

  function buildStoryTitle(setup: StorySetup): string {
    const eraLabel = ERAS.find(era => era.id === setup.era)?.name || 'Star Wars';
    const firstName = (setup.protagonistFirstName || '').trim();
    const lastName = (setup.protagonistLastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName ? `${fullName} — ${eraLabel}` : `Chroniques ${eraLabel}`;
  }

  async function persistInteractiveState(setup: StorySetup): Promise<void> {
    updateTitle(buildStoryTitle(setup));
    updateContent(buildJournalContent());

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
    if (!providerConfig) {
      throw new Error('Aucun provider IA configuré. Ouvre les paramètres IA texte.');
    }

    const promptMode = resolvePromptMode();
    const systemPrompt = buildSystemPrompt(setup, memoryLog.slice(-20), worldState, promptMode, turn);
    aiMessages = [{ role: 'system', content: systemPrompt }, ...aiMessages.filter(message => message.role !== 'system')];

    const requestMessages = trimMessages([
      ...aiMessages,
      { role: 'user', content: prompt }
    ]);

    const generation = await generateStoryTurn(requestMessages, providerConfig, turn);
    const chapter = sanitizeChapterForDisplay(enforceTransitionChoiceQuality(generation.chapter)) as StoryChapter;
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
      customAction = '';
      worldState = initWorldState(setup);

      const trameLabel = TRAMES.find(item => item.id === selectedTrame)?.name || null;
      const prompt = buildStartPrompt(setup, trameLabel, resolvePromptMode());
      const chapter = await requestStoryChapter(prompt, setup, 1);

      currentChapter = chapter;
      chapterHistory = [chapter];
      actionHistory = ['Prologue IA'];

      applyStateUpdate(chapter);
      appendMemoryFromChapter(chapter);
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
      const recentSummary = chapterHistory.slice(-3).map(chapter => summarizeChapterForPrompt(chapter));
      const recentSectionTypes = chapterHistory.slice(-5).map(c => c.section_type).filter(Boolean);
      const recentChoiceTexts = chapterHistory
        .slice(-5)
        .flatMap(chapter => chapter.choices.map(choice => choice.text));

      const prompt = buildContinuePrompt(
        action,
        nextTurn,
        recentSummary,
        resolvePromptMode(),
        recentSectionTypes,
        recentChoiceTexts
      );

      const chapter = await requestStoryChapter(prompt, setup, nextTurn);

      turnNumber = nextTurn;
      currentChapter = chapter;
      chapterHistory = [...chapterHistory, chapter].slice(-60);
      actionHistory = [...actionHistory, action].slice(-60);

      applyStateUpdate(chapter);
      appendMemoryFromChapter(chapter);

      await runBackgroundWorldTick(setup, nextTurn);
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
      console.error(error);
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
    customAction = '';

    void goto('/editor/new');
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

    const preferences = await getPreferences();
    applySetupDefaultsFromPreferences(preferences);

    providerConfig = buildProviderConfigFromPreferences(preferences);
    providerStatus = providerSummary(providerConfig);

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

        const snapshot = session.setupSnapshot;
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

        if (session.worldState) worldState = session.worldState;
        mode = session.currentChapter ? 'play' : 'setup';
      }
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
    >
      <div class="header-actions">
        <button class="btn btn-ghost" on:click={startNewStory} disabled={generating || saving}>
          Nouvelle
        </button>
        <button class="btn btn-secondary" on:click={handleSave} disabled={saving || generating}>
          {#if saving}
            <span class="spinner"></span>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17,21 17,13 7,13 7,21"/>
              <polyline points="7,3 7,8 15,8"/>
            </svg>
          {/if}
          Sauvegarder
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
                {#if supportsAgenticToolCalling(providerConfig.providerId)}
                  <span class="model-chip-dot agentic"></span>
                {:else}
                  <span class="model-chip-dot"></span>
                {/if}
                <span class="model-chip-name">
                  {(providerConfig.model || 'auto').split('/').pop()?.split(':')[0] ?? 'auto'}
                </span>
                {#if supportsAgenticToolCalling(providerConfig.providerId)}
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

          {#if generationError}
            <div class="error-banner">{generationError}</div>
          {/if}

          {#if backgroundEvents.length > 0}
            <section class="world-events-panel" aria-label="Événements galactiques hors écran">
              <header class="world-events-header">
                <h3>Mouvements de la galaxie</h3>
                <span>{backgroundEvents.length}</span>
              </header>
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
            </section>
          {/if}

          <!-- ── Living World HUD ───────────────────────── -->
          <GameHUD {worldState} bind:collapsed={hudCollapsed} {turnNumber} />

          <!-- ── Loading overlay ─────────────────────────── -->
          {#if generating}
            <div class="play-generating" in:fly={{ y: 6, duration: 180 }}>
              <div class="gen-dot-row">
                <span></span><span></span><span></span>
              </div>
              <p>L'IA compose la suite…</p>
            </div>
          {/if}

          {#if currentChapter}
            <!-- ── Chapter card ──────────────────────────── -->
            {#key currentChapter.chapter_number}
              <article class="chapter-card" in:fly={{ y: 20, duration: 280, opacity: 0 }}>

                <!-- Eyebrow + title -->
                <header class="chapter-header">
                  <div class="chapter-eyebrow">
                    <span class="chapter-num">Chapitre {currentChapter.chapter_number || turnNumber}</span>
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
                      {#each textToParagraphs(currentChapter.narrative.context) as para}
                        <p>{para}</p>
                      {/each}
                    </div>
                  {/if}

                  {#if currentChapter.narrative.action}
                    <div class="n-block n-action">
                      <span class="n-tag n-tag--action">Action</span>
                      {#each textToParagraphs(currentChapter.narrative.action) as para}
                        <p>{para}</p>
                      {/each}
                    </div>
                  {/if}

                  {#if currentChapter.narrative.dialogue}
                    <div class="n-block n-dialogue">
                      <span class="n-tag n-tag--dialogue">Dialogue</span>
                      {#each textToParagraphs(currentChapter.narrative.dialogue) as para}
                        <p>{para}</p>
                      {/each}
                    </div>
                  {/if}

                  {#if currentChapter.narrative.reflection}
                    <div class="n-block n-reflection">
                      <span class="n-tag n-tag--reflection">Réflexion</span>
                      {#each textToParagraphs(currentChapter.narrative.reflection) as para}
                        <p>{para}</p>
                      {/each}
                    </div>
                  {/if}

                </div>
              </article>
            {/key}

            <!-- ── Choices ────────────────────────────────── -->
            {#if currentChapter.choices.length > 0}
              <section class="choices-section">
                <h3 class="choices-heading">Que faites-vous ?</h3>
                <div class="choice-list">
                  {#each currentChapter.choices as choice, i}
                    {@const cons = choiceConsequences(choice)}
                    <button
                      class="choice-btn"
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

            <!-- ── Custom action ──────────────────────────── -->
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

            <!-- ── Memory panel ───────────────────────────── -->
            <details class="memory-panel">
              <summary>
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
                Mémoire IA <span class="mem-count">({memoryLog.length})</span>
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
  .play-loading,
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
  .custom-action-input,
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
  .custom-action-input:focus,
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

  .world-events-panel {
    border: 1px solid color-mix(in srgb, var(--color-gold) 25%, var(--color-border));
    background: color-mix(in srgb, var(--color-gold) 4%, var(--color-bg-secondary));
    border-radius: var(--radius-lg);
    padding: var(--space-sm) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .world-events-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .world-events-header h3 {
    margin: 0;
    font-size: 0.82rem;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .world-events-header span {
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
    gap: 10px;
    padding: var(--space-lg);
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .gen-dot-row {
    display: flex;
    gap: 5px;
  }

  .gen-dot-row span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-gold);
    animation: gen-bounce 1.3s ease-in-out infinite;
  }

  .gen-dot-row span:nth-child(2) { animation-delay: 0.18s; }
  .gen-dot-row span:nth-child(3) { animation-delay: 0.36s; }

  @keyframes gen-bounce {
    0%, 80%, 100% { transform: translateY(0)    scale(0.6); opacity: 0.35; }
    40%           { transform: translateY(-5px) scale(1);   opacity: 1; }
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
    max-width: 74ch;
    margin: 0 auto;
  }

  .n-block {
    padding: calc(var(--space-md) + 2px) 0;
    position: relative;
  }

  .n-block + .n-block {
    border-top: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
  }

  .n-tag {
    display: block;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.65px;
    color: var(--color-gold);
    margin-bottom: 8px;
    opacity: 0.85;
  }

  .n-tag--action     { color: #c8960f; }
  .n-tag--dialogue   { color: #5aaed4; }
  .n-tag--reflection { color: #8e7ab8; }

  /* Prose shared */
  .n-block p {
    margin: 0;
    line-height: 1.84;
    font-size: clamp(1rem, 0.97rem + 0.2vw, 1.07rem);
    text-wrap: pretty;
  }

  .n-block p + p { margin-top: 0.75em; }

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
    color: color-mix(in srgb, var(--color-text-primary) 95%, white 5%);
    font-style: normal;
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
  }

  .choices-heading {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
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
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    padding: 1px 5px;
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
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-radius: var(--radius-lg);
    padding: 10px var(--space-md);
    resize: none;
    font: inherit;
    font-size: 0.93rem;
    line-height: 1.55;
    transition: border-color var(--transition-fast);
  }

  .custom-input:focus {
    outline: none;
    border-color: var(--color-gold);
  }

  .custom-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.55;
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
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    overflow: hidden;
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
</style>
