/* ═══════════════════════════════════════════════
   Parse a model response into a validated StoryChapter.
   Tolerant: extracts JSON from fenced/wrapped output and
   sanitizes prose (strips markdown, choice blocks, and any
   leading dash / em-dash on dialogue lines).
══════════════════════════════════════════════ */
import { cleanText, foldText, isRecord } from './text';
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
  return { text, attribute, difficulty, faction_impact };
}

function extractChoices(source: unknown): StoryChoice[] {
  const list = Array.isArray(source) ? source : [];
  const normalized = list.map(normalizeChoice).filter((c): c is StoryChoice => Boolean(c));
  return Array.from(new Map(normalized.map((c) => [foldText(c.text), c])).values()).slice(0, 4);
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

  if (typeof d.hp === 'number' && Number.isFinite(d.hp)) u.hp = Math.max(-100, Math.min(100, d.hp));
  if (typeof d.credits === 'number' && Number.isFinite(d.credits)) u.credits = Math.round(d.credits);
  if (typeof d.location === 'string' && d.location.trim()) u.location = cleanText(d.location, 80);
  if (typeof d.date_advance === 'string' && d.date_advance.trim()) u.date_advance = cleanText(d.date_advance, 60);
  if (typeof d.environment_status === 'string') u.environment_status = cleanText(d.environment_status, 120);

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
      if (typeof n.affinity === 'number') entry.affinity = Math.max(-100, Math.min(100, n.affinity));
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
      const name = String(value.name || value.target || value.label || value.place || value.note || '').trim();
      const detail = String(value.relation || value.type || value.status || value.role || '').trim();
      if (name && detail) return `${name} (${detail})`;
      if (name) return name;
      if (detail) return detail;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const list = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).map((s) => cleanText(coerceToString(s), 120)).filter((s) => s.length >= 4).slice(0, 10);

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

  const chapterNum = Number(parsed?.chapter_number);
  const choices = extractChoices(parsed?.choices);

  return {
    chapter_title,
    chapter_number: Number.isFinite(chapterNum) && chapterNum > 0 ? chapterNum : turnNumber,
    section_type: cleanText(parsed?.section_type, 40) || 'action',
    narrative,
    choices: choices.length ? choices : defaultChoices(),
    memory_updates: coerceMemoryUpdates(parsed?.memory_updates),
    state_update: coerceStateUpdate(parsed?.state_update)
  };
}
