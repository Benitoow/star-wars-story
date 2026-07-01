/* ═══════════════════════════════════════════════
   Structured narrative memory — categorized facts with
   per-category caps and turn stamps, plus hierarchical
   folding of the campaign archive. Balanced eviction:
   a flood of notes can no longer push relations out.
══════════════════════════════════════════════ */
import { cleanText, foldText } from './text';
import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryFact, type StoryChapter } from './types';

// Eviction happens inside a category, oldest turn first — a chatty category
// can only crowd itself, never the others.
const CATEGORY_CAPS: Record<MemoryCategory, number> = {
  relations: 14,
  places: 10,
  injuries: 8,
  resources: 10,
  notes: 16
};

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  relations: 'Relations',
  places: 'Lieux',
  injuries: 'Blessures marquantes',
  resources: 'Ressources',
  notes: 'Notes & faits établis'
};

export function memoryCategoryLabel(category: MemoryCategory): string {
  return CATEGORY_LABELS[category];
}

function sanitizeFact(raw: unknown): MemoryFact | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<MemoryFact>;
  const text = cleanText(f.text, 280);
  if (!text) return null;
  const category = MEMORY_CATEGORIES.includes(f.category as MemoryCategory) ? (f.category as MemoryCategory) : 'notes';
  const turn = Number.isFinite(f.turn) && (f.turn as number) >= 0 ? Math.floor(f.turn as number) : 0;
  return { text, category, turn };
}

/** Shape repair for persisted data that may predate the current code. */
export function sanitizeMemory(raw: unknown): MemoryFact[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeFact).filter((f): f is MemoryFact => f !== null);
}

/** Upgrade a legacy flat fact list (pre-categorization saves). */
export function fromLegacyFacts(lines: string[]): MemoryFact[] {
  return lines
    .map((text) => ({ text: cleanText(text, 280), category: 'notes' as const, turn: 0 }))
    .filter((f) => f.text);
}

/**
 * Merge a chapter's memory_updates into the structured memory.
 * Re-stating a known fact (accent-folded match) refreshes its turn stamp
 * instead of duplicating it, so recurring facts stay recent instead of
 * accumulating copies.
 */
export function mergeMemoryFacts(existing: MemoryFact[], chapter: StoryChapter): MemoryFact[] {
  const turn = chapter.chapter_number || 0;
  const merged = existing.map((f) => ({ ...f }));
  const byFold = new Map(merged.map((f) => [foldText(f.text), f]));

  const updates = chapter.memory_updates;
  const incoming: Array<[MemoryCategory, string[] | undefined]> = [
    ['relations', updates?.relations],
    ['places', updates?.places],
    ['injuries', updates?.injuries],
    ['resources', updates?.resources],
    ['notes', updates?.notes]
  ];
  for (const [category, texts] of incoming) {
    for (const rawText of texts ?? []) {
      const text = cleanText(rawText, 280);
      if (!text) continue;
      const key = foldText(text);
      const known = byFold.get(key);
      if (known) {
        known.turn = Math.max(known.turn, turn);
      } else {
        const fact: MemoryFact = { text, category, turn };
        merged.push(fact);
        byFold.set(key, fact);
      }
    }
  }

  const result: MemoryFact[] = [];
  for (const category of MEMORY_CATEGORIES) {
    const ofCategory = merged.filter((f) => f.category === category);
    ofCategory.sort((a, b) => a.turn - b.turn);
    result.push(...ofCategory.slice(-CATEGORY_CAPS[category]));
  }
  return result;
}

/** Grouped memory block for a system prompt. Empty string when there is nothing to say. */
export function renderMemoryBlock(facts: MemoryFact[]): string {
  if (!facts.length) return '';
  const sections: string[] = [];
  for (const category of MEMORY_CATEGORIES) {
    const ofCategory = facts.filter((f) => f.category === category);
    if (!ofCategory.length) continue;
    const lines = ofCategory.map((f) => `  - ${f.turn > 0 ? `(T${f.turn}) ` : ''}${f.text}`);
    sections.push(`${CATEGORY_LABELS[category]} :\n${lines.join('\n')}`);
  }
  return `\nMÉMOIRE NARRATIVE (faits établis — T = tour d'origine, ne jamais les contredire) :\n${sections.join('\n')}`;
}

/** Flat one-line renditions, most recent last — for compact prompts (Mode Direct). */
export function memoryFactLines(facts: MemoryFact[], max = 20): string[] {
  return [...facts]
    .sort((a, b) => a.turn - b.turn)
    .slice(-max)
    .map((f) => f.text);
}

// Beyond this many detailed archive lines, older ones fold into title-only arcs.
const ARCHIVE_DETAILED_MAX = 30;
const ARCHIVE_ARC_SIZE = 12;

function archiveTitle(line: string): string {
  const m = line.match(/^Tour\s+\d+\s*:\s*(.+?)\s*\(/);
  return m ? m[1] : cleanText(line, 60);
}

function archiveTurnNumber(line: string): string {
  const m = line.match(/^Tour\s+(\d+)/);
  return m ? m[1] : '?';
}

/**
 * Keep the newest archive lines fully detailed; compress everything older
 * into title-only "arc" lines (12 turns per arc), so the archive block stays
 * bounded on very long campaigns without losing the thread of the story.
 */
export function foldArchive(archive: string[], maxDetailed = ARCHIVE_DETAILED_MAX): string[] {
  if (archive.length <= maxDetailed) return archive;
  const old = archive.slice(0, archive.length - maxDetailed);
  const recent = archive.slice(archive.length - maxDetailed);

  const arcs: string[] = [];
  for (let i = 0; i < old.length; i += ARCHIVE_ARC_SIZE) {
    const chunk = old.slice(i, i + ARCHIVE_ARC_SIZE);
    const titles = chunk.map(archiveTitle).filter(Boolean);
    const first = archiveTurnNumber(chunk[0]);
    const last = archiveTurnNumber(chunk[chunk.length - 1]);
    const range = first === last ? `Tour ${first}` : `Tours ${first}–${last}`;
    arcs.push(`${range} : ${titles.join(' · ')}`);
  }
  return [...arcs, ...recent];
}
