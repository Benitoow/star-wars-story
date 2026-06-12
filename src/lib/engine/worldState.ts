/* ═══════════════════════════════════════════════
   World-state reducer — applies a chapter's state_update
   to the living world. hp/credits are signed deltas.
══════════════════════════════════════════════ */
import { FACTION_CREDITS, ERA_START_DATES } from '$lib/content/catalog';
import { clamp, foldText } from './text';
import type {
  NpcRelation,
  NpcStatus,
  StateUpdate,
  StorySetup,
  StoryChapter,
  WorldState
} from './types';

const INITIAL_LOCATION = "À déterminer par l'introduction";

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

/** Merge a narrative date with an advance hint ("+1 jour", "2 jours", an absolute era date). */
export function advanceNarrativeDate(baseDate: string, advance?: string): string {
  const base = String(baseDate || '').trim();
  const adv = String(advance || '').replace(/^\+\s*/, '').trim();
  if (!adv) return base;

  // An absolute era marker (AVBY/APBY/BBY/ABY) means the model gave a full date.
  if (/\b[ab]?[bp]y\b/i.test(adv)) return adv;

  const baseDay = base.match(/\bjour\s*(\d+)\b/i);
  const relative = adv.match(/^([+-]?\d+)\s*jours?$/i);
  if (baseDay && relative) {
    const next = Math.max(1, Number(baseDay[1]) + Number(relative[1]));
    return base.replace(/\bjour\s*\d+\b/i, `Jour ${next}`);
  }
  return base ? `${base} +${adv}` : adv;
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
      condition: 'active'
    },
    npcs: [],
    factions,
    chronology: [],
    rumors: []
  };
}

export function cloneWorldState(s: WorldState): WorldState {
  return {
    player: {
      ...s.player,
      injuries: s.player.injuries.map((i) => ({ ...i })),
      inventory: s.player.inventory.map((i) => ({ ...i }))
    },
    npcs: s.npcs.map((n) => ({ ...n })),
    factions: { ...s.factions },
    chronology: s.chronology.map((c) => ({ ...c })),
    rumors: s.rumors ? [...s.rumors] : [],
    environment_status: s.environment_status
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

  if (typeof upd.hp === 'number') p.hp = clamp(p.hp + clamp(upd.hp, -100, 100), 0, 100);
  if (typeof upd.credits === 'number') p.credits = Math.max(0, p.credits + Math.round(upd.credits));
  p.location = resolveLocation(p.location, upd.location);
  p.date = advanceNarrativeDate(p.date, upd.date_advance);
  p.condition = p.hp <= 0 ? 'critical' : 'active';

  applyInjuries(state, upd);
  applyInventory(state, upd);
  upsertNpcs(state, upd);

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
  if (upd.environment_status !== undefined) state.environment_status = upd.environment_status;

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
