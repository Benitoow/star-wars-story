/* ═══════════════════════════════════════════════
   World-state reducer — applies a chapter's state_update
   to the living world. hp/credits are signed deltas.
══════════════════════════════════════════════ */
import { FACTION_CREDITS, ERA_START_DATES } from '$lib/content/catalog';
import { clamp, cleanText, foldText } from './text';
import {
  INITIAL_LOCATION,
  SKILL_NAMES,
  advanceNarrativeDate,
  defaultCampaign,
  defaultSkills,
  factionKeyForSetup,
  isLikelyNpcName,
  isUnknownLocation,
  validCampaign,
  validEnding,
  validSkills,
} from './worldNormalize';
import { applyInjuries, applyInventory, resolveLocation, upsertNpcs } from './worldMutations';
import type {
  CampaignState,
  SkillProfile,
  StoryChoice,
  StorySetup,
  StoryChapter,
  WorldEvent,
  WorldState,
} from './types';

// Re-exported so the world module stays a single entry point for callers.
export { advanceNarrativeDate, isUnknownLocation, isLikelyNpcName } from './worldNormalize';

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

/** Replay every chapter from a fresh init — used to repair a corrupted saved state.
 * Note: the campaign dossier is engine-owned and not stored in chapters, so a
 * rebuilt world starts without it (the campaign simply continues dossier-less). */
export function rebuildWorldState(setup: StorySetup, chapters: StoryChapter[]): WorldState {
  return [...chapters]
    .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
    .reduce<WorldState>((acc, chapter) => applyStateUpdate(acc, chapter), initWorldState(setup));
}
