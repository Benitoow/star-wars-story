/* ═══════════════
   Sanitizers shared by the chapter parser and the state_update coercer:
   prose cleanup (strips markdown, choice blocks and leading dashes on
   dialogue lines) plus short string / string-list normalization.
═══════════════ */
import { cleanText, isRecord } from './text';

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

export function sanitizeChoiceText(value: unknown): string {
  let text = cleanText(value, 240);
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(/^(?:[-*•]\s*|[A-Da-d]\s*[)\].:-]\s*|\d{1,2}\s*[)\].:-]\s*)/, '').trim();
    if (next === text) break;
    text = next;
  }
  return text.replace(/^["'«»\s]+|["'«»\s]+$/g, '').trim().slice(0, 220);
}

export function sanitizeStringList(value: unknown, max = 6): string[] {
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
