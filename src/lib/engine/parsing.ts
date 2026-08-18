/* ═══════════════════════════════════════════════
   Parse a model response into a validated StoryChapter.
   Tolerant: extracts JSON from fenced/wrapped output and
   sanitizes prose (strips markdown, choice blocks, and any
   leading dash / em-dash on dialogue lines).
══════════════════════════════════════════════ */
import { cleanText, clip, foldText, isRecord } from './text';
import { extractStreamingJsonField, parseJsonSafely } from './jsonScan';
import { sanitizeProse, sanitizeChoiceText, sanitizeStringList } from './sanitize';
import { coerceStateUpdate } from './stateUpdate';
import {
  STORY_ATTRIBUTES,
  type StoryAttribute,
  type StoryChapter,
  type StoryChoice,
  type StoryMemoryUpdates,
  type StoryNarrative,
} from './types';


// Re-exported so callers keep a single parsing entry point.
export { sanitizeProse, extractStreamingJsonField, parseJsonSafely };

function coerceNarrative(source: unknown): StoryNarrative {
  const d = isRecord(source) ? source : {};
  return {
    action: sanitizeProse(d.action, 5500),
    dialogue: sanitizeProse(d.dialogue, 2200),
    reflection: sanitizeProse(d.reflection, 1400),
    atmosphere: cleanText(d.atmosphere, 60) || 'tense'
  };
}

// ── Choices ───────────────────────────────────────────
function inferAttribute(text: string): StoryAttribute {
  const t = foldText(text);
  if (/(force|jedi|sith|sabre|telekin|pressent|intuition)/.test(t)) return 'force';
  if (/(parler|negoci|convainc|persuad|bluff|interrog|discut|menac)/.test(t)) return 'diplomacy';
  if (/(discret|furtif|ombre|infiltr|faufiler|silenc|contourner|eviter|fuir)/.test(t)) return 'stealth';
  if (/(hack|pirat|terminal|code|systeme|verrou|droid|desactiv)/.test(t)) return 'tech';
  if (/(combat|attaqu|assaut|duel|blaster|tir|neutralis|ripost|frapp)/.test(t)) return 'combat';
  return 'survival';
}

function normalizeChoice(raw: unknown): StoryChoice | null {
  const text = sanitizeChoiceText(typeof raw === 'string' ? raw : isRecord(raw) ? raw.text : '');
  if (!text) return null;
  const rec = isRecord(raw) ? raw : {};
  const attr = String(rec.attribute || '').toLowerCase();
  const attribute = (STORY_ATTRIBUTES as readonly string[]).includes(attr)
    ? (attr as StoryAttribute)
    : inferAttribute(text);
  const difficultyNum = Number(rec.difficulty);
  const difficulty = Number.isFinite(difficultyNum) ? Math.max(1, Math.min(5, Math.round(difficultyNum))) : 3;

  const faction_impact: Record<string, number> = {};
  if (isRecord(rec.faction_impact)) {
    for (const [k, v] of Object.entries(rec.faction_impact)) {
      const n = Number(v);
      if (Number.isFinite(n)) faction_impact[k] = n;
    }
  }
  const risk = String(rec.risk || '').toLowerCase();
  return {
    text,
    attribute,
    difficulty,
    faction_impact,
    ...(typeof rec.tradeoff === 'string' && rec.tradeoff.trim() ? { tradeoff: cleanText(rec.tradeoff, 180) } : {}),
    ...(typeof rec.stakes === 'string' && rec.stakes.trim() ? { stakes: cleanText(rec.stakes, 180) } : {}),
    ...(risk === 'low' || risk === 'medium' || risk === 'high' ? { risk } : {}),
    requires_items: sanitizeStringList(rec.requires_items ?? rec.required_items ?? rec.requires ?? rec.item_required),
    consumes_items: sanitizeStringList(rec.consumes_items ?? rec.consumed_items ?? rec.items_consumed)
  };
}

