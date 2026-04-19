import type {
  BackgroundWorldEvent,
  StoryChapter,
  StoryChoice,
  WorldState
} from '$lib/ai/storyEngine';

export interface BackgroundEventHistoryItem {
  title: string;
  summary: string;
}

const TRANSITION_CHAPTER_REGEX = /(transition|transit|travel|journey|voyage|trajet|marche|route|en route|approche|attente|interlude|repos|pause|accalmie|campement|surveillance|transfert|navette)/i;
const DIALOGUE_CHOICE_REGEX = /(parler|discuter|dialogue|dialoguer|interroger|questionner|négocier|convaincre|échanger|demander|écouter|sonder)/i;
const TIME_PASS_CHOICE_REGEX = /(attendre|patienter|passer le temps|se reposer|méditer|observer|planifier|faire le point|préparer|laisser avancer|laisser filer|récupérer)/i;
const ACTION_HEAVY_CHOICE_REGEX = /(attaquer|assaut|fusillade|duel|foncer|abattre|détruire|exploser|charge|combat|sabre|blaster|éliminer)/i;
const TOOL_CALL_LEAK_TEXT_REGEX = /<\|?tool_call\|?>|tool_call|(?:^|\s)call:[a-z_]+\s*\{/i;
const STRUCTURED_PAYLOAD_HINT_REGEX = /(^|\s)json\s*\{|"chapter_title"\s*:|"chapter_number"\s*:|"narrative"\s*:|"choices"\s*:/i;
const INLINE_STATE_TOKEN_REGEX = /\b(?:hp|health|sante|santé|credits?|cr[eé]dits?)\s*[:=]\s*[+-]?\d{1,7}\b/gi;
const LEADING_CHOICE_ENUM_REGEX = /^(?:[-*•]\s*|[A-Da-d]\s*[)\].:-]\s*|\d{1,2}\s*[)\].:-]\s*)/;
const URGENT_SCENE_HINT_REGEX = /(sir[eè]ne|alarme|chasseur|tie|attaque|embuscade|pas de retour|compte(?:\s|-)?[aà]\s*rebours|dans\s+trois\s+heures|chaos|urgence)/i;

export type NarrativeParagraphKind = 'prose' | 'dialogue';

export interface NarrativeParagraph {
  kind: NarrativeParagraphKind;
  text: string;
}

