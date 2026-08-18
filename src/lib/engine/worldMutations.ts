/* ═══════════════
   Per-section appliers for a chapter's state_update — location, injuries,
   inventory and NPCs — plus the inventory cost of a chosen option. Each
   mutates the already-cloned draft state in place.
═══════════════ */
import { clamp, foldText } from './text';
import { GENERIC_NPC, isLikelyNpcName, isUnknownLocation, looksLikeFactionLabel, normalizeStatus, statusFromAffinity } from './worldNormalize';
import type { NpcRelation, StateUpdate, WorldState } from './types';

export function resolveLocation(current: string, requested: string | undefined): string {
  const req = String(requested || '').trim();
  if (req && !isUnknownLocation(req) && !looksLikeFactionLabel(req)) return req;
  return current;
}

export function applyInjuries(state: WorldState, upd: StateUpdate): void {
  const resolved = upd.injuries_resolved ?? [];
  const surviving = state.player.injuries.filter(
    (inj) => !resolved.some((r) => foldText(inj.description).includes(foldText(r)))
  );
  state.player.injuries = [...surviving, ...(upd.injuries_new ?? [])];
}

export function applyInventory(state: WorldState, upd: StateUpdate): void {
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

export function upsertNpcs(state: WorldState, upd: StateUpdate): void {
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
