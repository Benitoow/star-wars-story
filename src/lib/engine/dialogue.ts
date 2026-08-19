/* ═══════════════════════════════════════════════
   Dialogue parsing. The whole app writes speech as
   "Nom : réplique", but the old test was a bare regex —
   any "Mot : texte" line counted, so narration like
   "Attention : le blaster est vide" was filed as dialogue,
   and a reply spilling onto a second line lost its speaker.
   Pure module: one parser, shared by the engine's prose
   splitter and the scene renderer.
══════════════════════════════════════════════ */

export interface DialogueLine {
  speaker: string | null; // null = continuation, or a line with no attribution
  text: string;
  /** True when this line continues the previous speaker's reply. */
  continuation: boolean;
}

/** Labels the models routinely use to introduce narration, not speech. */
const NARRATIVE_LABELS = new Set([
  'attention', 'note', 'objectif', 'mission', 'lieu', 'date', 'heure', 'jour',
  'avertissement', 'alerte', 'rappel', 'situation', 'contexte', 'remarque',
  'resume', 'résumé', 'suite', 'ensuite', 'puis', 'enfin', 'exemple',
  'conclusion', 'warning'
]);

const SPEAKER_CHARS = "A-Za-zÀ-ÖØ-öø-ÿ0-9'’\\-. ";
const SPEAKER_LINE = new RegExp(`^([${SPEAKER_CHARS}]{2,40}?)\\s*:\\s+(\\S.*)$`);

/** Accent-insensitive lowercase, for comparing against the label blocklist. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Does this candidate read like a character name rather than a narrative label?
 * Names are short, capitalised and free of sentence punctuation.
 */
export function isSpeakerName(candidate: string): boolean {
  const name = candidate.trim();
  if (name.length < 2 || name.length > 40) return false;
  if (NARRATIVE_LABELS.has(fold(name))) return false;
  // A speaker is 1-4 words ("Capitaine Rann", "Jyn Ors"), never a sentence.
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 4) return false;
  // Must start with a capital — narration labels mid-sentence do not.
  if (!/^[A-ZÀ-ÖØ-Þ]/.test(name)) return false;
  // Digits-only or date-like fragments ("19 AVBY") are not people.
  if (/^\d/.test(name)) return false;
  return true;
}

/** True when the line opens a new "Nom : réplique" turn. */
export function looksLikeSpeakerLine(line: string): boolean {
  const match = line.trim().match(SPEAKER_LINE);
  return match ? isSpeakerName(match[1]) : false;
}

/**
 * Split a dialogue block into attributed lines. A line without its own
 * "Nom :" prefix continues the previous speaker instead of losing them.
 */
export function parseDialogue(block: string): DialogueLine[] {
  const out: DialogueLine[] = [];
  let current: string | null = null;

  for (const raw of String(block || '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(SPEAKER_LINE);
    if (match && isSpeakerName(match[1])) {
      current = match[1].trim();
      out.push({ speaker: current, text: match[2].trim(), continuation: false });
      continue;
    }
    // No attribution: fold it into the speaker who is still talking.
    out.push({ speaker: current, text: line, continuation: current !== null });
  }
  return out;
}

/**
 * A matcher for "is this speaker the protagonist?". Writers use the first name
 * far more often than the full one, so "Kael" has to resolve to "Kael Voss" —
 * but never when an NPC already answers to that name. Returns a predicate
 * rather than a Set of folded keys, so callers cannot forget to fold.
 */
export function protagonistMatcher(fullName: string, npcNames: string[] = []): (speaker: string) => boolean {
  const taken = new Set(npcNames.map(fold));
  const aliases = new Set(
    [fullName, ...String(fullName || '').split(/\s+/)]
      .map((part) => fold(String(part || '').trim()))
      .filter((part) => part.length > 1 && !taken.has(part))
  );
  return (speaker: string) => aliases.has(fold(String(speaker || '').trim()));
}

/** Every distinct speaker in the block, in order of first appearance. */
export function speakersIn(block: string): string[] {
  const seen: string[] = [];
  for (const line of parseDialogue(block)) {
    if (line.speaker && !line.continuation && !seen.includes(line.speaker)) seen.push(line.speaker);
  }
  return seen;
}
