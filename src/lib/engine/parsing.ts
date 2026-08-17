/* ═══════════════════════════════════════════════
   Parse a model response into a validated StoryChapter.
   Tolerant: extracts JSON from fenced/wrapped output and
   sanitizes prose (strips markdown, choice blocks, and any
   leading dash / em-dash on dialogue lines).
══════════════════════════════════════════════ */
import { cleanText, clip, foldText, isRecord } from './text';
import {
  STORY_ATTRIBUTES,
  type NpcRelation,
  type StateUpdate,
  type StoryAttribute,
  type StoryChapter,
  type StoryChoice,
  type StoryMemoryUpdates,
  type StoryNarrative
} from './types';

type NpcUpdate = Partial<NpcRelation> & { name: string };

// ── JSON extraction ───────────────────────────────────
function stripFences(raw: string): string {
  return String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^json\s*/i, '')
    .trim();
}

/** Scan for the largest balanced, parseable {…} block (handles prose around JSON). */
function extractLargestJsonObject(text: string): string | null {
  const chunks: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaping) escaping = false;
      else if (char === '\\') escaping = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') {
      if (!stack.length) start = i;
      stack.push(char);
    } else if (char === '}') {
      stack.pop();
      if (!stack.length && start !== -1) {
        chunks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  chunks.sort((a, b) => b.length - a.length);
  for (const chunk of chunks) {
    try {
      JSON.parse(chunk);
      return chunk;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Incrementally decode the string value of `"field": "…"` from a PARTIAL JSON
 * document still streaming in. Returns the text decoded so far, or null if the
 * field hasn't opened yet. A trailing incomplete escape is dropped (it will
 * complete on the next push). Used to show the narrative while the turn streams.
 */
export function extractStreamingJsonField(buffer: string, field: string): string | null {
  const key = `"${field}"`;
  // Find the KEY occurrence — `"action"` can also appear as a VALUE earlier in
  // the document (e.g. "section_type": "action"), so require the key colon.
  let i = -1;
  for (let from = 0; ; ) {
    const at = buffer.indexOf(key, from);
    if (at === -1) return null;
    let j = at + key.length;
    while (j < buffer.length && /\s/.test(buffer[j])) j += 1;
    if (j >= buffer.length) return null; // stream edge — can't tell key from value yet
    if (buffer[j] === ':') {
      i = j + 1;
      break;
    }
    from = at + 1;
  }
  while (i < buffer.length && /\s/.test(buffer[i])) i += 1;
  if (i >= buffer.length || buffer[i] !== '"') return null;
  i += 1;
  let out = '';
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '"') break; // value closed
    if (ch !== '\\') {
      out += ch;
      i += 1;
      continue;
    }
    if (i + 1 >= buffer.length) break; // incomplete escape at the stream edge
    const esc = buffer[i + 1];
    if (esc === 'u') {
      if (i + 6 > buffer.length) break;
      const hex = buffer.slice(i + 2, i + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) out += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }
    out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '' : esc; // \" \\ \/ → literal
    i += 2;
  }
  return out;
}

export function parseJsonSafely(raw: string): Record<string, unknown> | null {
  const cleaned = stripFences(raw);
  const largest = extractLargestJsonObject(cleaned);
  for (const candidate of [largest, cleaned]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

// ── Prose sanitization ────────────────────────────────
const CHOICE_HEADER = /^(?:que faites-vous|what do you do|choix|choices?|options?|vos choix|comment réagissez-vous)\b\s*[:!?]*\s*$/i;
const CHOICE_ITEM = /^(?:[-*•]\s+|[A-Da-d]\s*[)\].:-]\s+|\d{1,2}\s*[)\].:-]\s+)/;

export function sanitizeProse(value: unknown, maxLength = 4000): string {
  const text = cleanText(value, maxLength);
  if (!text || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) return '';

  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let inChoiceBlock = false;
  const flush = () => {
    const para = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (para) paragraphs.push(para);
    buffer = [];
  };

  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    // Strip markdown decoration (not dashes yet — they matter for choice detection).
    line = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^\*\*\s*|\s*\*\*$/g, '')
      .replace(/^[_`*]+|[_`*]+$/g, '')
      .trim();
    if (!line) continue;
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(line)) {
      flush();
      continue;
    }
    if (CHOICE_HEADER.test(line)) {
      flush();
      inChoiceBlock = true;
      continue;
    }
    if (inChoiceBlock) {
      if (CHOICE_ITEM.test(line)) continue; // drop the listed choice (still bulleted here)
      inChoiceBlock = false;
    }
    // BAN any leading dash / em-dash on a kept line ("— Leia : …" → "Leia : …"),
    // and any dash introducing speech after the colon ("Leia : — Je…" → "Leia : Je…").
    line = line.replace(/^[—\-–\s]+(?!\d)/, '').replace(/:\s*[—\-–]\s*(?!\d)/, ': ').trim();
    if (!line) continue;
    buffer.push(line);
  }
  flush();
  return paragraphs.join('\n\n').slice(0, maxLength);
}

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

function sanitizeChoiceText(value: unknown): string {
  let text = cleanText(value, 240);
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(/^(?:[-*•]\s*|[A-Da-d]\s*[)\].:-]\s*|\d{1,2}\s*[)\].:-]\s*)/, '').trim();
    if (next === text) break;
    text = next;
  }
  return text.replace(/^["'«»\s]+|["'«»\s]+$/g, '').trim().slice(0, 220);
}

function sanitizeStringList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string' || typeof entry === 'number') return cleanText(entry, 80);
      if (isRecord(entry)) return cleanText(entry.name || entry.text || entry.item || '', 80);
      return '';
    })
    .filter(Boolean)
    .slice(0, max);
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

// ── State update ──────────────────────────────────────
function coerceStateUpdate(source: unknown): StateUpdate | undefined {
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
