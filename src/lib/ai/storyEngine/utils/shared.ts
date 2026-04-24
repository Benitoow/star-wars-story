/** Shared utilities for the story engine. */

export function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const CANONICAL_PLAYER_ACTION_PATTERNS = [
  /ACTION JOUEUR CANONIQUE:\s*([^\n]+)/i,
  /ACTION JOUEUR EN COURS:\s*([^\n]+)/i,
  /\bTour\s+\d+\.\s+Action:\s*"([^"]+)"/i,
  /\bAction:\s*"([^"]+)"/i
] as const;

export function extractCanonicalPlayerAction(content: string, maxCaptureLen = 240): string {
  const cleaned = cleanText(content, 1200);
  if (!cleaned) return '';
  for (const pattern of CANONICAL_PLAYER_ACTION_PATTERNS) {
    const match = cleaned.match(pattern);
    const captured = cleanText(match?.[1], maxCaptureLen);
    if (captured) return captured;
  }
  return cleanText(cleaned, maxCaptureLen);
}