function stripInlineStateTokens(text: string): string {
  return String(text || '')
    .replace(INLINE_STATE_TOKEN_REGEX, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanParagraphText(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function normalizeDialogueText(text: string): string {
  const cleaned = cleanParagraphText(text)
    .replace(/^[—–\-\s]+/, '')
    .replace(/^['"«»“”]+|['"«»“”]+$/g, '')
    .trim();

  if (!cleaned) return '';
  return cleaned.startsWith('— ') ? cleaned : `— ${cleaned}`;
}


const DIALOGUE_ACTION_VERB_PREFIXES = [
  "il lève","elle lève","il court","elle court","vous ouvrez","tu ouvres",
  "il saisit","elle saisit","il pousse","elle pousse","il tire","elle tire",
  "il tourne","elle tourne","il avance","elle avance","vous avancez",
  "il frappe","elle frappe","il arrête","elle arrête","vous arrêtez",
  "il prend","elle prend","vous prenez","je prends","il pose","elle pose",
  "il montre","elle montre","vous montrez","il pointe","elle pointe",
  "il désigne","elle désigne","il tend","elle tend","il tend la main",
  "il fait","elle fait","vous faites","je fais","il attend","elle attend",
  "il crie","elle crie","vous criez","je crie","il s'écrie","elle s'écrie",
  "il répond","elle répond","vous répondez","je réponds","je murmure","je chuchote",
  "je dis","vous dites","tu dis","je lâche","vous lâchez","je sors","vous sortez"
];

function isIsolatedDialogueLine(line: string): boolean {
  const trimmed = (line || '').trim();
  if (!trimmed) return false;
  if (!/^(?:— |« |")/.test(trimmed)) return false;
  if (trimmed.length < 3 || trimmed.length > 200) return false;
  const afterPrefix = trimmed.replace(/^(?:— |« |")+/, '').trim();
  const lowerLine = afterPrefix.toLowerCase();
  for (const prefix of DIALOGUE_ACTION_VERB_PREFIXES) {
    if (lowerLine.startsWith(prefix)) return false;
  }
  return true;
}

function splitParagraphFragments(text: string): NarrativeParagraph[] {
  const fragments: NarrativeParagraph[] = [];
  const source = String(text || '').replace(/\r/g, '\n').trim();
  if (!source) return fragments;

  const collectDialogueSegments = (line: string): Array<{ start: number; end: number; text: string }> => {
    const segments: Array<{ start: number; end: number; text: string }> = [];

    for (const match of line.matchAll(/["«“]([^"\n«»“”]{2,240}?)['"»”]/g)) {
      const content = cleanParagraphText(match[1] || '');
      if (!content) continue;
      segments.push({
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        text: content
      });
    }

    for (const match of line.matchAll(/(^|[.?!;:]\s+)(—\s*[^—\n]{2,240}?(?:[.!?](?=\s|$)|$))/g)) {
      const prefix = match[1] || '';
      const content = cleanParagraphText(match[2] || '');
      if (!content) continue;
      const index = match.index ?? 0;
      segments.push({
        start: index + prefix.length,
        end: index + match[0].length,
        text: content
      });
    }

    for (const match of line.matchAll(/(^|[\s(])'([^'\n]{2,240})'(?!\w)/g)) {
      const prefix = match[1] || '';
      const content = cleanParagraphText(match[2] || '');
      if (!content) continue;
      const index = match.index ?? 0;
      segments.push({
        start: index + prefix.length,
        end: index + match[0].length,
        text: content
      });
    }

    return segments.sort((left, right) => left.start - right.start || left.end - right.end);
  };

  for (const rawLine of source.split(/\n+/)) {
    const line = cleanParagraphText(rawLine);
    if (!line) continue;

    if (/^(?:—|«|“|\")/.test(line)) {
      const dialogue = normalizeDialogueText(line);
      if (dialogue) fragments.push({ kind: 'dialogue', text: dialogue });
      continue;
    }

    const segments = collectDialogueSegments(line);
    if (!segments.length) {
      fragments.push({ kind: 'prose', text: line });
      continue;
    }

    let cursor = 0;
    for (const segment of segments) {
      if (segment.start < cursor) continue;

      const before = cleanParagraphText(line.slice(cursor, segment.start));
      if (before) fragments.push({ kind: 'prose', text: before });

      const dialogue = normalizeDialogueText(segment.text);
      if (dialogue) fragments.push({ kind: 'dialogue', text: dialogue });

      cursor = segment.end;
    }

    const tail = cleanParagraphText(line.slice(cursor).replace(/^[,;:]+\s*/, ''));
    if (tail) fragments.push({ kind: 'prose', text: tail });
  }

  return fragments;
}

export function splitNarrativeParagraphs(text: string): NarrativeParagraph[] {
  return splitParagraphFragments(text);
}

export function isDialogueParagraph(text: string): boolean {
  const trimmed = String(text || '').trim();
  return Boolean(trimmed) && (trimmed.startsWith('— ') || trimmed.startsWith('«') || trimmed.startsWith('“') || /^\"/.test(trimmed));
}

function normalizeChoiceText(text: string): string {
  let normalized = String(text || '').trim();
  for (let i = 0; i < 3; i += 1) {
    const next = normalized.replace(LEADING_CHOICE_ENUM_REGEX, '').trim();
    if (next === normalized) break;
    normalized = next;
  }

  return normalized
    .replace(/^["'«»\s]+|["'«»\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeChoiceFormatting(choices: StoryChoice[]): StoryChoice[] {
  const dedup = new Map<string, StoryChoice>();

  for (const choice of choices) {
    const text = normalizeChoiceText(choice.text);
    if (!text) continue;
    const key = text.toLowerCase();
    if (!dedup.has(key)) {
      dedup.set(key, { ...choice, text });
    }
  }

  return Array.from(dedup.values()).slice(0, 4);
}

function tryExtractNarrativeActionFromStructuredPayload(rawText: string): string | null {
  const normalized = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^json\s*/i, '')
    .trim();

  const actionMatch = normalized.match(/"action"\s*:\s*"((?:\\.|[^"\\])*)"/is);
  if (!actionMatch?.[1]) return null;

  try {
    const decoded = JSON.parse(`"${actionMatch[1]}"`);
    return String(decoded || '').trim() || null;
  } catch {
    const fallback = actionMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .trim();
    return fallback || null;
  }
}

export function sanitizeNarrativeTextForDisplay(text: string): string {
  const raw = String(text || '').replace(/\r/g, '\n');
  if (!raw.trim()) return '';

  const trimmed = raw.trim();
  const looksLikeStructuredPayload = (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    STRUCTURED_PAYLOAD_HINT_REGEX.test(trimmed)
  );

  if (looksLikeStructuredPayload) {
    const extractedAction = tryExtractNarrativeActionFromStructuredPayload(trimmed);
    if (extractedAction) {
      return splitNarrativeParagraphs(extractedAction).map(item => item.text).join('\n\n');
    }
    return 'Le passage a été nettoyé automatiquement pour éviter un affichage technique.';
  }

  const lines = raw.split('\n');
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let inChoiceBlock = false;

  const flush = (): void => {
    const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (paragraph) paragraphs.push(paragraph);
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }

    const normalized = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^\*\*\s*/, '')
      .replace(/\s*\*\*$/, '')
      .replace(/^[_`*]+|[_`*]+$/g, '')
      .replace(/^\[[^\]]+\]\s*/, '')
      .trim();

    if (!normalized) continue;
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(normalized)) {
      flush();
      continue;
    }

    if (/^(?:que faites-vous|what do you do|choices?|choix|options?|vos choix)\b[:!?]?\s*$/i.test(normalized)) {
      flush();
      inChoiceBlock = true;
      continue;
    }

    if (inChoiceBlock) continue;
    if (/^\d+[.)]\s+/.test(normalized)) continue;

    const cleanedLine = stripInlineStateTokens(normalized);
    if (!cleanedLine) continue;
    buffer.push(cleanedLine.replace(/\s{2,}/g, ' '));
  }

  flush();
  if (paragraphs.length) {
    return paragraphs
      .flatMap(paragraph => splitNarrativeParagraphs(paragraph).map(item => item.text))
      .join('\n\n')
      .trim();
  }

  return TOOL_CALL_LEAK_TEXT_REGEX.test(raw)
    ? 'Le système IA a renvoyé une sortie technique non lisible pour ce passage. L\'histoire continue normalement via les choix ci-dessous.'
    : 'Le passage a été nettoyé automatiquement pour éviter un affichage technique.';
}

export function sanitizeChapterForDisplay(chapter: StoryChapter | null): StoryChapter | null {
  if (!chapter) return null;

  return {
    ...chapter,
    chapter_title: sanitizeNarrativeTextForDisplay(chapter.chapter_title),
    narrative: {
      ...chapter.narrative,
      action: sanitizeNarrativeTextForDisplay(chapter.narrative.action),
      context: sanitizeNarrativeTextForDisplay(chapter.narrative.context),
      dialogue: sanitizeNarrativeTextForDisplay(chapter.narrative.dialogue),
      reflection: sanitizeNarrativeTextForDisplay(chapter.narrative.reflection)
    }
  };
}

export function sanitizeChapterList(chapters: StoryChapter[]): StoryChapter[] {
  return chapters.map(chapter => sanitizeChapterForDisplay(chapter) as StoryChapter);
}

function normalizeEventText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventTokenSet(value: string): Set<string> {
  return new Set(
    normalizeEventText(value)
      .split(' ')
      .map(token => token.trim())
      .filter(token => token.length >= 4)
  );
}

function tokenOverlapRatio(left: string, right: string): number {
  const a = eventTokenSet(left);
  const b = eventTokenSet(right);
  if (!a.size || !b.size) return 0;

  let common = 0;
  for (const token of a) {
    if (b.has(token)) common += 1;
  }

  return common / Math.max(a.size, b.size);
}

export function isNearDuplicateBackgroundEvent(
  event: BackgroundWorldEvent,
  backgroundEvents: BackgroundEventHistoryItem[]
): boolean {
  const incomingTitle = normalizeEventText(event.title);
  const incomingSummary = normalizeEventText(event.summary_public || event.prompt_hook || '');
  if (!incomingTitle && !incomingSummary) return false;

  return backgroundEvents.slice(0, 6).some(previous => {
    const previousTitle = normalizeEventText(previous.title);
    const previousSummary = normalizeEventText(previous.summary);

    const titleMatch = Boolean(
      incomingTitle &&
      previousTitle &&
      (incomingTitle === previousTitle || incomingTitle.includes(previousTitle) || previousTitle.includes(incomingTitle))
    );

    const summaryMatch = Boolean(
      incomingSummary &&
      previousSummary &&
      (incomingSummary === previousSummary || incomingSummary.includes(previousSummary) || previousSummary.includes(incomingSummary))
    );

    const overlap = tokenOverlapRatio(incomingSummary || incomingTitle, previousSummary || previousTitle);
    return (titleMatch && (summaryMatch || overlap >= 0.72)) || (summaryMatch && overlap >= 0.72) || overlap >= 0.85;
  });
}

function normalizeSearchText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function chapterCorpusForNpcDetection(chapter: StoryChapter): string {
  return [
    chapter.chapter_title,
    chapter.narrative.context,
    chapter.narrative.action,
    chapter.narrative.dialogue,
    chapter.narrative.reflection,
    ...chapter.choices.map(choice => choice.text)
  ].join(' ');
}

function textMentionsNpc(corpus: string, npcName: string): boolean {
  const haystack = ` ${normalizeSearchText(corpus)} `;
  const normalizedName = normalizeSearchText(npcName).trim();
  if (!normalizedName) return false;

  const fullNamePattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedName)}([^a-z0-9]|$)`);
  if (fullNamePattern.test(haystack)) return true;

  const parts = normalizedName
    .split(/\s+/)
    .map(part => part.trim())
    .filter(part => part.length >= 4);

  return parts.some(part => {
    const partPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(part)}([^a-z0-9]|$)`);
    return partPattern.test(haystack);
  });
}

export function buildSceneAnchor(ws: WorldState, lastChapter: StoryChapter): string {
  const p = ws.player;
  const aliveNpcs = ws.npcs
    .filter(n => n.alive !== false)
    .slice(0, 5)
    .map(n => `${n.name}(${n.affinity > 30 ? '★' : n.affinity < -30 ? '✖' : '~'}${n.status !== 'neutral' ? `,${n.status}` : ''})`)
    .join(', ');
  const injNote = p.injuries.length
    ? ` | Blessures: ${p.injuries.map(i => `${i.description}[${i.severity}]`).join(', ')}`
    : '';
  const factionNote = Object.entries(ws.factions)
    .filter(([, score]) => Math.abs(score) > 20)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 2)
    .map(([id, score]) => `${id}:${score > 0 ? '+' : ''}${score}`)
    .join(', ');
  const lastText = (lastChapter.narrative.action || lastChapter.narrative.context || '').replace(/\s+/g, ' ').slice(0, 220);
  return `[ANCRE Tour ${lastChapter.chapter_number}: "${lastChapter.chapter_title}" | ${p.location} | ${p.hp}HP ${p.credits}₡${injNote}${factionNote ? ` | Factions: ${factionNote}` : ''} | PNJs: ${aliveNpcs || 'aucun'} | "${lastText}…"]`;
}

