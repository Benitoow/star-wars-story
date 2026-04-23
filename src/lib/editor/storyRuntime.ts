import type {
  BackgroundWorldEvent,
  ChatMessage,
  StoryChapter,
  WorldState
} from '$lib/ai/storyEngine';
import { normalizeStoryGenerationMode, summarizeChapterForPrompt } from '$lib/ai/storyEngine';
import type { StorySetup } from '$lib/stores/editor';
import type { LoggedBackgroundEvent } from './interactiveSession';
import { planDialogueDisplay, sanitizeNarrativeTextForDisplay } from './narrativeGuardrails';
import {
  applyStateUpdateToWorldState,
  isLikelyNpcName,
  normalizeNpcStatus,
  normalizeSearchText
} from './worldStateReducer';
import { ROLES } from './setupCatalog';

const MEMORY_LOW_SIGNAL_RELATION_RE = /^rencontre\s+avec\s+/i;
const MEMORY_TECHNICAL_NOISE_RE = /\[object object\]|(?:^|\b)json\s*[\[{]|"chapter_title"\s*:|"chapter_number"\s*:|"narrative"\s*:|"choices"\s*:|<\|?tool_call\|?>|tool_call|(?:^|\s)call:[a-z_]+\s*\{|passage a ete nettoye automatiquement|sortie technique non lisible|fallback|aborterror|aborted|inexploitable|instable|non bloquant/i;

export const ARCHIVE_TRIGGER_TURN = 30;
export const KEEP_RAW_TURNS = 20;
export const MAX_BACKGROUND_EVENTS = 24;
export const INTENSE_SECTION_TYPES = new Set(['action', 'confrontation']);
const STRUCTURED_JSON_MODE = 'structured-json';

function cleanText(value: unknown, maxLength = 240): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizeMemoryFactValue(value: unknown): string {
  return cleanText(value, 240)
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMemoryNoiseFact(value: unknown): boolean {
  const raw = normalizeMemoryFactValue(value);
  if (!raw) return true;

  const normalized = normalizeSearchText(raw).replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  if (raw.length < 10) return true;

  return (
    MEMORY_LOW_SIGNAL_RELATION_RE.test(normalized) ||
    /^relation\s*:\s*rencontre\s+avec\s+/i.test(normalized) ||
    MEMORY_TECHNICAL_NOISE_RE.test(normalized)
  );
}

function memoryFactDedupKey(value: string): string {
  return normalizeSearchText(value)
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMemoryFacts(values: string[]): string[] {
  const dedup = new Map<string, string>();

  for (const entry of values) {
    const normalizedEntry = normalizeMemoryFactValue(entry);
    if (!normalizedEntry || isMemoryNoiseFact(normalizedEntry)) continue;
    const key = memoryFactDedupKey(normalizedEntry);
    if (!key) continue;
    dedup.set(key, normalizedEntry);
  }

  return Array.from(dedup.values()).slice(-260);
}

export function mergeMemoryFacts(memoryLog: string[], nextFacts: string[]): string[] {
  return normalizeMemoryFacts([...memoryLog, ...nextFacts]);
}

function getRoleLabel(roleId: string): string {
  return ROLES.find(role => role.id === roleId)?.name || roleId;
}

export function buildCanonicalIdentityFacts(setup: StorySetup): string[] {
  const roleLabel = getRoleLabel(setup.role || 'aventurier');
  return [
    `Canon protagoniste: rôle ${roleLabel} (${setup.role || 'inconnu'}).`,
    `Canon protagoniste: faction ${setup.faction || 'indépendant'} · ère ${setup.era || 'inconnue'}.`,
    `Règle canonique: ne pas changer le rang/role (ex: Padawan ≠ Chevalier/Maître) sans validation explicite du joueur.`
  ];
}

export function ensureCanonicalIdentityMemory(memoryLog: string[], setup: StorySetup): string[] {
  return mergeMemoryFacts(memoryLog, buildCanonicalIdentityFacts(setup));
}

export function appendMemoryFromChapter(memoryLog: string[], chapter: StoryChapter): string[] {
  const explicitFacts = [
    ...chapter.memory_updates.relations
      .filter(item => !MEMORY_LOW_SIGNAL_RELATION_RE.test(item))
      .map(item => `Relation: ${item}`),
    ...chapter.memory_updates.places.map(item => `Lieu: ${item}`),
    ...chapter.memory_updates.injuries.map(item => `Blessure: ${item}`),
    ...chapter.memory_updates.resources.map(item => `Ressource: ${item}`),
    ...chapter.memory_updates.notes.map(item => `Note: ${item}`)
  ].filter(fact => fact.length > 10);

  const stateFacts: string[] = [];
  const stateUpdate = chapter.state_update;

  if (stateUpdate?.location) {
    stateFacts.push(`Tour ${chapter.chapter_number}: déplacement vers ${stateUpdate.location} (scène: ${chapter.chapter_title})`);
  }

  if (stateUpdate?.date_advance) {
    stateFacts.push(`Temps avancé: ${stateUpdate.date_advance}`);
  }

  if (stateUpdate?.npcs?.length) {
    const meaningfulNpcs = stateUpdate.npcs
      .filter((npc): npc is NonNullable<typeof stateUpdate.npcs>[number] => Boolean(npc?.name))
      .filter(npc => isLikelyNpcName(npc.name))
      .filter(npc => {
        const affinity = typeof npc.affinity === 'number' ? npc.affinity : 0;
        const status = normalizeNpcStatus(npc.status);
        const note = String(npc.note || '').trim();
        return Boolean(note || npc.faction || Math.abs(affinity) >= 15 || status === 'ally' || status === 'hostile' || status === 'dead');
      })
      .slice(0, 3);

    for (const npc of meaningfulNpcs) {
      const name = String(npc.name || '').trim();
      if (!name) continue;
      const relation = typeof npc.affinity === 'number'
        ? (npc.affinity > 30 ? 'allié' : npc.affinity < -30 ? 'hostile' : 'neutre')
        : (npc.status && npc.status !== 'unknown' ? npc.status : 'neutre');
      const note = String(npc.note || '').trim();
      stateFacts.push(`PNJ ${name} (${relation}${note ? ` — ${note}` : ''})`);
    }
  }

  if (stateUpdate?.factions) {
    const factionFacts = Object.entries(stateUpdate.factions)
      .filter(([, delta]) => delta !== 0)
      .slice(0, 4)
      .map(([id, delta]) => `${id}:${delta > 0 ? '+' : ''}${delta}`);
    if (factionFacts.length) stateFacts.push(`Réputation: ${factionFacts.join(', ')}`);
  }

  if (stateUpdate?.injuries_new?.length) {
    for (const injury of stateUpdate.injuries_new.slice(0, 3)) {
      stateFacts.push(`Blessure reçue [${injury.severity}]: ${injury.description}`);
    }
  }

  if (stateUpdate?.injuries_resolved?.length) {
    stateFacts.push(`Blessures résolues: ${stateUpdate.injuries_resolved.slice(0, 3).join(', ')}`);
  }

  if (stateUpdate?.inventory_gained?.length) {
    stateFacts.push(`Obtenu: ${stateUpdate.inventory_gained.slice(0, 3).map(item => item.qty > 1 ? `${item.qty}× ${item.name}` : item.name).join(', ')}`);
  }

  const mergedFacts = [...explicitFacts, ...stateFacts.filter(fact => fact.length > 10)];
  const narrativeSnippet = sanitizeNarrativeTextForDisplay(
    chapter.narrative.action || chapter.narrative.context || chapter.narrative.dialogue || ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  if (narrativeSnippet) {
    mergedFacts.unshift(`Tour ${chapter.chapter_number}: ${chapter.chapter_title} — ${narrativeSnippet}`);
  }

  if (!mergedFacts.length && narrativeSnippet) {
    mergedFacts.push(`Tour ${chapter.chapter_number}: ${chapter.chapter_title} — ${narrativeSnippet}`);
  }

  return mergeMemoryFacts(memoryLog, mergedFacts);
}

export function archiveOldTurnsIfNeeded(
  chapterHistory: StoryChapter[],
  aiMessages: ChatMessage[],
  campaignArchive: string[]
): { aiMessages: ChatMessage[]; campaignArchive: string[] } {
  const archiveCount = Math.max(0, chapterHistory.length - KEEP_RAW_TURNS);
  if (chapterHistory.length <= ARCHIVE_TRIGGER_TURN || archiveCount <= campaignArchive.length) {
    return { aiMessages, campaignArchive };
  }

  const newlyOld = chapterHistory.slice(campaignArchive.length, archiveCount);
  const nextArchive = newlyOld.length
    ? [...campaignArchive, ...newlyOld.map(chapter => summarizeChapterForPrompt(chapter))]
    : campaignArchive;

  const systemMessage = aiMessages.find(message => message.role === 'system');
  const otherMessages = aiMessages.filter(message => message.role !== 'system');
  const nextAiMessages = otherMessages.length > KEEP_RAW_TURNS * 2
    ? (systemMessage
      ? [systemMessage, ...otherMessages.slice(-(KEEP_RAW_TURNS * 2))]
      : otherMessages.slice(-(KEEP_RAW_TURNS * 2)))
    : aiMessages;

  return {
    aiMessages: nextAiMessages,
    campaignArchive: nextArchive
  };
}

export function backgroundEventToSyntheticChapter(event: BackgroundWorldEvent, turn: number): StoryChapter {
  return {
    chapter_title: event.title || 'Mouvement de la galaxie',
    chapter_number: turn,
    section_type: 'background',
    narrative: {
      context: '',
      action: event.summary_public || '',
      dialogue: '',
      reflection: '',
      atmosphere: 'tense'
    },
    choices: [],
    memory_updates: event.memory_updates,
    scene_description: 'Off-screen galactic world event',
    user_edits_applied: null,
    state_update: event.state_update
  };
}

export function appendMemoryFromBackgroundEvent(memoryLog: string[], event: BackgroundWorldEvent, turn: number): string[] {
  const explicitFacts = [
    ...event.memory_updates.relations.map(item => `Relation (off-screen): ${item}`),
    ...event.memory_updates.places.map(item => `Lieu (off-screen): ${item}`),
    ...event.memory_updates.injuries.map(item => `Blessure (off-screen): ${item}`),
    ...event.memory_updates.resources.map(item => `Ressource (off-screen): ${item}`),
    ...event.memory_updates.notes.map(item => `Note (off-screen): ${item}`)
  ];

  const summary = event.summary_private || event.summary_public;
  const syntheticFacts = [
    summary ? `Tour ${turn} (galaxie): ${summary}` : '',
    event.prompt_hook ? `Hook MJ: ${event.prompt_hook}` : ''
  ];

  return mergeMemoryFacts(memoryLog, [...explicitFacts, ...syntheticFacts]);
}

export function createBackgroundEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `bg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toLoggedBackgroundEvent(event: BackgroundWorldEvent, turn: number): LoggedBackgroundEvent {
  const summary = event.summary_public || event.summary_private || event.prompt_hook || event.title || 'Mouvement hors écran';
  return {
    id: createBackgroundEventId(),
    turn,
    title: event.title || 'Mouvement de la galaxie',
    summary,
    promptHook: event.prompt_hook,
    privateSummary: event.summary_private,
    visibleNow: event.inject_now
  };
}

export function applyBackgroundWorldEventToRuntime(
  worldState: WorldState,
  memoryLog: string[],
  backgroundEvents: LoggedBackgroundEvent[],
  event: BackgroundWorldEvent,
  turn: number
): {
  worldState: WorldState;
  memoryLog: string[];
  backgroundEvents: LoggedBackgroundEvent[];
  loggedEvent: LoggedBackgroundEvent;
} {
  const nextWorldState = event.state_update
    ? applyStateUpdateToWorldState(worldState, backgroundEventToSyntheticChapter(event, turn))
    : worldState;

  const nextMemoryLog = appendMemoryFromBackgroundEvent(memoryLog, event, turn);
  const loggedEvent = toLoggedBackgroundEvent(event, turn);

  return {
    worldState: nextWorldState,
    memoryLog: nextMemoryLog,
    backgroundEvents: [loggedEvent, ...backgroundEvents].slice(0, MAX_BACKGROUND_EVENTS),
    loggedEvent
  };
}

export function getVisibleBackgroundEvents(events: LoggedBackgroundEvent[]): LoggedBackgroundEvent[] {
  return events.filter(event => event.visibleNow !== false);
}

export function buildAssistantTranscript(chapter: StoryChapter): string {
  const display = planDialogueDisplay(chapter);
  const narrative = [
    chapter.narrative.context,
    ...display.actionParagraphs.map(paragraph => paragraph.text),
    ...display.dialogueParagraphs.map(paragraph => paragraph.text),
    chapter.narrative.reflection
  ]
    .map(item => cleanText(item, 2400))
    .filter(Boolean)
    .join('\n\n');

  const choices = chapter.choices.length
    ? chapter.choices.map((choice, index) => `${index + 1}. ${choice.text}`).join('\n')
    : '';

  return [
    chapter.chapter_title ? `# ${chapter.chapter_title}` : '',
    narrative,
    choices ? `Choix:\n${choices}` : ''
  ].filter(Boolean).join('\n\n');
}

export function buildStoredAssistantContent(
  chapter: StoryChapter,
  runtimeMode: string | null | undefined,
  rawResponse?: string | null
): string {
  if (normalizeStoryGenerationMode(runtimeMode) === STRUCTURED_JSON_MODE) {
    return cleanText(rawResponse, 24000) || JSON.stringify(chapter);
  }

  return buildAssistantTranscript(chapter);
}

export function describeStoryOrchestration(runtimeMode: string | null | undefined): {
  isSubagentOrchestration: boolean;
  summaryLabel: string;
  chipTag: string;
  chipTitle: string;
} {
  if (normalizeStoryGenerationMode(runtimeMode) === STRUCTURED_JSON_MODE) {
    return {
      isSubagentOrchestration: false,
      summaryLabel: 'sortie JSON directe',
      chipTag: 'JSON',
      chipTitle: 'Dernier tour généré en sortie JSON directe'
    };
  }

  return {
    isSubagentOrchestration: true,
    summaryLabel: 'orchestration à sous-agents',
    chipTag: '4A',
    chipTitle: 'Dernier tour généré via orchestration à quatre sous-agents'
  };
}