function extractChoices(source: unknown): StoryChoice[] {
  const list = Array.isArray(source) ? source : [];
  const normalized = list.map(normalizeChoice).filter((c): c is StoryChoice => Boolean(c));
  const deduped = new Map<string, StoryChoice>();
  for (const choice of normalized) {
    const key = foldText(choice.text);
    const existing = deduped.get(key);
    const richness = (c: StoryChoice) => Number(Boolean(c.tradeoff)) + Number(Boolean(c.stakes)) + (c.requires_items?.length ?? 0) + (c.consumes_items?.length ?? 0);
    if (!existing || richness(choice) > richness(existing)) deduped.set(key, choice);
  }
  return Array.from(deduped.values()).slice(0, 4);
}

function defaultChoices(): StoryChoice[] {
  return [
    { text: 'Observer la scène et jauger la menace avant d\'agir.', attribute: 'survival', difficulty: 2, faction_impact: {} },
    { text: 'Engager le dialogue pour comprendre la situation.', attribute: 'diplomacy', difficulty: 2, faction_impact: {} },
    { text: 'Prendre l\'initiative et forcer le passage.', attribute: 'combat', difficulty: 3, faction_impact: {} }
  ];
}

function coerceMemoryUpdates(source: unknown): StoryMemoryUpdates {
  const d = isRecord(source) ? source : {};
  
  const coerceToString = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (isRecord(value)) {
      // Models sometimes wrap a fact as {"text": "…"} — unwrap it before
      // falling back to JSON.stringify (which leaks raw JSON into the journal).
      const name = String(value.text || value.name || value.target || value.label || value.place || value.note || '').trim();
      const detail = String(value.relation || value.type || value.status || value.role || '').trim();
      if (name && detail) return `${name} (${detail})`;
      if (name) return name;
      if (detail) return detail;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const list = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).map((s) => clip(coerceToString(s), 180)).filter((s) => s.length >= 4).slice(0, 10);
  return {
    relations: list(d.relations),
    places: list(d.places),
    injuries: list(d.injuries),
    resources: list(d.resources),
    notes: list(d.notes)
  };
}

// ── Title ─────────────────────────────────────────────
function isGenericTitle(title: string): boolean {
  return !title || /^(?:tour|turn|chapitre|chapter|sc[èe]ne)\s*(?:n[o°]\s*)?[\divxlcdm-]*$/i.test(foldText(title));
}

function deriveTitle(narrative: StoryNarrative, turn: number): string {
  const first = cleanText(narrative.action, 200).split(/[.!?\n]/).map((s) => s.trim()).find((s) => s.length >= 16) || '';
  const words = first.replace(/["'«»():,;]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length >= 2) return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
  return turn <= 1 ? 'Prologue' : 'La Croisée des Chemins';
}

// ── Entry point ───────────────────────────────────────
export function parseStoryResponse(rawText: string, turnNumber: number): StoryChapter {
  const parsed = parseJsonSafely(rawText);
  const narrative = coerceNarrative(parsed?.narrative);

  // Last resort: a model that returned prose without the JSON wrapper.
  if (!narrative.action && !narrative.dialogue) {
    narrative.action = sanitizeProse(rawText, 5500);
  }

  const rawTitle = cleanText(parsed?.chapter_title, 80);
  const chapter_title = rawTitle && !isGenericTitle(rawTitle) ? rawTitle : deriveTitle(narrative, turnNumber);

  const choices = extractChoices(parsed?.choices);
  const npcsPresent = Array.isArray(parsed?.npcs_present)
    ? (parsed.npcs_present as unknown[]).map((s) => cleanText(s, 60)).filter(Boolean).slice(0, 8)
    : [];

  return {
    chapter_title,
    // The orchestration layer owns turn numbering; model output cannot corrupt chronology.
    chapter_number: turnNumber,
    section_type: cleanText(parsed?.section_type, 40) || 'action',
    narrative,
    choices: choices.length ? choices : defaultChoices(),
    memory_updates: coerceMemoryUpdates(parsed?.memory_updates),
    state_update: coerceStateUpdate(parsed?.state_update),
    ...(npcsPresent.length ? { npcs_present: npcsPresent } : {})
  };
}