function chapterLooksLikeTransition(chapter: StoryChapter): boolean {
  const sectionType = chapter.section_type || '';
  if (TRANSITION_CHAPTER_REGEX.test(sectionType)) return true;

  const corpus = [
    chapter.chapter_title,
    chapter.narrative.context,
    chapter.narrative.action,
    chapter.narrative.dialogue,
    chapter.narrative.reflection
  ].join(' ');

  return TRANSITION_CHAPTER_REGEX.test(corpus);
}

export function getNearbyNpcNames(chapter: StoryChapter, worldState: WorldState, max = 2): string[] {
  const location = normalizeSearchText((worldState.player.location || '').trim());
  const aliveNpcs = worldState.npcs.filter(npc => npc.alive !== false && npc.status !== 'dead' && npc.name.trim());
  if (!aliveNpcs.length) return [];

  const chapterCorpus = chapterCorpusForNpcDetection(chapter);

  const mentionedNpcs = aliveNpcs.filter(npc => textMentionsNpc(chapterCorpus, npc.name));

  const localNpcs = aliveNpcs.filter(npc => {
    const lastSeen = normalizeSearchText((npc.last_seen || '').trim());
    if (!lastSeen || !location || location === 'inconnu') return false;
    return lastSeen.includes(location) || location.includes(lastSeen);
  });

  const sociallyRelevantNpcs = aliveNpcs
    .filter(npc => npc.status === 'ally' || npc.status === 'neutral')
    .sort((left, right) => (right.affinity ?? 0) - (left.affinity ?? 0));

  const rankedNpcs = [
    ...localNpcs,
    ...mentionedNpcs,
    ...((!location || location === 'inconnu') ? sociallyRelevantNpcs : [])
  ];

  const unique = Array.from(new Map(
    rankedNpcs.map(npc => [normalizeSearchText(npc.name), npc])
  ).values());

  return unique
    .map(npc => npc.name.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function enforceTransitionChoiceQuality(chapter: StoryChapter, worldState: WorldState): StoryChapter {
  const normalizedChoices = normalizeChoiceFormatting(chapter.choices);
  const preparedChapter = normalizedChoices.length
    ? { ...chapter, choices: normalizedChoices }
    : chapter;

  if (!chapterLooksLikeTransition(preparedChapter)) {
    const urgencyCorpus = [
      preparedChapter.chapter_title,
      preparedChapter.narrative.context,
      preparedChapter.narrative.action,
      preparedChapter.narrative.dialogue,
      preparedChapter.narrative.reflection
    ].join(' ');

    if (URGENT_SCENE_HINT_REGEX.test(urgencyCorpus)) {
      const replaceIndex = preparedChapter.choices.findIndex(choice => TIME_PASS_CHOICE_REGEX.test(choice.text));
      if (replaceIndex >= 0) {
        const nearbyNpc = getNearbyNpcNames(preparedChapter, worldState, 1)[0];
        const replacement: StoryChoice = nearbyNpc
          ? {
              text: `Interroger ${nearbyNpc} immédiatement pour verrouiller le plan avant l'arrivée ennemie.`,
              attribute: 'diplomacy',
              difficulty: 3,
              faction_impact: {}
            }
          : {
              text: 'Sécuriser immédiatement le périmètre du hangar et préparer une riposte avant l’arrivée des chasseurs.',
              attribute: 'combat',
              difficulty: 3,
              faction_impact: {}
            };

        const updatedChoices = [...preparedChapter.choices];
        updatedChoices[replaceIndex] = replacement;
        return { ...preparedChapter, choices: normalizeChoiceFormatting(updatedChoices) };
      }
    }

    return preparedChapter;
  }

  const choices = [...preparedChapter.choices];
  if (!choices.length) return preparedChapter;

  const hasDialogueChoice = choices.some(choice => DIALOGUE_CHOICE_REGEX.test(choice.text));
  const hasTimePassChoice = choices.some(choice => TIME_PASS_CHOICE_REGEX.test(choice.text));

  const nearbyNpcs = getNearbyNpcNames(preparedChapter, worldState);
  let injectedChoice: StoryChoice | null = null;

  if (nearbyNpcs.length > 0 && !hasDialogueChoice) {
    const npcLabel = nearbyNpcs.length > 1
      ? `${nearbyNpcs[0]} et ${nearbyNpcs[1]}`
      : nearbyNpcs[0];

    injectedChoice = {
      text: `Engager la conversation avec ${npcLabel} pour clarifier la situation avant d'agir.`,
      attribute: 'diplomacy',
      difficulty: 2,
      faction_impact: {}
    };
  } else if (!hasTimePassChoice) {
    injectedChoice = {
      text: 'Profiter du trajet pour observer, planifier la suite et laisser le temps avancer.',
      attribute: 'survival',
      difficulty: 1,
      faction_impact: {}
    };
  }

  if (!injectedChoice) return chapter;

  const dedup = new Set(choices.map(choice => choice.text.trim().toLowerCase()));
  if (dedup.has(injectedChoice.text.trim().toLowerCase())) return chapter;

  if (choices.length >= 4) {
    const replaceIndex = choices.findIndex(choice =>
      choice.attribute === 'combat' ||
      choice.attribute === 'force' ||
      ACTION_HEAVY_CHOICE_REGEX.test(choice.text)
    );
    const targetIndex = replaceIndex >= 0 ? replaceIndex : choices.length - 1;
    choices[targetIndex] = injectedChoice;
  } else {
    choices.push(injectedChoice);
  }

  return {
    ...preparedChapter,
    choices: normalizeChoiceFormatting(choices)
  };
}

export function textToParagraphs(text: string): string[] {
  return splitNarrativeParagraphs(text).map(item => item.text);
}
