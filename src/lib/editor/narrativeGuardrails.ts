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

export function sanitizeNarrativeTextForDisplay(text: string): string {
  const raw = String(text || '').replace(/\r/g, '\n');
  if (!raw.trim()) return '';

  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && /"[A-Za-z0-9_-]+"\s*:/.test(trimmed)) {
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

    buffer.push(normalized.replace(/\s{2,}/g, ' '));
  }

  flush();
  if (paragraphs.length) return paragraphs.join('\n\n').trim();

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
  if (!chapterLooksLikeTransition(chapter)) return chapter;

  const choices = [...chapter.choices];
  if (!choices.length) return chapter;

  const hasDialogueChoice = choices.some(choice => DIALOGUE_CHOICE_REGEX.test(choice.text));
  const hasTimePassChoice = choices.some(choice => TIME_PASS_CHOICE_REGEX.test(choice.text));

  const nearbyNpcs = getNearbyNpcNames(chapter, worldState);
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
    ...chapter,
    choices
  };
}

export function textToParagraphs(text: string): string[] {
  return String(text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}
