import type { WorldState, StoryChapter, NpcRelation } from '$lib/ai/storyEngine';
import type { StorySetup } from '$lib/stores/editor';
import { FACTION_CREDITS, ERA_START_DATES } from '$lib/editor/setupCatalog';

  export const UNKNOWN_LOCATION_RE = /\b(?:inconnu(?:e)?|unknown|indetermine|ind[ée]termin[ée]|non\s+renseign[ée]|n\/?a|aucun\s+lieu)\b/i;
  export const FACTION_LOCATION_LEAK_EXACT = new Set([
    'jedi',
    'ordre jedi',
    'jedi order',
    'sith',
    'empire',
    'alliance rebelle',
    'rebelles',
    'rebels',
    'republique',
    'république',
    'republic',
    'premier ordre',
    'first order',
    'hutt',
    'cartel hutt',
    'mandalore',
    'mandaloriens',
    'mandalorians'
  ]);
  export const LOCATION_HINTS: Array<{ pattern: RegExp; label: string }> = [
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
  export const DIALOGUE_SPEAKER_RE = /^(?:[—–\-]\s*)?([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,48})\s*:/gum;
  export const DIALOGUE_SPEAKER_STOPWORDS = new Set([
    'je', 'tu', 'vous', 'il', 'elle', 'on', 'nous', 'ils', 'elles',
    'fai', 'fil', 'fait', 'faite', 'faites', 'alors', 'ensuite', 'puis', 'tour'
  ]);
  export const NON_NPC_EXACT = new Set([
    'les', 'le', 'la', 'un', 'une', 'des', 'du', 'de',
    'fai', 'fil', 'fait', 'faite', 'faites',
    'jundland', 'kashyyyk', 'coruscant', 'tatooine', 'naboo', 'bespin',
    'hangar', 'spatioport', 'cantina', 'canyon', 'secteur',
    'hutt', 'hutts', 'rodien', 'rodiens',
    'yt-1300', 'yv-666', 'scyk'
  ]);
  export const NON_NPC_ENTITY_RE = /\b(?:jundland|kashyyyk|coruscant|tatooine|naboo|bespin|mustafar|kamino|hoth|endor|dagobah|nar\s*shaddaa|hangar|spatioport|cantina|canyon|secteur|transport|vaisseau|cargo|navette|yt-1300|yv-666|scyk|x-wing|tie|hutts?|rodiens?)\b/i;
  export const ALLOWED_DROID_NAME_RE = /^(?:r2|c-?3|bb|ig|hk|k2|bd|chopper|ch0pper)/i;
  export const HOSTILE_RELATION_RE = /\b(?:attaque|menace|hostile|ennemi|trahit|abandonne|frappe|tue|deteste|déteste|insulte|pi[eè]ge|embuscade)\b/i;
  export const ALLY_RELATION_RE = /\b(?:aide|sauve|protege|prot[eè]ge|couvre|soutient|soutien|allie|alli[eé]|confiance|merci|secourt)\b/i;
  export const MEMORY_LOW_SIGNAL_RELATION_RE = /^rencontre\s+avec\s+/i;

  export function normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  export function isLikelyNpcName(value: unknown): boolean {
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

    if (normalized.length < 3 && !ALLOWED_DROID_NAME_RE.test(normalized)) return false;

    return normalized.length >= 2;
  }

  export function clampAffinity(value: number): number {
    return Math.max(-100, Math.min(100, Math.round(value)));
  }

  export function deriveStatusFromAffinity(affinity: number, currentStatus?: NpcRelation['status']): NpcRelation['status'] {
    if (currentStatus === 'dead') return 'dead';
    if (affinity >= 25) return 'ally';
    if (affinity <= -25) return 'hostile';
    return 'neutral';
  }

  export function inferNpcAffinityDelta(chapter: StoryChapter, npcName: string): number {
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

  export function isMeaningfulNpcMemoryEntry(npc: Partial<NpcRelation> & { name: string }): boolean {
    if (!isLikelyNpcName(npc.name)) return false;
    const affinity = typeof npc.affinity === 'number' ? npc.affinity : 0;
    const status = normalizeNpcStatus(npc.status as NpcRelation['status'] | undefined);
    const note = String(npc.note || '').trim();
    return Boolean(note || npc.faction || Math.abs(affinity) >= 15 || status === 'ally' || status === 'hostile' || status === 'dead');
  }

  export function isUnknownLocationValue(value: unknown): boolean {
    const text = String(value || '').trim();
    if (!text) return true;
    return UNKNOWN_LOCATION_RE.test(normalizeSearchText(text));
  }

  export function looksLikeFactionLabel(value: unknown): boolean {
    const text = String(value || '').trim();
    if (!text) return false;

    const normalized = normalizeSearchText(text).replace(/\s+/g, ' ');
    if (FACTION_LOCATION_LEAK_EXACT.has(normalized)) return true;

    return /^(?:jedi|ordre jedi|jedi order|sith|empire|alliance rebelle|rebelles?|republic|republique|premier ordre|first order|hutt|cartel hutt|mandalore|mandaloriens|mandalorians)$/.test(normalized);
  }

  export function normalizeNarrativeDate(baseDate: string, dateAdvance?: string): string {
    const base = String(baseDate || '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const advance = String(dateAdvance || '')
      .replace(/^\+\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!advance) return base;

    const baseDayMatch = base.match(/\bjour\s*(\d+)\b/i);
    const absoluteDayMatch = advance.match(/^jour\s*(\d+)$/i);

    if (baseDayMatch && absoluteDayMatch) {
      const baseDay = Number(baseDayMatch[1]);
      const nextDay = Number(absoluteDayMatch[1]);

      if (Number.isFinite(baseDay) && Number.isFinite(nextDay)) {
        if (nextDay === baseDay) return base;
        return base.replace(/\bjour\s*\d+\b/i, `Jour ${Math.max(1, nextDay)}`);
      }
    }

    const relativeDayMatch = advance.match(/^([+-]?\d+)\s*jour(?:s)?$/i);
    if (baseDayMatch && relativeDayMatch) {
      const baseDay = Number(baseDayMatch[1]);
      const deltaDays = Number(relativeDayMatch[1]);

      if (Number.isFinite(baseDay) && Number.isFinite(deltaDays)) {
        const mergedDay = Math.max(1, baseDay + deltaDays);
        return base.replace(/\bjour\s*\d+\b/i, `Jour ${mergedDay}`);
      }
    }

    if (base) {
      const normalizedBase = normalizeSearchText(base);
      const normalizedAdvance = normalizeSearchText(advance);
      if (normalizedAdvance && normalizedBase.includes(normalizedAdvance)) return base;
      return `${base} +${advance}`;
    }

    return advance;
  }

  export function inferLocationFromText(...parts: Array<string | undefined>): string | undefined {
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

  export function inferLocationFromChapter(chapter: StoryChapter): string | undefined {
    return inferLocationFromText(
      chapter.narrative.context,
      chapter.narrative.action,
      chapter.narrative.dialogue,
      chapter.narrative.reflection
    );
  }

  export function extractNpcSeedsFromDialogue(dialogue: string): string[] {
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

  export function normalizeNpcStatus(status: NpcRelation['status'] | undefined): NpcRelation['status'] {
    if (!status || status === 'unknown') return 'neutral';
    return status;
  }

  export function synchronizeNpcLifeState(
    status: NpcRelation['status'] | undefined,
    alive: boolean | undefined
  ): Pick<NpcRelation, 'status' | 'alive'> {
    if (status === 'dead' || alive === false) {
      return { status: 'dead', alive: false };
    }

    return {
      status: normalizeNpcStatus(status),
      alive: alive !== undefined ? alive : true
    };
  }

  export function deriveInitialLocation(setup: StorySetup): string {
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

  export function cloneWorldState(source: WorldState): WorldState {
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
      chronology: source.chronology.map(entry => ({ ...entry })),
      clocks: source.clocks ? JSON.parse(JSON.stringify(source.clocks)) : undefined,
      sector_influence: source.sector_influence ? { ...source.sector_influence } : undefined,
      rumors: source.rumors ? [...source.rumors] : undefined,
      environment_status: source.environment_status,
      director_instruction: source.director_instruction
    };
  }

  export function initWorldState(setup: StorySetup): WorldState {
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
      chronology: [],
      clocks: {},
      sector_influence: {},
      rumors: []
    };
  }
  export function normalizeHpDelta(rawHp: number): number {
    return Math.max(-100, Math.min(100, Math.round(rawHp)));
  }

  export function normalizeCreditsDelta(rawCredits: number): number {
    return Number.isFinite(rawCredits) ? Math.round(rawCredits) : 0;
  }

  export function applyStateUpdateToWorldState(sourceState: WorldState, chapter: StoryChapter): WorldState {
    const upd = chapter.state_update;
    const p = sourceState.player;

    const hpDelta = typeof upd?.hp === 'number' ? normalizeHpDelta(upd.hp) : undefined;
    const creditsDelta = typeof upd?.credits === 'number' ? normalizeCreditsDelta(upd.credits) : undefined;

    const inferredLocation = inferLocationFromChapter(chapter);
    const requestedLocationRaw = String(upd?.location || '').trim();
    const requestedLocation = looksLikeFactionLabel(requestedLocationRaw) ? '' : requestedLocationRaw;
    const fallbackLocation = isUnknownLocationValue(p.location) ? inferredLocation : undefined;
    let newLocation = requestedLocation || fallbackLocation || p.location;

    if ((isUnknownLocationValue(newLocation) || looksLikeFactionLabel(newLocation)) && inferredLocation) {
      newLocation = inferredLocation;
    }

    if (looksLikeFactionLabel(newLocation)) {
      const previousValidLocation = !isUnknownLocationValue(p.location) && !looksLikeFactionLabel(p.location)
        ? p.location
        : '';
      newLocation = previousValidLocation || newLocation;
    }

    // Player vitals
    const newHp = hpDelta !== undefined ? Math.max(0, Math.min(100, p.hp + hpDelta)) : p.hp;
    const newCredits = creditsDelta !== undefined ? Math.max(0, p.credits + creditsDelta) : p.credits;
    const newDate = normalizeNarrativeDate(p.date, upd?.date_advance);

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
        const lifeState = synchronizeNpcLifeState(
          (npcUpd.status as NpcRelation['status'] | undefined) ?? npcs[idx].status,
          npcUpd.alive ?? npcs[idx].alive
        );
        // Normal update
        npcs[idx] = {
          ...npcs[idx],
          ...npcUpd,
          status: lifeState.status,
          alive: lifeState.alive
        } as NpcRelation;
      } else {
        // Check if this is a "name reveal" of an existing generic/anonymous NPC
        const newAff = npcUpd.affinity ?? 0;
        const genericIdx = npcs.findIndex(n =>
          GENERIC_NPC_RE.test(n.name) &&
          Math.abs((n.affinity ?? 0) - newAff) <= 30
        );
        if (genericIdx >= 0) {
          const lifeState = synchronizeNpcLifeState(
            (npcUpd.status as NpcRelation['status'] | undefined) ?? npcs[genericIdx].status,
            npcUpd.alive ?? npcs[genericIdx].alive
          );
          // Merge: rename the generic NPC entry instead of creating a duplicate
          npcs[genericIdx] = {
            ...npcs[genericIdx],
            ...npcUpd,
            status: lifeState.status,
            alive: lifeState.alive
          } as NpcRelation;
        } else {
          const lifeState = synchronizeNpcLifeState(
            npcUpd.status as NpcRelation['status'] | undefined,
            npcUpd.alive
          );
          npcs.push({
            name: npcUpd.name,
            affinity: npcUpd.affinity ?? 0,
            status: lifeState.status,
            faction: npcUpd.faction,
            last_seen: npcUpd.last_seen,
            alive: lifeState.alive,
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

      if (typeof npc.affinity === 'number' && npc.alive !== false) {
        npc.status = deriveStatusFromAffinity(npc.affinity, npc.status);
      }

      const lifeState = synchronizeNpcLifeState(npc.status, npc.alive);
      npc.status = lifeState.status;
      npc.alive = lifeState.alive;
    }

    // Factions: apply deltas, clamp -100..100
    const factions = { ...sourceState.factions };
    for (const [id, delta] of Object.entries(upd?.factions ?? {})) {
      factions[id] = Math.max(-100, Math.min(100, (factions[id] ?? 0) + delta));
    }

    const clocks = sourceState.clocks ? JSON.parse(JSON.stringify(sourceState.clocks)) : {};
    for (const c of upd?.clocks_new ?? []) {
      if (!clocks[c.name]) clocks[c.name] = { current: 0, max: c.max_steps };
    }
    for (const [id, delta] of Object.entries(upd?.clocks_advance ?? {})) {
      if (clocks[id]) {
        clocks[id].current = Math.max(0, Math.min(clocks[id].max, clocks[id].current + delta));
      }
    }

    const sector_influence = sourceState.sector_influence ? { ...sourceState.sector_influence } : {};
    for (const [id, delta] of Object.entries(upd?.sector_influence ?? {})) {
      sector_influence[id] = Math.max(0, Math.min(100, (sector_influence[id] ?? 50) + delta));
    }

    const rumors = sourceState.rumors ? [...sourceState.rumors] : [];
    if (upd?.rumors_new?.length) {
      rumors.unshift(...upd.rumors_new);
    }
    const truncatedRumors = [...new Set(rumors)].slice(0, 5);

    const environment_status = upd?.environment_status !== undefined ? upd.environment_status : sourceState.environment_status;
    const director_instruction = upd?.director_instruction !== undefined ? upd.director_instruction : sourceState.director_instruction;

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
      chronology,
      clocks,
      sector_influence,
      rumors: truncatedRumors,
      environment_status,
      director_instruction
    };
  }
  function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isValidInjuryEntry(value: unknown): boolean {
    if (!isPlainRecord(value)) return false;
    return typeof value.description === 'string'
      && value.description.trim().length > 0
      && ['light', 'moderate', 'severe'].includes(String(value.severity || '').toLowerCase());
  }

  function isValidInventoryEntry(value: unknown): boolean {
    if (!isPlainRecord(value)) return false;
    return typeof value.name === 'string'
      && value.name.trim().length > 0
      && isFiniteNumber(value.qty);
  }

  function isValidNpcEntry(value: unknown): boolean {
    if (!isPlainRecord(value)) return false;
    return typeof value.name === 'string'
      && value.name.trim().length > 0
      && isFiniteNumber(value.affinity)
      && typeof value.alive === 'boolean'
      && ['ally', 'neutral', 'hostile', 'dead', 'unknown'].includes(String(value.status || '').toLowerCase());
  }

  function isValidChronologyEntry(value: unknown): boolean {
    if (!isPlainRecord(value)) return false;
    return isFiniteNumber(value.chapter)
      && typeof value.date === 'string'
      && value.date.trim().length > 0
      && typeof value.location === 'string'
      && value.location.trim().length > 0
      && typeof value.summary === 'string'
      && value.summary.trim().length > 0;
  }

  function isValidNumericRecord(value: unknown): boolean {
    if (!isPlainRecord(value)) return false;
    return Object.values(value).every(entry => isFiniteNumber(entry));
  }

  function isValidClocksRecord(value: unknown): boolean {
    if (!isPlainRecord(value)) return false;
    return Object.values(value).every(entry =>
      isPlainRecord(entry)
      && isFiniteNumber(entry.current)
      && isFiniteNumber(entry.max)
    );
  }

  export function worldStateNeedsRepair(candidate: WorldState | null | undefined): boolean {
    if (!candidate) return true;
    if (!isPlainRecord(candidate.player)) return true;

    const player = candidate.player;
    if (!isFiniteNumber(player.hp) || !isFiniteNumber(player.credits)) return true;
    if (typeof player.location !== 'string' || !player.location.trim()) return true;
    if (typeof player.date !== 'string' || !player.date.trim()) return true;
    if (!Array.isArray(player.injuries) || !player.injuries.every(isValidInjuryEntry)) return true;
    if (!Array.isArray(player.inventory) || !player.inventory.every(isValidInventoryEntry)) return true;

    if (!Array.isArray(candidate.npcs) || !candidate.npcs.every(isValidNpcEntry)) return true;
    if (!isValidNumericRecord(candidate.factions)) return true;
    if (!Array.isArray(candidate.chronology) || !candidate.chronology.every(isValidChronologyEntry)) return true;
    if (candidate.clocks !== undefined && !isValidClocksRecord(candidate.clocks)) return true;
    if (candidate.sector_influence !== undefined && !isValidNumericRecord(candidate.sector_influence)) return true;
    if (candidate.rumors !== undefined && (!Array.isArray(candidate.rumors) || !candidate.rumors.every(item => typeof item === 'string'))) return true;
    if (candidate.environment_status !== undefined && typeof candidate.environment_status !== 'string') return true;
    if (candidate.director_instruction !== undefined && typeof candidate.director_instruction !== 'string') return true;

    return false;
  }

  export function rebuildWorldStateFromHistory(
    setup: StorySetup,
    chapters: StoryChapter[],
    _existingState: WorldState | null | undefined
  ): WorldState {
    const orderedChapters = [...chapters].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    return orderedChapters.reduce<WorldState>(
      (acc, chapter) => applyStateUpdateToWorldState(acc, chapter),
      initWorldState(setup)
    );
  }

