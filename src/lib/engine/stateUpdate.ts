/* ═══════════════
   Coerce the model's raw state_update object into a validated StateUpdate:
   signed deltas, NPC entries, factions, injuries, inventory and campaign.
   Anything unparseable is dropped rather than guessed.
═══════════════ */
import { cleanText, clip, isRecord } from './text';
import { sanitizeStringList } from './sanitize';
import { STORY_ATTRIBUTES, type NpcRelation, type StateUpdate, type StoryAttribute } from './types';

type NpcUpdate = Partial<NpcRelation> & { name: string };

export function coerceStateUpdate(source: unknown): StateUpdate | undefined {
  if (!isRecord(source)) return undefined;
  const d = source;
  const u: StateUpdate = {};
  const numeric = (value: unknown): number | undefined => {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };

  const hp = numeric(d.hp);
  const credits = numeric(d.credits);
  const experience = numeric(d.experience ?? d.xp);
  if (hp !== undefined) u.hp = Math.max(-100, Math.min(100, hp));
  if (credits !== undefined) u.credits = Math.round(credits);
  if (experience !== undefined) u.experience = Math.max(-100, Math.min(100, Math.round(experience)));
  if (isRecord(d.skill_gains ?? d.skills)) {
    const gains: Record<string, number> = {};
    for (const [key, value] of Object.entries((d.skill_gains ?? d.skills) as Record<string, unknown>)) {
      const n = numeric(value);
      if (n !== undefined && STORY_ATTRIBUTES.includes(key as StoryAttribute)) gains[key] = Math.max(-2, Math.min(2, Math.round(n)));
    }
    if (Object.keys(gains).length) u.skill_gains = gains as StateUpdate['skill_gains'];
  }
  if (typeof d.location === 'string' && d.location.trim()) u.location = cleanText(d.location, 80);
  if (typeof d.date_advance === 'string' && d.date_advance.trim()) u.date_advance = cleanText(d.date_advance, 80);
  if (typeof d.environment_status === 'string') u.environment_status = cleanText(d.environment_status, 120);
  if (isRecord(d.campaign_update ?? d.campaign)) {
    const campaign = (d.campaign_update ?? d.campaign) as Record<string, unknown>;
    const status = String(campaign.status || '').toLowerCase();
    u.campaign_update = {
      ...(typeof campaign.title === 'string' ? { title: cleanText(campaign.title, 120) } : {}),
      ...(typeof campaign.objective === 'string' ? { objective: cleanText(campaign.objective, 300) } : {}),
      ...(typeof campaign.progress === 'string' ? { progress: cleanText(campaign.progress, 300) } : {}),
      ...(status === 'active' || status === 'completed' || status === 'failed' ? { status } : {})
    };
  }
  if (Array.isArray(d.world_events_new ?? d.offscreen_events)) {
    u.world_events_new = sanitizeStringList(d.world_events_new ?? d.offscreen_events, 2).map((event) => clip(event, 240));
  }
  if (isRecord(d.ending) && ['victory', 'death', 'retirement', 'defeat'].includes(String(d.ending.type || '').toLowerCase())) {
    u.ending = {
      type: String(d.ending.type).toLowerCase() as 'victory' | 'death' | 'retirement' | 'defeat',
      title: cleanText(d.ending.title, 120),
      epilogue: cleanText(d.ending.epilogue, 1200)
    };
  }

  if (isRecord(d.factions)) {
    const f: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.factions)) {
      const n = Number(v);
      if (Number.isFinite(n)) f[k] = Math.max(-50, Math.min(50, n));
    }
    if (Object.keys(f).length) u.factions = f;
  }

  if (Array.isArray(d.npcs)) {
    const npcs = d.npcs.filter(isRecord).flatMap((n) => {
      const name = cleanText(n.name, 60);
      if (!name) return [];
      const entry: NpcUpdate = { name };
      const affinity = Number(n.affinity);
      if (Number.isFinite(affinity)) entry.affinity = Math.max(-100, Math.min(100, affinity));
      const status = String(n.status || '').toLowerCase();
      if (status === 'ally' || status === 'neutral' || status === 'hostile' || status === 'dead') entry.status = status;
      if (typeof n.faction === 'string') entry.faction = cleanText(n.faction, 40);
      if (typeof n.note === 'string') entry.note = cleanText(n.note, 120);
      if (typeof n.alive === 'boolean') entry.alive = n.alive;
      return [entry];
    });
    if (npcs.length) u.npcs = npcs;
  }

  if (Array.isArray(d.injuries_new)) {
    u.injuries_new = d.injuries_new.filter(isRecord).map((i) => ({
      description: cleanText(i.description, 100),
      severity: (['light', 'moderate', 'severe'].includes(String(i.severity || '').toLowerCase())
        ? String(i.severity).toLowerCase()
        : 'light') as 'light' | 'moderate' | 'severe'
    })).filter((i) => i.description);
  }
  if (Array.isArray(d.injuries_resolved)) {
    u.injuries_resolved = d.injuries_resolved.map((s) => cleanText(s, 100)).filter(Boolean);
  }
  for (const key of ['inventory_gained', 'inventory_lost'] as const) {
    if (Array.isArray(d[key])) {
      u[key] = (d[key] as unknown[]).filter(isRecord).map((i) => ({
        name: cleanText(i.name, 60),
        qty: Math.max(1, Number(i.qty) || 1)
      })).filter((i) => i.name);
    }
  }
  if (Array.isArray(d.rumors_new)) {
    u.rumors_new = d.rumors_new.map((s) => cleanText(s, 160)).filter(Boolean).slice(0, 5);
  }

  return Object.keys(u).length ? u : undefined;
}
