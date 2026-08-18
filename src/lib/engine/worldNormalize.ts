/* ═══════════════
   World-state normalization: heuristics that keep the model from writing
   junk into the world (faction labels as locations, generic NPC names),
   narrative date arithmetic, and the defaults/validators every saved state
   is repaired against on load.
═══════════════ */
import { deriveSkillProfile } from '$lib/content/catalog';
import { clamp, foldText } from './text';
import type {
  CampaignState,
  EndingType,
  GameEnding,
  NpcStatus,
  SkillProfile,
  StorySetup,
} from './types';

export const INITIAL_LOCATION = "À déterminer par l'introduction";
export const SKILL_NAMES: Array<keyof SkillProfile> = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'];
const ENDING_TYPES: EndingType[] = ['victory', 'death', 'retirement', 'defeat'];

const UNKNOWN_LOCATION = /^(?:inconnu[e]?|unknown|ind[ée]termin[ée]?|non renseign[ée]?|n\/?a|null|undefined|aucun lieu)?$/i;
// A bare faction name is not a place — the model sometimes leaks one into `location`.
const FACTION_LABEL = /^(?:ordre )?(?:jedi|sith|empire|alliance rebelle|rebelles?|r[ée]publique|premier ordre|first order|cartel hutt|hutt|mandalore|mandaloriens?)$/i;
export const GENERIC_NPC = /^(?:l['’ ]?(?:inconnu|homme|officier|[ée]tranger)|la (?:femme|silhouette)|un(?:e)? (?:homme|femme|garde|soldat|individu|[ée]tranger))/i;

export function isUnknownLocation(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return !text || UNKNOWN_LOCATION.test(text);
}

export function looksLikeFactionLabel(value: unknown): boolean {
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

export function normalizeStatus(status: unknown): NpcStatus {
  const s = String(status || '').toLowerCase();
  if (s === 'ally' || s === 'hostile' || s === 'dead') return s;
  return 'neutral';
}

export function statusFromAffinity(affinity: number, current: NpcStatus): NpcStatus {
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

export function defaultCampaign(setup: StorySetup): CampaignState {
  const objective = String(setup.premise || 'Comprendre la menace et choisir ce que le protagoniste est prêt à sacrifier.').trim();
  return {
    title: 'Le fil rouge se dessine',
    objective,
    progress: 'Le protagoniste vient de franchir le premier seuil.',
    status: 'active'
  };
}

export function defaultSkills(setup: StorySetup): SkillProfile {
  return deriveSkillProfile(setup);
}

export function validSkills(raw: Partial<SkillProfile> | undefined, fallback: SkillProfile): SkillProfile {
  const skills = { ...fallback };
  for (const key of SKILL_NAMES) {
    if (typeof raw?.[key] === 'number' && Number.isFinite(raw[key])) skills[key] = clamp(Math.round(raw[key] as number), 1, 5);
  }
  return skills;
}

export function validCampaign(raw: Partial<CampaignState> | undefined, fallback: CampaignState): CampaignState {
  const status = raw?.status === 'completed' || raw?.status === 'failed' || raw?.status === 'active'
    ? raw.status
    : fallback.status;
  return {
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : fallback.title,
    objective: typeof raw?.objective === 'string' && raw.objective.trim() ? raw.objective.trim().slice(0, 300) : fallback.objective,
    progress: typeof raw?.progress === 'string' && raw.progress.trim() ? raw.progress.trim().slice(0, 300) : fallback.progress,
    status,
    // The dossier is engine-owned (generated once at turn 1); the model never
    // emits it, so it must ALWAYS fall back to the existing one.
    dossier: typeof raw?.dossier === 'string' && raw.dossier.trim() ? raw.dossier.trim().slice(0, 2400) : fallback.dossier
  };
}

export function validEnding(raw: Partial<GameEnding> | undefined): GameEnding | undefined {
  if (!raw || !ENDING_TYPES.includes(raw.type as EndingType)) return undefined;
  return {
    type: raw.type as EndingType,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : 'Fin de la campagne',
    epilogue: typeof raw.epilogue === 'string' ? raw.epilogue.trim().slice(0, 1200) : ''
  };
}

export function factionKeyForSetup(faction: string): string | null {
  return faction && faction !== 'neutral' ? faction : null;
}
