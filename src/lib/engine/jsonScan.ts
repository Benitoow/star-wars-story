/* ═══════════════
   Tolerant JSON extraction from model output: strips code fences, finds the
   largest balanced {...} block inside surrounding prose, and reads a single
   field out of a half-received stream buffer.
═══════════════ */
import { isRecord } from './text';

export function stripFences(raw: string): string {
  return String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^json\s*/i, '')
    .trim();
}

/** Scan for the largest balanced, parseable {…} block (handles prose around JSON). */
export function extractLargestJsonObject(text: string): string | null {
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
