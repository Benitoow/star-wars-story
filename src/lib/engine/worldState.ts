/* ═══════════════════════════════════════════════
   World-state reducer — applies a chapter's state_update
   to the living world. hp/credits are signed deltas.
══════════════════════════════════════════════ */
import { FACTION_CREDITS, ERA_START_DATES, deriveSkillProfile } from '$lib/content/catalog';
import { clamp, cleanText, foldText } from './text';
import type {
  CampaignState,
  EndingType,
  GameEnding,
  NpcRelation,
  NpcStatus,
  SkillProfile,
  StateUpdate,
  StoryChoice,
  StorySetup,
  StoryChapter,
  WorldEvent,
  WorldState
} from './types';

const INITIAL_LOCATION = "À déterminer par l'introduction";
const SKILL_NAMES: Array<keyof SkillProfile> = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'];
const ENDING_TYPES: EndingType[] = ['victory', 'death', 'retirement', 'defeat'];

const UNKNOWN_LOCATION = /^(?:inconnu[e]?|unknown|ind[ée]termin[ée]?|non renseign[ée]?|n\/?a|null|undefined|aucun lieu)?$/i;
// A bare faction name is not a place — the model sometimes leaks one into `location`.
const FACTION_LABEL = /^(?:ordre )?(?:jedi|sith|empire|alliance rebelle|rebelles?|r[ée]publique|premier ordre|first order|cartel hutt|hutt|mandalore|mandaloriens?)$/i;
const GENERIC_NPC = /^(?:l['’ ]?(?:inconnu|homme|officier|[ée]tranger)|la (?:femme|silhouette)|un(?:e)? (?:homme|femme|garde|soldat|individu|[ée]tranger))/i;

export function isUnknownLocation(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return !text || UNKNOWN_LOCATION.test(text);
}

function looksLikeFactionLabel(value: unknown): boolean {
  return FACTION_LABEL.test(foldText(value));
}

/** Light guard: reject empty, over-long, or article-led strings as NPC names. */
export function isLikelyNpcName(value: unknown): boolean {
  const folded = foldText(value);
  if (!folded || folded.length < 2) return false;
  if (folded.split(/\s+/).length > 4) return false;
  if (/^(?:le|la|les|un|une|des|du|de|d)\s/.test(folded)) return false;
  return true;
}

function normalizeStatus(status: unknown): NpcStatus {
  const s = String(status || '').toLowerCase();
  if (s === 'ally' || s === 'hostile' || s === 'dead') return s;
  return 'neutral';
}

function statusFromAffinity(affinity: number, current: NpcStatus): NpcStatus {
  if (current === 'dead') return 'dead';
  if (affinity >= 25) return 'ally';
  if (affinity <= -25) return 'hostile';
  return 'neutral';
}

/** Merge a narrative date with a validated, short advance hint. */
export function advanceNarrativeDate(baseDate: string, advance?: string): string {
  const base = String(baseDate || '').trim();
  const raw = String(advance || '').replace(/^\+\s*/, '').trim();
  if (!raw) return base;

  // An absolute era marker (AVBY/APBY/BBY/ABY) means the model gave a full date.
  if (/\b(?:AVBY|APBY|BBY|ABY)\b/i.test(raw)) return raw;

  const baseDay = base.match(/\bjour\s*(\d+)\b/i);
  const relative = raw.match(/^([+-]?\d+)\s*jours?$/i);
  if (baseDay && relative) {
    const next = Math.max(1, Number(baseDay[1]) + Number(relative[1]));
    return base.replace(/\bjour\s*\d+\b/i, `Jour ${next}`);
  }

  // Keep only a short duration. Narrative prose such as "quelques minutes
  // d'accalmie dans la cour" must never become the in-universe calendar.
  const duration = raw.match(/^(?:(?:quelques|un|une|[0-9]+)\s+(?:secondes?|minutes?|heures?|jours?|semaines?|mois))(?:\b|$)/i)?.[0]?.trim();
  if (!duration) return base;
  const prefix = base.split(/\s+\+\s+/)[0].trim();
  const previous = base.match(/\+\s+(.+)$/)?.[1]?.trim();
  if (previous && foldText(previous) === foldText(duration)) return base;
  return `${prefix} + ${duration}`;
}

function defaultCampaign(setup: StorySetup): CampaignState {
  const objective = String(setup.premise || 'Comprendre la menace et choisir ce que le protagoniste est prêt à sacrifier.').trim();
  return {
    title: 'Le fil rouge se dessine',
    objective,
    progress: 'Le protagoniste vient de franchir le premier seuil.',
    status: 'active'
  };
}

function defaultSkills(setup: StorySetup): SkillProfile {
  return deriveSkillProfile(setup);
}

function validSkills(raw: Partial<SkillProfile> | undefined, fallback: SkillProfile): SkillProfile {
  const skills = { ...fallback };
  for (const key of SKILL_NAMES) {
    if (typeof raw?.[key] === 'number' && Number.isFinite(raw[key])) skills[key] = clamp(Math.round(raw[key] as number), 1, 5);
  }
  return skills;
}

function validCampaign(raw: Partial<CampaignState> | undefined, fallback: CampaignState): CampaignState {
  const status = raw?.status === 'completed' || raw?.status === 'failed' || raw?.status === 'active'
    ? raw.status
    : fallback.status;
  return {
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : fallback.title,
    objective: typeof raw?.objective === 'string' && raw.objective.trim() ? raw.objective.trim().slice(0, 300) : fallback.objective,
    progress: typeof raw?.progress === 'string' && raw.progress.trim() ? raw.progress.trim().slice(0, 300) : fallback.progress,
    status
  };
}

function validEnding(raw: Partial<GameEnding> | undefined): GameEnding | undefined {
  if (!raw || !ENDING_TYPES.includes(raw.type as EndingType)) return undefined;
  return {
    type: raw.type as EndingType,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : 'Fin de la campagne',
    epilogue: typeof raw.epilogue === 'string' ? raw.epilogue.trim().slice(0, 1200) : ''
  };
}

function factionKeyForSetup(faction: string): string | null {
  return faction && faction !== 'neutral' ? faction : null;
}

export function initWorldState(setup: StorySetup): WorldState {
  const factions: Record<string, number> = {};
  const playerFaction = factionKeyForSetup(setup.faction);
  if (playerFaction) factions[playerFaction] = 50;

  return {
    player: {
      hp: 100,
      credits: FACTION_CREDITS[setup.role] ?? FACTION_CREDITS.default,
      location: INITIAL_LOCATION,
      date: ERA_START_DATES[setup.era] ?? 'Ère inconnue, Jour 1',
      injuries: [],
      inventory: [],
      skills: defaultSkills(setup),
      experience: 0,
      level: 1,
      criticalTurns: 0,
      condition: 'active'
    },
    npcs: [],
    factions,
    chronology: [],
    campaign: defaultCampaign(setup),
    world_events: [],
    rumors: []
  };
}

export function cloneWorldState(s: WorldState): WorldState {
  const fallbackSkills: SkillProfile = { combat: 2, diplomacy: 2, stealth: 2, tech: 2, force: 2, survival: 2 };
  const fallbackCampaign: CampaignState = {
    title: 'Le fil rouge se dessine', objective: 'Poursuivre la piste en cours.',
    progress: '', status: 'active'
  };
  return {
    player: {
      ...s.player,
      skills: validSkills(s.player.skills, fallbackSkills),
      experience: Number.isFinite(s.player.experience) ? Math.max(0, s.player.experience) : 0,
      level: Number.isFinite(s.player.level) ? Math.max(1, s.player.level) : 1,
      criticalTurns: Number.isFinite(s.player.criticalTurns) ? Math.max(0, s.player.criticalTurns) : 0,
      injuries: (s.player.injuries ?? []).map((i) => ({ ...i })),
      inventory: (s.player.inventory ?? []).map((i) => ({ ...i }))
    },
    npcs: (s.npcs ?? []).map((n) => ({ ...n })),
    factions: { ...(s.factions ?? {}) },
    chronology: (s.chronology ?? []).map((c) => ({ ...c })),
    campaign: validCampaign(s.campaign, fallbackCampaign),
    world_events: (s.world_events ?? []).map((e) => ({ ...e })),
    rumors: s.rumors ? [...s.rumors] : [],
    environment_status: s.environment_status,
    ending: s.ending ? { ...s.ending } : undefined
  };
}

function resolveLocation(current: string, requested: string | undefined): string {
  const req = String(requested || '').trim();
  if (req && !isUnknownLocation(req) && !looksLikeFactionLabel(req)) return req;
  return current;
}

function applyInjuries(state: WorldState, upd: StateUpdate): void {
  const resolved = upd.injuries_resolved ?? [];
  const surviving = state.player.injuries.filter(
    (inj) => !resolved.some((r) => foldText(inj.description).includes(foldText(r)))
  );
  state.player.injuries = [...surviving, ...(upd.injuries_new ?? [])];
}

function applyInventory(state: WorldState, upd: StateUpdate): void {
  let inv = state.player.inventory;
  for (const gained of upd.inventory_gained ?? []) {
    const existing = inv.find((i) => foldText(i.name) === foldText(gained.name));
    if (existing) existing.qty += gained.qty;
    else inv.push({ ...gained });
  }
  for (const lost of upd.inventory_lost ?? []) {
    inv = inv
      .map((i) => (foldText(i.name) === foldText(lost.name) ? { ...i, qty: i.qty - lost.qty } : i))
      .filter((i) => i.qty > 0);
  }
  state.player.inventory = inv;
}

/** Whether a choice can currently be attempted with the available inventory. */
export function hasRequiredItems(state: WorldState, choice: Pick<StoryChoice, 'requires_items'>): boolean {
  const required = new Map<string, number>();
  for (const name of choice.requires_items ?? []) {
    const key = foldText(name);
    required.set(key, (required.get(key) ?? 0) + 1);
  }
  for (const [key, quantity] of required) {
    const available = state.player.inventory.find((item) => foldText(item.name) === key)?.qty ?? 0;
    if (available < quantity) return false;
  }
  return true;
}

export function applyChoiceInventoryCost(
  source: WorldState,
  choice: Pick<StoryChoice, 'consumes_items'>,
  baseline: WorldState = source
): WorldState {
  const state = cloneWorldState(source);
  const required = new Map<string, number>();
  for (const name of choice.consumes_items ?? []) {
    const key = foldText(name);
    required.set(key, (required.get(key) ?? 0) + 1);
  }
  for (const [key, quantity] of required) {
    const beforeQty = baseline.player.inventory.find((item) => foldText(item.name) === key)?.qty ?? 0;
    const item = state.player.inventory.find((candidate) => foldText(candidate.name) === key);
    const currentQty = item?.qty ?? 0;
    const alreadyApplied = Math.max(0, beforeQty - currentQty);
    if (item) item.qty -= Math.max(0, quantity - alreadyApplied);
  }
  state.player.inventory = state.player.inventory.filter((item) => item.qty > 0);
  return state;
}

function upsertNpcs(state: WorldState, upd: StateUpdate): void {
  for (const incoming of upd.npcs ?? []) {
    if (!isLikelyNpcName(incoming.name)) continue;
    const key = foldText(incoming.name);

    let idx = state.npcs.findIndex((n) => foldText(n.name) === key);
    // Name reveal: an anonymous "l'inconnu" entry becomes the now-named NPC.
    if (idx < 0) {
      const aff = incoming.affinity ?? 0;
      idx = state.npcs.findIndex(
        (n) => GENERIC_NPC.test(n.name) && Math.abs((n.affinity ?? 0) - aff) <= 30
      );
    }

    if (idx >= 0) {
      const merged = { ...state.npcs[idx], ...incoming } as NpcRelation;
      const dead = incoming.status === 'dead' || incoming.alive === false;
      merged.status = dead ? 'dead' : statusFromAffinity(merged.affinity ?? 0, normalizeStatus(merged.status));
      merged.alive = !dead;
      state.npcs[idx] = merged;
    } else {
      const dead = incoming.status === 'dead' || incoming.alive === false;
      const affinity = clamp(incoming.affinity ?? 0, -100, 100);
      state.npcs.push({
        name: incoming.name,
        affinity,
        status: dead ? 'dead' : statusFromAffinity(affinity, normalizeStatus(incoming.status)),
        faction: incoming.faction,
        last_seen: incoming.last_seen,
        alive: !dead,
        note: incoming.note
      });
    }
  }
}

/** Apply a chapter's consequences to the world. Returns a fresh state. */
export function applyStateUpdate(source: WorldState, chapter: StoryChapter): WorldState {
  const state = cloneWorldState(source);
  const upd = chapter.state_update ?? {};
  const p = state.player;
  const wasCritical = p.condition === 'critical' || p.hp <= 0;
  const receivedRescue = typeof upd.hp === 'number' && upd.hp > 0;

  if (typeof upd.hp === 'number') p.hp = clamp(p.hp + clamp(upd.hp, -100, 100), 0, 100);
  if (typeof upd.credits === 'number') p.credits = Math.max(0, p.credits + Math.round(upd.credits));
  if (typeof upd.experience === 'number' && Number.isFinite(upd.experience)) {
    p.experience = Math.max(0, p.experience + Math.round(upd.experience));
    p.level = 1 + Math.floor(p.experience / 100);
  }
  for (const [skill, gain] of Object.entries(upd.skill_gains ?? {})) {
    if (SKILL_NAMES.includes(skill as keyof SkillProfile) && typeof gain === 'number' && Number.isFinite(gain)) {
      p.skills[skill as keyof SkillProfile] = clamp(p.skills[skill as keyof SkillProfile] + Math.round(gain), 1, 5);
    }
  }
  p.location = resolveLocation(p.location, upd.location);
  p.date = advanceNarrativeDate(p.date, upd.date_advance);

  if (p.hp <= 0) {
    p.condition = 'critical';
    p.criticalTurns = wasCritical && !receivedRescue ? p.criticalTurns + 1 : 1;
    if (p.criticalTurns >= 2 && !state.ending) {
      state.ending = {
        type: 'death',
        title: 'Le dernier souffle',
        epilogue: 'Le corps finit par céder. La galaxie continue sans toi, mais ceux qui t\'ont connu porteront la trace de ton dernier choix.'
      };
      state.campaign.status = 'failed';
    }
  } else {
    p.condition = 'active';
    p.criticalTurns = 0;
  }

  applyInjuries(state, upd);
  applyInventory(state, upd);
  upsertNpcs(state, upd);

  if (upd.campaign_update) state.campaign = validCampaign(upd.campaign_update, state.campaign);
  const requestedEnding = validEnding(upd.ending);
  // A model cannot skip the player's last-chance scene, and can never overwrite a deterministic death.
  if (state.ending?.type === 'death') {
    state.campaign.status = 'failed';
  } else if (requestedEnding && p.hp > 0 && requestedEnding.type !== 'death' && !state.ending) {
    state.ending = requestedEnding;
    state.campaign.status = requestedEnding.type === 'defeat' ? 'failed' : 'completed';
  } else if (!state.ending && p.hp > 0 && state.campaign.status === 'completed') {
    state.ending = {
      type: 'victory',
      title: state.campaign.title,
      epilogue: state.campaign.progress
    };
  } else if (!state.ending && p.hp > 0 && state.campaign.status === 'failed') {
    state.ending = {
      type: 'defeat',
      title: 'La piste s\'éteint',
      epilogue: state.campaign.progress || 'L\'objectif de la campagne échappe au protagoniste.'
    };
  }

  // Scene presence: stamp last_seen for NPCs the model lists as still on site.
  if (chapter.npcs_present?.length) {
    const present = new Set(chapter.npcs_present.map(foldText));
    for (const npc of state.npcs) {
      if (present.has(foldText(npc.name))) npc.last_seen = p.date;
    }
  }

  for (const [id, delta] of Object.entries(upd.factions ?? {})) {
    if (Number.isFinite(delta)) {
      const cleanId = id.trim();
      const canonicalKey = ['jedi', 'sith', 'empire', 'rebels', 'republic', 'mandalore', 'first_order', 'hutt', 'neutral'].find(
        (f) => f === cleanId.toLowerCase()
      ) || cleanId;
      state.factions[canonicalKey] = clamp((state.factions[canonicalKey] ?? 0) + delta, -100, 100);
    }
  }

  if (upd.rumors_new?.length) {
    state.rumors = [...new Set([...upd.rumors_new, ...(state.rumors ?? [])])].slice(0, 5);
  }
  if (upd.world_events_new?.length) {
    const incoming: WorldEvent[] = upd.world_events_new
      .map((event) => cleanText(event, 240))
      .filter(Boolean)
      .map((summary) => ({ turn: chapter.chapter_number, date: p.date, summary }));
    const keys = new Set<string>();
    state.world_events = [...incoming, ...state.world_events]
      .filter((event) => {
        const key = foldText(event.summary);
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      })
      .slice(0, 20);
  }
  if (upd.environment_status !== undefined) state.environment_status = cleanText(upd.environment_status, 160);

  state.chronology = [
    ...state.chronology,
    { chapter: chapter.chapter_number, date: p.date, location: p.location, summary: chapter.chapter_title }
  ].slice(-40);

  return state;
}

/** Replay every chapter from a fresh init — used to repair a corrupted saved state. */
export function rebuildWorldState(setup: StorySetup, chapters: StoryChapter[]): WorldState {
  return [...chapters]
    .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
    .reduce<WorldState>((acc, chapter) => applyStateUpdate(acc, chapter), initWorldState(setup));
}
