export type StoryAttribute = 'combat' | 'diplomacy' | 'stealth' | 'tech' | 'force' | 'survival';

export interface StoryChoice {
  text: string;
  attribute: StoryAttribute;
  difficulty: number;
  faction_impact: Record<string, number>;
}

export interface StoryMemoryUpdates {
  relations: string[];
  places: string[];
  injuries: string[];
  resources: string[];
  notes: string[];
}

export interface StoryNarrative {
  context: string;
  action: string;
  dialogue: string;
  reflection: string;
  atmosphere: string;
}

// ── Living World State ─────────────────────────────────

export interface PlayerState {
  hp: number;         // 0–100
  credits: number;
  location: string;
  date: string;       // narrative in-universe date
  injuries: { description: string; severity: 'light' | 'moderate' | 'severe' }[];
  inventory: { name: string; qty: number }[];
}

export interface NpcRelation {
  name: string;
  affinity: number;   // -100 (hostile) to 100 (loyal)
  status: 'ally' | 'neutral' | 'hostile' | 'dead' | 'unknown';
  faction?: string;
  last_seen?: string;
  alive: boolean;
  note?: string;
}

export interface ChronologyEntry {
  chapter: number;
  date: string;
  location: string;
  summary: string;
}

export interface WorldState {
  player: PlayerState;
  npcs: NpcRelation[];
  factions: Record<string, number>;  // faction_id → -100..100
  chronology: ChronologyEntry[];
}

export interface StateUpdate {
  hp?: number;            // delta (positive = heal, negative = damage)
  credits?: number;       // delta
  location?: string;      // replaces current location
  date_advance?: string;  // e.g. "quelques heures", "2 jours"
  npcs?: Array<Partial<NpcRelation> & { name: string }>;  // upsert by name
  factions?: Record<string, number>;  // faction_id → delta
  injuries_new?: { description: string; severity: 'light' | 'moderate' | 'severe' }[];
  injuries_resolved?: string[];       // partial match on description
  inventory_gained?: { name: string; qty: number }[];
  inventory_lost?: { name: string; qty: number }[];
  gm_note?: string;  // private GM note (not shown to player)
}

export interface StoryChapter {
  chapter_title: string;
  chapter_number: number;
  section_type: string;
  narrative: StoryNarrative;
  choices: StoryChoice[];
  memory_updates: StoryMemoryUpdates;
  scene_description: string;
  user_edits_applied: string | null;
  state_update?: StateUpdate;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StoryProviderConfig {
  providerId: string;
  model: string;
  apiKey?: string;
  ollamaUrl?: string;
}

export type StoryPromptMode = 'json' | 'tool-calls';

export interface StoryTurnGenerationResult {
  chapter: StoryChapter;
  rawResponse: string;
  mode: 'structured-json' | 'agentic-tools';
  steps: number;
  toolCalls: number;
}

export interface BackgroundWorldEvent {
  title: string;
  summary_public: string;
  summary_private?: string;
  inject_now: boolean;
  memory_updates: StoryMemoryUpdates;
  state_update?: StateUpdate;
  prompt_hook?: string;
}

export interface BackgroundWorldInput {
  setup: StorySetupSnapshot;
  worldState?: WorldState;
  memoryFacts: string[];
  recentSummary: string[];
  recentBackgroundEvents?: Array<{ title: string; summary: string }>;
  turnNumber: number;
}

export interface BackgroundWorldGenerationResult {
  event: BackgroundWorldEvent | null;
  rawResponse: string;
  mode: 'structured-json' | 'agentic-tools';
  steps: number;
  toolCalls: number;
}

export interface StorySetupSnapshot {
  era: string;
  faction: string;
  role: string;
  premise: string;
  protagonistFirstName?: string;
  protagonistLastName?: string;
  protagonistAvatar?: string;
  writingStyle?: string;
  writingTone?: string;
  writingPov?: string;
  writingLength?: string;
  contentMode?: string;
}

const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  grok: 'https://api.x.ai/v1'
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'google/gemma-4-26b-a4b-it',
  openai: 'gpt-5.4-mini',
  anthropic: 'claude-sonnet-4-5',
  mistral: 'mistral-medium-3',
  grok: 'grok-3-mini-beta',
  ollama: 'qwen3.5'
};

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

const NARRATIVE_CHOICE_MARKERS: RegExp[] = [
  /^(?:que faites-vous|what do you do|choices?|choix|options?|vos choix)\b[:!?]?\s*$/i,
  /^(?:comment réagissez-vous|how do you respond|next actions?)\b[:!?]?\s*$/i
];

function sanitizeNarrativeText(value: unknown, maxLength = 2200): string {
  const text = cleanText(value, maxLength);
  if (!text) return '';

  const trimmed = text.trim();
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && /"[A-Za-z0-9_\-]+"\s*:/.test(trimmed)) {
    return 'Le passage a été nettoyé automatiquement pour éviter un affichage technique.';
  }

  const lines = text.split('\n');
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

    if (NARRATIVE_CHOICE_MARKERS.some(pattern => pattern.test(normalized))) {
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

  return text ? 'Le passage a été nettoyé automatiquement pour éviter un affichage technique.' : '';
}

function normalizeTextForPrompt(value: unknown): string {
  return cleanText(value, 2000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function uniqueStrings(values: unknown, max = 10): string[] {
  const list = Array.isArray(values) ? values : [];
  const cleaned = list
    .map(item => cleanText(item, 120))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, max);
}

function normalizeAttribute(rawAttribute: unknown): StoryAttribute {
  const attr = String(rawAttribute || '').trim().toLowerCase();
  const allowed: StoryAttribute[] = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'];
  return allowed.includes(attr as StoryAttribute) ? (attr as StoryAttribute) : 'survival';
}

function inferAttributeFromChoiceText(text: string): StoryAttribute {
  const normalized = normalizeTextForPrompt(text);

  if (/(force|jedi|sith|sabre|telekin|telekinesis|ancrer|canalis|pressent|intuition|prévoir|prevoir)/.test(normalized)) {
    return 'force';
  }

  if (/(parler|dialogue|négocier|negocier|convainc|persuad|bluff|marchand|questionn|interrog|discut|intim|menac|coopér|cooper)/.test(normalized)) {
    return 'diplomacy';
  }

  if (/(discret|furtif|ombre|camouf|infiltr|se faufiler|se glisser|silenc|subreptic|contourner|éviter|eviter|fuite|fuir|évasion|evasion)/.test(normalized)) {
    return 'stealth';
  }

  if (/(hack|pirat|terminal|code|syst[eè]me|verrou|droid|ordinateur|techn|désactiv|desactiv|recalibr)/.test(normalized)) {
    return 'tech';
  }

  if (/(combat|attaqu|assaut|duel|blaster|tir|fonc|briser|neutralis|élimin|elim|ripost|battre|frapp)/.test(normalized)) {
    return 'combat';
  }

  if (/(surviv|explor|observer|repl|route|chemin|patrouill|travers|march|attend|patient|prépar|prepar|échapper|echapper)/.test(normalized)) {
    return 'survival';
  }

  return 'survival';
}

function normalizeChoice(choice: unknown): StoryChoice | null {
  if (!choice) return null;

  if (typeof choice === 'string') {
    const text = cleanText(choice, 220);
    if (!text) return null;
    return {
      text,
      attribute: inferAttributeFromChoiceText(text),
      difficulty: 2,
      faction_impact: {}
    };
  }

  if (typeof choice !== 'object') return null;

  const record = choice as Record<string, unknown>;
  const text = cleanText(record.text, 220);
  if (!text) return null;

  const difficultyNumber = Number(record.difficulty);
  const difficulty = Number.isFinite(difficultyNumber)
    ? Math.max(1, Math.min(5, Math.round(difficultyNumber)))
    : 2;

  const factionImpactSource = record.faction_impact;
  const factionImpact: Record<string, number> = {};
  if (factionImpactSource && typeof factionImpactSource === 'object' && !Array.isArray(factionImpactSource)) {
    for (const [key, value] of Object.entries(factionImpactSource)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        factionImpact[key] = numeric;
      }
    }
  }

  return {
    text,
    attribute: normalizeAttribute(record.attribute) !== 'survival' || !text
      ? normalizeAttribute(record.attribute)
      : inferAttributeFromChoiceText(text),
    difficulty,
    faction_impact: factionImpact
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const FALLBACK_CHOICE_TEMPLATES: Record<StoryAttribute, string[]> = {
  stealth: [
    'Contourner les patrouilles discrètement {hint} pour trouver un angle mort.',
    'Observer les routines ennemies {hint} avant de s\'engager.',
    'Se fondre dans l\'environnement {hint} pour repérer une ouverture.'
  ],
  diplomacy: [
    'Engager calmement le dialogue {hint} pour obtenir des informations.',
    'Tenter une négociation mesurée {hint} afin d\'éviter l\'escalade.',
    'Questionner les personnes présentes {hint} pour clarifier les enjeux.'
  ],
  combat: [
    'Prendre l\'initiative avec une manœuvre offensive contrôlée {hint}.',
    'Lancer une action rapide pour briser l\'avantage adverse {hint}.',
    'Forcer le passage par une percée tactique {hint}.'
  ],
  tech: [
    'Exploiter la technologie locale {hint} pour obtenir un avantage tactique.',
    'Pirater les systèmes disponibles {hint} pour brouiller la surveillance.',
    'Analyser les signaux et verrouillages {hint} pour créer une faille.'
  ],
  force: [
    'S\'ancrer dans la Force {hint} pour anticiper le danger immédiat.',
    'Utiliser la perception de la Force {hint} pour choisir la meilleure fenêtre.',
    'Canaliser la Force {hint} afin de renverser le rapport de force.'
  ],
  survival: [
    'Se repositionner prudemment {hint} pour préserver santé et ressources.',
    'Sécuriser une route de repli {hint} avant toute prise de risque.',
    'Stabiliser la situation {hint} puis préparer une action plus sûre.'
  ]
};

function inferFallbackChoiceHint(seedText: string): string {
  const text = normalizeTextForPrompt(seedText);
  if (/(hangar|dock|quai|spatioport|vaisseau|croiseur)/.test(text)) return 'dans les zones d\'arrimage';
  if (/(cantina|bar|taverne|club|salle commune)/.test(text)) return 'au milieu de la foule';
  if (/(base|poste|avant-poste|bunker|forteresse)/.test(text)) return 'dans le périmètre sécurisé';
  if (/(desert|dune|tempete|jungle|foret|marais|glace|neige)/.test(text)) return 'sur ce terrain hostile';
  if (/(secteur|blocus|verrouillage|patrouille|checkpoint)/.test(text)) return 'dans ce secteur sous tension';
  return 'dans la zone actuelle';
}

function chooseFallbackThirdAttribute(seedText: string, sectionType: string): StoryAttribute {
  const text = normalizeTextForPrompt(`${seedText} ${sectionType}`);
  if (/(force|jedi|sith|kyber|holocron)/.test(text)) return 'force';
  if (/(terminal|console|droid|pirat|reseau|système|systeme|chiffre|code)/.test(text)) return 'tech';
  if (/(action|confrontation|tension|combat|assaut|embuscade|blaster|duel|tir)/.test(text)) return 'combat';
  return 'survival';
}

function fallbackDifficulty(seed: number, offset: number): number {
  return Math.max(1, Math.min(5, 2 + ((seed + offset) % 3)));
}

function defaultChoices(seedText = '', turnNumber = 1, sectionType = ''): StoryChoice[] {
  const normalizedSeed = cleanText(`${seedText}|${sectionType}|${turnNumber}`, 1200);
  const seed = stableHash(normalizedSeed || String(turnNumber));
  const hint = inferFallbackChoiceHint(seedText);

  const attributes: StoryAttribute[] = [
    'stealth',
    'diplomacy',
    chooseFallbackThirdAttribute(seedText, sectionType)
  ];

  const generated = attributes.map((attribute, index) => {
    const templates = FALLBACK_CHOICE_TEMPLATES[attribute];
    const template = templates[(seed + turnNumber + index) % templates.length];

    return {
      text: cleanText(template.replace('{hint}', hint), 220),
      attribute,
      difficulty: fallbackDifficulty(seed, index),
      faction_impact: {}
    } satisfies StoryChoice;
  });

  return dedupeChoices(generated);
}

function defaultMemoryUpdates(): StoryMemoryUpdates {
  return {
    relations: [],
    places: [],
    injuries: [],
    resources: [],
    notes: []
  };
}

function defaultNarrativeFromRaw(rawText: string): StoryNarrative {
  return {
    context: '',
    action: sanitizeNarrativeText(rawText, 2200),
    dialogue: '',
    reflection: '',
    atmosphere: 'tense'
  };
}

function isDiagnosticFallbackText(rawText: string): boolean {
  const text = cleanText(rawText, 320).toLowerCase();
  return [
    'temps imparti',
    'fallback',
    'non bloquant',
    'aborted',
    'aborterror',
    'inexploitable',
    'instable',
    'erreur',
    'secours',
    'bloquer'
  ].some(token => text.includes(token));
}

function buildEmergencyFallbackSeed(turnNumber: number): string {
  if (turnNumber <= 1) {
    return `La baie d'embarquement s'illumine sous des néons fatigués. Quelqu'un approche dans le vacarme des réacteurs, et la première décision est déjà en suspens.`;
  }

  return `La scène repart dans un souffle de fumée et de métal chaud. Les tensions sont toujours là, et le prochain choix peut faire basculer la situation.`;
}

function extractLargestJsonObject(rawText: string): string | null {
  const text = String(rawText || '');
  const chunks: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (!stack.length) start = i;
      stack.push(char);
      continue;
    }

    if (char === '}') {
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
      // try next
    }
  }

  return null;
}

function parseJsonSafely(rawText: string): Record<string, unknown> | null {
  const cleaned = String(rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const largest = extractLargestJsonObject(cleaned);

  if (largest) {
    try {
      const parsed = JSON.parse(largest);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      // fallback below
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function coerceNarrative(source: unknown): StoryNarrative {
  if (!source || typeof source !== 'object') {
    return {
      context: '',
      action: '',
      dialogue: '',
      reflection: '',
      atmosphere: 'tense'
    };
  }

  const data = source as Record<string, unknown>;

  return {
    context: sanitizeNarrativeText(data.context, 1200),
    action: sanitizeNarrativeText(data.action, 5500),
    dialogue: sanitizeNarrativeText(data.dialogue, 1600),
    reflection: sanitizeNarrativeText(data.reflection, 1400),
    atmosphere: cleanText(data.atmosphere, 80) || 'tense'
  };
}

function coerceMemoryUpdates(source: unknown): StoryMemoryUpdates {
  if (!source || typeof source !== 'object') return defaultMemoryUpdates();
  const data = source as Record<string, unknown>;
  return {
    relations: uniqueStrings(data.relations),
    places: uniqueStrings(data.places),
    injuries: uniqueStrings(data.injuries),
    resources: uniqueStrings(data.resources),
    notes: uniqueStrings(data.notes)
  };
}

function coerceStateUpdate(source: unknown): StateUpdate | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const d = source as Record<string, unknown>;

  const update: StateUpdate = {};

  if (typeof d.hp === 'number' && Number.isFinite(d.hp)) update.hp = Math.max(-100, Math.min(100, d.hp));
  if (typeof d.credits === 'number' && Number.isFinite(d.credits)) update.credits = d.credits;
  if (typeof d.location === 'string' && d.location.trim()) update.location = cleanText(d.location, 80);
  if (typeof d.date_advance === 'string' && d.date_advance.trim()) update.date_advance = cleanText(d.date_advance, 60);
  if (typeof d.gm_note === 'string') update.gm_note = cleanText(d.gm_note, 200);

  if (d.factions && typeof d.factions === 'object' && !Array.isArray(d.factions)) {
    const fmap: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.factions as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) fmap[k] = Math.max(-50, Math.min(50, n));
    }
    if (Object.keys(fmap).length) update.factions = fmap;
  }

  if (Array.isArray(d.npcs)) {
    const npcs = d.npcs
      .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
      .map(n => {
        const name = cleanText(n.name, 60);
        if (!name) return null;
        const entry: Partial<NpcRelation> & { name: string } = { name };
        if (typeof n.affinity === 'number') entry.affinity = Math.max(-100, Math.min(100, n.affinity));
        if (['ally','neutral','hostile','dead','unknown'].includes(String(n.status))) entry.status = n.status as NpcRelation['status'];
        if (typeof n.faction === 'string') entry.faction = cleanText(n.faction, 40);
        if (typeof n.last_seen === 'string') entry.last_seen = cleanText(n.last_seen, 60);
        if (typeof n.alive === 'boolean') entry.alive = n.alive;
        if (typeof n.note === 'string') entry.note = cleanText(n.note, 120);
        return entry;
      })
      .filter((n): n is Partial<NpcRelation> & { name: string } => n !== null);
    if (npcs.length) update.npcs = npcs;
  }

  if (Array.isArray(d.injuries_new)) {
    update.injuries_new = d.injuries_new
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map(i => ({
        description: cleanText(i.description, 100),
        severity: (['light','moderate','severe'].includes(String(i.severity)) ? i.severity : 'light') as 'light'|'moderate'|'severe'
      }))
      .filter(i => i.description);
  }

  if (Array.isArray(d.injuries_resolved)) update.injuries_resolved = uniqueStrings(d.injuries_resolved, 10);

  if (Array.isArray(d.inventory_gained)) {
    update.inventory_gained = d.inventory_gained
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map(i => ({ name: cleanText(i.name, 60), qty: Math.max(1, Number(i.qty) || 1) }))
      .filter(i => i.name);
  }

  if (Array.isArray(d.inventory_lost)) {
    update.inventory_lost = d.inventory_lost
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map(i => ({ name: cleanText(i.name, 60), qty: Math.max(1, Number(i.qty) || 1) }))
      .filter(i => i.name);
  }

  return Object.keys(update).length ? update : undefined;
}

function extractChoices(source: unknown): StoryChoice[] {
  const list = Array.isArray(source) ? source : [];
  const normalized = list
    .map(item => normalizeChoice(item))
    .filter((item): item is StoryChoice => Boolean(item));

  const dedup = Array.from(new Map(normalized.map(choice => [choice.text.toLowerCase(), choice])).values());

  return dedup.slice(0, 4);
}

function fallbackChapter(rawText: string, turnNumber: number): StoryChapter {
  const visibleSeed = isDiagnosticFallbackText(rawText)
    ? buildEmergencyFallbackSeed(turnNumber)
    : rawText;

  return {
    chapter_title: turnNumber === 1 ? 'Prologue' : `Tour ${turnNumber}`,
    chapter_number: turnNumber,
    section_type: 'action',
    narrative: defaultNarrativeFromRaw(visibleSeed || `Le modèle n'a pas renvoyé de JSON exploitable.`),
    choices: defaultChoices(visibleSeed, turnNumber, 'action'),
    memory_updates: defaultMemoryUpdates(),
    scene_description: 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: null
  };
}

export function parseStoryResponse(rawText: string, turnNumber: number): StoryChapter {
  const parsed = parseJsonSafely(rawText);
  if (!parsed) return fallbackChapter(rawText, turnNumber);

  const chapterNumberRaw = Number(parsed.chapter_number);
  const chapterNumber = Number.isFinite(chapterNumberRaw) ? chapterNumberRaw : turnNumber;
  const chapterTitle = cleanText(parsed.chapter_title, 80) || (chapterNumber <= 1 ? 'Prologue' : `Tour ${chapterNumber}`);
  const sectionType = cleanText(parsed.section_type, 40) || 'action';

  const narrative = coerceNarrative(parsed.narrative);
  if (!narrative.action) {
    const candidate = sanitizeNarrativeText(parsed.action, 2200);
    const rawFallback = sanitizeNarrativeText(rawText, 2200);
    const isJson = (t: string) => /^\s*[{[]/.test(t);
    // Never inject raw JSON as narrative text
    narrative.action = (candidate && !isJson(candidate))
      ? candidate
      : (!isJson(rawFallback) ? rawFallback : '');
  }

  const choices = extractChoices(parsed.choices);
  const fallbackChoiceSeed = [
    chapterTitle,
    narrative.context,
    narrative.action,
    narrative.dialogue,
    narrative.reflection
  ].join('\n');
  const safeChoices = choices.length ? choices : defaultChoices(fallbackChoiceSeed, chapterNumber, sectionType);

  return {
    chapter_title: chapterTitle,
    chapter_number: chapterNumber,
    section_type: sectionType,
    narrative,
    choices: safeChoices,
    memory_updates: coerceMemoryUpdates(parsed.memory_updates),
    scene_description: cleanText(parsed.scene_description, 160) || 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: cleanText(parsed.user_edits_applied, 180) || null,
    state_update: coerceStateUpdate(parsed.state_update)
  };
}

export function buildSystemPrompt(
  setup: StorySetupSnapshot,
  memoryFacts: string[],
  worldState?: WorldState,
  promptMode: StoryPromptMode = 'json',
  turnNumber = 1,
  campaignArchive: string[] = []
): string {
  const protagonist = [setup.protagonistFirstName || '', setup.protagonistLastName || ''].join(' ').trim() || 'Le protagoniste';

  // ── World state block ─────────────────────────
  let worldBlock = '';
  if (worldState) {
    const p = worldState.player;
    const hpLabel = p.hp >= 80 ? 'en forme' : p.hp >= 50 ? 'légèrement blessé' : p.hp >= 20 ? 'blessé' : 'état critique';
    const injuryLines = p.injuries.length
      ? p.injuries.map(i => `  • ${i.description} [${i.severity}]`).join('\n')
      : '  (aucune)';
    const inventoryLines = p.inventory.length
      ? p.inventory.map(i => `  • ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join('\n')
      : '  (rien de notable)';
    const npcLines = worldState.npcs.length
      ? worldState.npcs
          .filter(n => n.alive !== false)
          .map(n => {
            const aff = n.affinity > 30 ? '★ allié' : n.affinity < -30 ? '✖ hostile' : '~ neutre';
            return `  • ${n.name} [${aff}${n.faction ? `, ${n.faction}` : ''}]${n.note ? ` — ${n.note}` : ''}`;
          })
          .join('\n')
      : '  (aucun PNJ connu)';
    const deadNpcs = worldState.npcs.filter(n => n.alive === false);
    const deadLines = deadNpcs.length ? `\nMorts: ${deadNpcs.map(n => n.name).join(', ')}` : '';
    const factionLines = Object.entries(worldState.factions)
      .sort(([,a],[,b]) => b - a)
      .map(([id, score]) => `  • ${id}: ${score > 0 ? '+' : ''}${score}`)
      .join('\n') || '  (neutre partout)';

    worldBlock = `
ÉTAT DU MONDE ACTUEL:
Protagoniste: ${protagonist}
HP: ${p.hp}/100 (${hpLabel}) | Crédits: ₡${p.credits}
Lieu: ${p.location} | Date narrative: ${p.date}
Blessures actives:
${injuryLines}
Inventaire notable:
${inventoryLines}
PNJs connus:
${npcLines}${deadLines}
Réputation par faction:
${factionLines}`;
  }

  // ── Memory block ──────────────────────────────
  const memoryContext = memoryFacts.length
    ? `\nMÉMOIRE NARRATIVE (faits établis):\n${memoryFacts.map(item => `- ${item}`).join('\n')}`
    : '';

  const campaignArchiveContext = campaignArchive.length
    ? `\nRÉSUMÉ DE CAMPAGNE (tours anciens condensés):\n${campaignArchive.map(item => `- ${cleanText(item, 260)}`).join('\n')}`
    : '';

  const basePrompt = `Tu es un Maître du Jeu Star Wars d'élite. Tu écris avec précision et cinéma — chaque ligne doit créer tension, émotion ou révélation. Zéro remplissage.

Protagoniste: ${protagonist} | Ère: ${setup.era} | Faction: ${setup.faction} | Rôle: ${setup.role}
Prémisse: ${setup.premise || 'Libre'}
Style: ${setup.writingStyle || 'cinématique'} · Ton: ${setup.writingTone || 'aventure'} · POV: ${setup.writingPov || 'première personne'} · Longueur: ${setup.writingLength || 'moyen'} · Contenu: ${setup.contentMode || 'cinematic'}
${worldBlock}${memoryContext}${campaignArchiveContext}
RÈGLES MJ:
1. Coûts réels: blessure → hp négatif, dépense → credits négatif, échec → conséquence concrète.
2. PNJs autonomes: agendas cachés, mémoire des événements, évolution propre — ils agissent pour eux, pas pour servir le joueur.
3. Rythme: après 2 scènes intenses (action/confrontation), la suivante DOIT être repos/dialogue/exploration.
4. Deltas: hp et credits = TOUJOURS des deltas signés. hp:-15=perd 15PV, credits:500=reçoit 500. JAMAIS un total absolu.
5. Titre: chapter_title = titre de scène évocateur uniquement. INTERDIT d'y mettre un numéro ou "Chapitre N".
6. NPCs: si un inconnu révèle son nom → mettre à jour l'entrée existante, jamais de doublon.
7. Résumé de campagne: s'il est présent, il représente la continuité condensée des tours anciens — prends-le en compte sans le répéter mot à mot.`;
  const narrativeProseRule = `
8. PROSE UNIQUEMENT dans "narrative.action": pas de markdown, pas de titres H1/H2, pas de listes numérotées, pas de bloc "Que faites-vous ?", pas de répétition des choix. Les choix vivent uniquement dans le tableau "choices".`;

  const jsonContract = `Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour. Priorité absolue: prose narrative riche dans "action" (2-4 paragraphes). Remplis state_update avec toutes les conséquences.

{
  "chapter_title": "Titre de scène évocateur — jamais Chapitre N",
  "chapter_number": ${turnNumber},
  "section_type": "action|dialogue|exploration|tension|revelation|repos|interlude|confrontation",
  "narrative": {
    "action": "Prose principale — ce qui se passe, sensations, tensions, atmosphere — 2 à 4 paragraphes vivants et précis",
    "dialogue": "Échanges verbaux marquants (optionnel, laisser vide si peu de dialogue)",
    "reflection": "Pensée interne du protagoniste (optionnel)"
  },
  "choices": [
    { "text": "Action précise et directe, réalisable ici et maintenant dans cette scène", "attribute": "combat|diplomacy|stealth|tech|force|survival", "difficulty": 3, "faction_impact": {} }
  ],
  "state_update": {
    "hp": -15,
    "credits": -300,
    "location": "Nouveau lieu uniquement si le joueur s'est déplacé",
    "npcs": [{ "name": "Nom exact du PNJ", "affinity": 60, "status": "ally|neutral|hostile", "alive": true, "note": "contexte bref" }],
    "factions": { "empire": -10 },
    "injuries_new": [{ "description": "blessure précise", "severity": "light|moderate|severe" }],
    "injuries_resolved": ["fragment de description"],
    "inventory_gained": [{ "name": "objet", "qty": 1 }]
  }
}`;

  const toolCallingContract = `MODE AGENTIQUE — 2 phases distinctes:

PHASE 1 (maintenant): Écris la scène en JSON valide ou en prose libre.
- Aucun outil disponible dans cette phase.
- Priorité absolue: prose narrative vivante, conséquences réelles, PNJs avec mémoire et intentions propres.
- Si JSON: remplis "narrative.action" avec 3-5 paragraphes de prose cinématique.
- Aucun markdown, aucun titre interne et aucun bloc de choix dans "narrative.action".

PHASE 2 (ensuite, automatique): Le système extraira l'état structuré via des outils dédiés.

Tu n'as qu'une seule tâche maintenant: écrire une scène forte.`;

  return `${basePrompt}${narrativeProseRule}\n\n${promptMode === 'tool-calls' ? toolCallingContract : jsonContract}`;
}

const ERA_CONTEXT: Record<string, string> = {
  old_republic: 'Ancienne République — guerres mandaloriennes, Jedi au zénith, Sith encore tapis dans l\'ombre.',
  clone_wars: 'Guerres des Clones — la galaxie se déchire, les Jedi deviennent généraux et Palpatine tisse son plan.',
  imperial: 'Ère Impériale — l\'Empire règne par la peur, les Jedi sont traqués et la Rébellion cherche des alliés.',
  empire: 'Empire galactique — l\'Empire impose son ordre, la surveillance s\'étend et la moindre dissidence devient un risque.',
  new_republic: 'Nouvelle République — l\'Empire s\'effondre, le pouvoir se reconstruit et les menaces de l\'ancien monde persistent.',
  first_order: 'Premier Ordre — la République vacille, la Résistance survit et les vieux fantômes de l\'Empire reviennent.',
  high_republic: 'Haute République — âge d\'or de la galaxie, expansion, exploration et menaces aux confins de l\'espace.'
};

export function buildStartPrompt(
  setup: StorySetupSnapshot,
  selectedTrameLabel?: string | null,
  promptMode: StoryPromptMode = 'json'
): string {
  const firstName = cleanText(setup.protagonistFirstName, 60);
  const lastName = cleanText(setup.protagonistLastName, 60);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'le protagoniste';

  const eraContext = ERA_CONTEXT[setup.era || ''] || 'Galaxie lointaine, très lointaine — une époque de conflits, de choix lourds et de destins qui basculent.';

  const modeHint = promptMode === 'tool-calls'
    ? `\nMode agentique actif: utilise les outils pour poser la scène, matérialiser les conséquences puis finaliser le prologue.`
    : '';

  return `Lance une histoire interactive Star Wars avec un prologue immédiatement jouable.

CADRE D'OUVERTURE:
- Protagoniste: ${displayName}
- Ère: ${setup.era || 'inconnue'} — ${eraContext}
- Faction: ${setup.faction || 'libre'}
- Rôle: ${setup.role || 'aventurier'}
- Trame: ${selectedTrameLabel || 'Libre'}
- Prémisse: ${setup.premise || 'Crée une situation tendue et immédiatement jouable.'}
- Style: ${setup.writingStyle || 'cinématique'}
- Ton: ${setup.writingTone || 'aventure'}
- POV: ${setup.writingPov || 'première personne'}
- Longueur: ${setup.writingLength || 'moyen'}
- Contenu: ${setup.contentMode || 'cinematic'}

EXIGENCES DU PREMIER TOUR:
- Ouvre in medias res, sans préambule explicatif.
- Donne immédiatement une tension claire, un lieu vivant et un objectif.
- Introduis au moins 1 PNJ mémorable avec un agenda distinct.
- Fais émerger un enjeu politique, relationnel ou moral dès l'ouverture.
- Les 3-4 choix doivent être concrets, contrastés et portés par la scène.
- Le texte de scène ne doit contenir ni markdown ni liste de choix.
- chapter_number = 1${modeHint}`;
}

export const SECTION_TYPES = [
  'action',        // combat, poursuite, assaut
  'dialogue',      // conversation, négociation, interrogatoire
  'exploration',   // découverte, voyage, reconnaissance d'un lieu
  'tension',       // montée de danger, planification sous pression
  'revelation',    // coup de théâtre, découverte majeure
  'repos',         // soins, récupération, temps libre
  'interlude',     // moment calme, relation entre personnages, réflexion
  'confrontation'  // face-à-face politique ou verbal intense, pas forcément physique
] as const;

export type SectionType = typeof SECTION_TYPES[number];

const ACTION_HEAVY: SectionType[] = ['action', 'confrontation'];

export function buildContinuePrompt(
  actionText: string,
  turnNumber: number,
  recentSummary: string[],
  promptMode: StoryPromptMode = 'json',
  recentSectionTypes: string[] = [],
  recentChoiceTexts: string[] = [],
  sceneAnchor: string = ''
): string {
  const history = recentSummary.length
    ? `\nRésumé récent:\n${recentSummary.map(item => `- ${item}`).join('\n')}`
    : '';

  // Dedupe choices — large context window means we can afford to remember many
  const recentChoices = Array.from(new Set(
    recentChoiceTexts
      .map(item => cleanText(item, 160))
      .filter(Boolean)
  )).slice(-20);

  const recentChoicesBlock = recentChoices.length
    ? `\nChoix déjà proposés à éviter: ${recentChoices.map(c => `"${c}"`).join(' | ')}`
    : '';

  // Pacing: single-line directive only when strictly needed
  let consecutiveIntense = 0;
  for (let i = recentSectionTypes.length - 1; i >= 0; i--) {
    if (ACTION_HEAVY.includes(recentSectionTypes[i] as SectionType)) consecutiveIntense++;
    else break;
  }
  const pacingDirective = consecutiveIntense >= 2
    ? `\nRYTHME: ${consecutiveIntense} scènes intenses d'affilée — ce tour DOIT être repos, dialogue ou exploration.`
    : '';

  const anchorBlock = sceneAnchor ? `${sceneAnchor}\n\n` : '';

  return `${anchorBlock}Tour ${turnNumber}. Action: "${cleanText(actionText, 280)}".${history}${recentChoicesBlock}${pacingDirective}

Écris une scène forte et précise — conséquences réelles, PNJs avec mémoire et intention propre.
Ne mets aucun markdown, aucun titre interne et aucun bloc de choix dans le récit.
Propose 3-4 choix distincts, concrets, ancrés dans cette scène précise (pas génériques).
chapter_number = ${turnNumber}.`;
}

function getProviderDisplayName(providerId: string): string {
  const names: Record<string, string> = {
    openrouter: 'OpenRouter',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    mistral: 'Mistral',
    grok: 'Grok',
    ollama: 'Ollama',
    none: 'Aucun provider'
  };
  return names[providerId] || providerId;
}

function ensureApiKey(providerId: string, apiKey?: string): void {
  if (providerId === 'ollama') return;
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) {
    throw new Error(`Clé API manquante pour ${getProviderDisplayName(providerId)}.`);
  }
}

function withTimeoutSignal(timeoutMs: number): { controller: AbortController; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cancel: () => clearTimeout(timer)
  };
}

function getOpenAiCompatibleTimeoutMs(caps: ModelCapabilities): number {
  if (caps.tier === 'large') return 90000;
  if (caps.tier === 'medium') return 65000;
  return 50000;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const name = (error as { name?: unknown }).name;
  if (name === 'AbortError') return true;

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && /aborted a request|the operation was aborted|abort/i.test(message);
}

async function parseErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;

  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const nestedError = data.error;
    if (nestedError && typeof nestedError === 'object' && !Array.isArray(nestedError)) {
      const nestedMessage = (nestedError as Record<string, unknown>).message;
      if (nestedMessage) return cleanText(nestedMessage, 240);
    }
    if (data.message) return cleanText(data.message, 240);
  } catch {
    // plain text
  }

  return cleanText(raw, 240);
}

function resolveModel(config: StoryProviderConfig): string {
  const model = cleanText(config.model, 120);
  if (model) return model;
  return DEFAULT_MODELS[config.providerId] || DEFAULT_MODELS.openrouter;
}


// ── Model capability detection ─────────────────────────────────────────────

type ModelTier = 'small' | 'medium' | 'large';
type ReasoningStyle = 'openai-effort' | 'anthropic-thinking' | 'none';

interface ModelCapabilities {
  tier: ModelTier;
  reasoningStyle: ReasoningStyle;
  reasoningEffort: 'low' | 'medium' | 'high';
  supportsNativeTools: boolean;
  maxOutputTokens: number;
  idealTemperature: number;
}

const DEFAULT_CAPS: ModelCapabilities = {
  tier: 'small',
  reasoningStyle: 'none',
  reasoningEffort: 'low',
  supportsNativeTools: false,
  maxOutputTokens: 2000,
  idealTemperature: 0.9
};

// Pattern → partial capabilities override (first match wins)
const MODEL_CAPS_PATTERNS: Array<[RegExp, Partial<ModelCapabilities>]> = [
  // Gemma 3 free — large, but usually too slow/limited for native agentic tools
  [/gemma-3-27b-it:free|gemma-3-27b-it/i, { tier: 'large', reasoningStyle: 'none', reasoningEffort: 'low', supportsNativeTools: false, maxOutputTokens: 2400, idealTemperature: 0.9 }],
  // Gemma 4 — small, reasoning capable
  [/gemma-4/,                { tier: 'small',  reasoningStyle: 'openai-effort',      reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2500, idealTemperature: 1.0 }],
  // GPT-5.4 family
  [/gpt-5\.4-mini/,         { tier: 'small',  reasoningStyle: 'openai-effort',      reasoningEffort: 'low',    supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 1.0 }],
  [/gpt-5\.4/,              { tier: 'medium', reasoningStyle: 'openai-effort',      reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3500, idealTemperature: 1.0 }],
  // Claude Opus 4.x — large, extended thinking
  [/claude-opus-4/,          { tier: 'large',  reasoningStyle: 'anthropic-thinking', reasoningEffort: 'high',   supportsNativeTools: true, maxOutputTokens: 4500, idealTemperature: 1.0 }],
  // Claude Sonnet 4.x — medium, extended thinking
  [/claude-sonnet-4/,        { tier: 'medium', reasoningStyle: 'anthropic-thinking', reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 1.0 }],
  // OpenAI o-series reasoning models
  [/\/o[1-9][-/]|\/o4-mini/, { tier: 'large', reasoningStyle: 'openai-effort',     reasoningEffort: 'high',   supportsNativeTools: true, maxOutputTokens: 4000, idealTemperature: 1.0 }],
  // Grok 3
  [/grok-3-mini/,            { tier: 'small',  reasoningStyle: 'openai-effort',      reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 1.0 }],
  [/grok-3/,                 { tier: 'medium', reasoningStyle: 'openai-effort',      reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 3000, idealTemperature: 1.0 }],
  // Mistral medium/large
  [/mistral-(medium|large)/,  { tier: 'medium', reasoningStyle: 'none',             reasoningEffort: 'low',    supportsNativeTools: true, maxOutputTokens: 2400, idealTemperature: 0.85 }],
  // DeepSeek-R / Qwen thinking variants
  [/deepseek-r|qwen.*think/,  { tier: 'medium', reasoningStyle: 'openai-effort',    reasoningEffort: 'medium', supportsNativeTools: true, maxOutputTokens: 2800, idealTemperature: 1.0 }],
];

function detectModelCapabilities(config: StoryProviderConfig): ModelCapabilities {
  const modelId = resolveModel(config).toLowerCase();
  for (const [pattern, overrides] of MODEL_CAPS_PATTERNS) {
    if (pattern.test(modelId)) {
      return { ...DEFAULT_CAPS, ...overrides };
    }
  }
  return DEFAULT_CAPS;
}

type OpenAiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAiToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
};

function toOpenAiMessageList(messages: ChatMessage[]): OpenAiMessage[] {
  return messages.map(message => ({
    role: message.role,
    content: message.content
  }));
}

async function callOpenAiCompatibleRaw(
  messages: OpenAiMessage[],
  config: StoryProviderConfig,
  options: {
    tools?: OpenAiToolDefinition[];
    toolChoice?: OpenAiToolChoice;
    maxTokens?: number;
    temperature?: number;
    skipReasoning?: boolean;
  } = {}
): Promise<OpenAiMessage> {
  const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[config.providerId];
  if (!baseUrl) throw new Error(`Provider non supporté: ${config.providerId}`);

  ensureApiKey(config.providerId, config.apiKey);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${String(config.apiKey || '').trim()}`,
    'Content-Type': 'application/json'
  };

  if (config.providerId === 'openrouter') {
    const referer = typeof window !== 'undefined' ? window.location.href : 'https://localhost';
    headers['HTTP-Referer'] = referer;
    headers['X-Title'] = 'Star Wars Story Manager';
  }

  const caps = detectModelCapabilities(config);
  const timeoutMs = getOpenAiCompatibleTimeoutMs(caps);
  const body: Record<string, unknown> = {
    model: resolveModel(config),
    messages,
    max_tokens: options.maxTokens ?? caps.maxOutputTokens,
    temperature: options.temperature ?? caps.idealTemperature
  };

  // Inject reasoning for models that support it (OpenRouter / OpenAI-compatible)
  if (caps.reasoningStyle === 'openai-effort' && !options.skipReasoning) {
    body.reasoning = { effort: caps.reasoningEffort };
  }

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? 'auto';
  }

  const { controller, cancel } = withTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(`${getProviderDisplayName(config.providerId)}: ${message}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: OpenAiMessage }>;
    };

    return data.choices?.[0]?.message ?? { role: 'assistant', content: '' };
  } finally {
    cancel();
  }
}

async function callOpenAiCompatible(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  const message = await callOpenAiCompatibleRaw(toOpenAiMessageList(messages), config);
  return cleanText(message.content, 12000);
}

const AGENTIC_TOOL_CALLING_PROVIDERS = new Set<string>(['openrouter', 'openai', 'mistral', 'grok']);
const MAX_AGENTIC_STEPS = 8;

const AGENTIC_GM_TOOLS: OpenAiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'set_scene',
      description: 'Définit la scène narrative (titre, type, blocs narratifs, prompt image).',
      parameters: {
        type: 'object',
        properties: {
          chapter_title: { type: 'string' },
          section_type: { type: 'string', enum: ['action','dialogue','exploration','tension','revelation','repos','interlude','confrontation'], description: 'Type de scène — varie le rythme, jamais 2+ action/confrontation consécutifs' },
          narrative: {
            type: 'object',
            properties: {
              context: { type: 'string' },
              action: { type: 'string' },
              dialogue: { type: 'string' },
              reflection: { type: 'string' },
              atmosphere: { type: 'string' }
            }
          },
          context: { type: 'string' },
          action: { type: 'string' },
          dialogue: { type: 'string' },
          reflection: { type: 'string' },
          atmosphere: { type: 'string' },
          scene_description: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_world',
      description: 'Applique les conséquences mécaniques globales (hp, crédits, inventaire, blessures, date, lieu, etc.).',
      parameters: {
        type: 'object',
        properties: {
          state_update: { type: 'object' },
          hp: { type: 'number' },
          credits: { type: 'number' },
          location: { type: 'string' },
          date_advance: { type: 'string' },
          factions: { type: 'object' },
          npcs: { type: 'array' },
          injuries_new: { type: 'array' },
          injuries_resolved: { type: 'array' },
          inventory_gained: { type: 'array' },
          inventory_lost: { type: 'array' },
          gm_note: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_npc',
      description: 'Met à jour ou crée un PNJ précis (affinité, statut, faction, vivant/mort, note).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          affinity: { type: 'number' },
          status: { type: 'string' },
          faction: { type: 'string' },
          last_seen: { type: 'string' },
          alive: { type: 'boolean' },
          note: { type: 'string' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_faction',
      description: 'Applique un delta de réputation de faction.',
      parameters: {
        type: 'object',
        properties: {
          faction: { type: 'string' },
          delta: { type: 'number' },
          factions: { type: 'object' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_memory',
      description: 'Ajoute des faits persistants en mémoire narrative (relations, lieux, blessures, ressources, notes).',
      parameters: {
        type: 'object',
        properties: {
          memory_updates: { type: 'object' },
          relations: { type: 'array' },
          places: { type: 'array' },
          injuries: { type: 'array' },
          resources: { type: 'array' },
          notes: { type: 'array' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'offer_choices',
      description: 'Propose 3 à 4 choix jouables pour le prochain tour.',
      parameters: {
        type: 'object',
        properties: {
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                attribute: { type: 'string' },
                difficulty: { type: 'number' },
                faction_impact: { type: 'object' }
              },
              required: ['text']
            }
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finalize_turn',
      description: 'Indique que le tour est complet.',
      parameters: {
        type: 'object',
        properties: {
          user_edits_applied: { type: 'string' }
        }
      }
    }
  }
];

const AGENTIC_BACKGROUND_TOOLS: OpenAiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'queue_world_event',
      description: 'Crée ou met à jour un événement hors-écran du monde (injection potentielle au joueur).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary_public: { type: 'string' },
          summary_private: { type: 'string' },
          inject_now: { type: 'boolean' },
          prompt_hook: { type: 'string' },
          memory_updates: { type: 'object' },
          state_update: { type: 'object' },
          hp: { type: 'number' },
          credits: { type: 'number' },
          location: { type: 'string' },
          date_advance: { type: 'string' },
          npcs: { type: 'array' },
          factions: { type: 'object' },
          injuries_new: { type: 'array' },
          injuries_resolved: { type: 'array' },
          inventory_gained: { type: 'array' },
          inventory_lost: { type: 'array' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finalize_background_tick',
      description: 'Termine le tick de monde hors-écran.',
      parameters: {
        type: 'object',
        properties: {
          done: { type: 'boolean' },
          reason: { type: 'string' }
        }
      }
    }
  }
];

type AgenticDraft = {
  chapter_title: string;
  section_type: string;
  narrative: StoryNarrative;
  memory_updates: StoryMemoryUpdates;
  choices: StoryChoice[];
  state_update?: StateUpdate;
  scene_description: string;
  user_edits_applied: string | null;
  done: boolean;
};

type BackgroundEventDraft = {
  event: BackgroundWorldEvent;
  done: boolean;
};

function coerceBackgroundWorldEvent(source: unknown): BackgroundWorldEvent | null {
  if (!isObjectRecord(source)) return null;

  const title = cleanText(source.title ?? source.event_title, 90);
  const summaryPublic = cleanText(source.summary_public ?? source.summary ?? source.event_summary_public, 260);
  const summaryPrivate = cleanText(source.summary_private ?? source.event_summary_private, 420);
  const promptHook = cleanText(source.prompt_hook, 220);

  let injectNow = false;
  if (typeof source.inject_now === 'boolean') {
    injectNow = source.inject_now;
  } else if (typeof source.inject_now === 'string') {
    injectNow = /^(true|yes|1)$/i.test(source.inject_now.trim());
  }

  const memoryUpdates = coerceMemoryUpdates(source.memory_updates ?? source);
  const stateUpdate = coerceStateUpdate(source.state_update ?? source);

  const hasSignal = Boolean(
    title ||
    summaryPublic ||
    summaryPrivate ||
    promptHook ||
    stateUpdate ||
    memoryUpdates.notes.length ||
    memoryUpdates.relations.length ||
    memoryUpdates.places.length ||
    memoryUpdates.injuries.length ||
    memoryUpdates.resources.length
  );

  if (!hasSignal) return null;

  return {
    title: title || 'Mouvement de la galaxie',
    summary_public: summaryPublic,
    summary_private: summaryPrivate || undefined,
    inject_now: injectNow,
    memory_updates: memoryUpdates,
    state_update: stateUpdate,
    prompt_hook: promptHook || undefined
  };
}

function createBackgroundEventDraft(): BackgroundEventDraft {
  return {
    event: {
      title: 'Mouvement de la galaxie',
      summary_public: '',
      summary_private: undefined,
      inject_now: false,
      memory_updates: defaultMemoryUpdates(),
      state_update: undefined,
      prompt_hook: undefined
    },
    done: false
  };
}

function hasBackgroundEventImpact(event: BackgroundWorldEvent | null): boolean {
  if (!event) return false;
  return Boolean(
    event.inject_now ||
    event.summary_public ||
    event.summary_private ||
    event.prompt_hook ||
    event.state_update ||
    event.memory_updates.notes.length ||
    event.memory_updates.relations.length ||
    event.memory_updates.places.length ||
    event.memory_updates.injuries.length ||
    event.memory_updates.resources.length
  );
}

function mergeBackgroundEvent(
  base: BackgroundWorldEvent,
  patch: BackgroundWorldEvent
): BackgroundWorldEvent {
  return {
    title: patch.title || base.title,
    summary_public: patch.summary_public || base.summary_public,
    summary_private: patch.summary_private || base.summary_private,
    inject_now: patch.inject_now || base.inject_now,
    prompt_hook: patch.prompt_hook || base.prompt_hook,
    memory_updates: {
      relations: mergeStringLists(base.memory_updates.relations, patch.memory_updates.relations),
      places: mergeStringLists(base.memory_updates.places, patch.memory_updates.places),
      injuries: mergeStringLists(base.memory_updates.injuries, patch.memory_updates.injuries),
      resources: mergeStringLists(base.memory_updates.resources, patch.memory_updates.resources),
      notes: mergeStringLists(base.memory_updates.notes, patch.memory_updates.notes)
    },
    state_update: mergeStateUpdates(base.state_update, patch.state_update)
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeStringLists(...lists: string[][]): string[] {
  return Array.from(new Set(lists.flatMap(list => list.map(item => cleanText(item, 140)).filter(Boolean))));
}

function mergeInventoryEntries(
  left: { name: string; qty: number }[] = [],
  right: { name: string; qty: number }[] = []
): { name: string; qty: number }[] {
  const index = new Map<string, { name: string; qty: number }>();

  for (const item of [...left, ...right]) {
    const name = cleanText(item.name, 80);
    const qty = Math.max(1, Number(item.qty) || 1);
    if (!name) continue;

    const key = name.toLowerCase();
    const current = index.get(key);
    if (current) {
      current.qty += qty;
    } else {
      index.set(key, { name, qty });
    }
  }

  return Array.from(index.values());
}

function mergeNpcEntries(
  left: Array<Partial<NpcRelation> & { name: string }> = [],
  right: Array<Partial<NpcRelation> & { name: string }> = []
): Array<Partial<NpcRelation> & { name: string }> {
  const index = new Map<string, Partial<NpcRelation> & { name: string }>();

  for (const npc of [...left, ...right]) {
    const name = cleanText(npc.name, 80);
    if (!name) continue;

    const key = name.toLowerCase();
    const current = index.get(key);
    index.set(key, { ...(current || { name }), ...npc, name });
  }

  return Array.from(index.values());
}

function mergeStateUpdates(base: StateUpdate | undefined, patch: StateUpdate | undefined): StateUpdate | undefined {
  if (!base) return patch;
  if (!patch) return base;

  const merged: StateUpdate = {
    ...base,
    ...patch
  };

  if (base.hp !== undefined || patch.hp !== undefined) {
    merged.hp = (base.hp ?? 0) + (patch.hp ?? 0);
  }

  if (base.credits !== undefined || patch.credits !== undefined) {
    merged.credits = (base.credits ?? 0) + (patch.credits ?? 0);
  }

  if (base.factions || patch.factions) {
    const factionIndex: Record<string, number> = {};
    for (const [id, delta] of Object.entries(base.factions ?? {})) factionIndex[id] = delta;
    for (const [id, delta] of Object.entries(patch.factions ?? {})) factionIndex[id] = (factionIndex[id] ?? 0) + delta;
    merged.factions = factionIndex;
  }

  merged.injuries_resolved = mergeStringLists(base.injuries_resolved ?? [], patch.injuries_resolved ?? []);

  merged.injuries_new = [
    ...(base.injuries_new ?? []),
    ...(patch.injuries_new ?? [])
  ].filter(entry => cleanText(entry.description, 120));

  merged.inventory_gained = mergeInventoryEntries(base.inventory_gained, patch.inventory_gained);
  merged.inventory_lost = mergeInventoryEntries(base.inventory_lost, patch.inventory_lost);
  merged.npcs = mergeNpcEntries(base.npcs, patch.npcs);

  return merged;
}

function dedupeChoices(choices: StoryChoice[]): StoryChoice[] {
  return Array.from(
    new Map(
      choices
        .map(choice => ({ ...choice, text: cleanText(choice.text, 220) }))
        .filter(choice => Boolean(choice.text))
        .map(choice => [choice.text.toLowerCase(), choice] as const)
    ).values()
  ).slice(0, 4);
}

function createAgenticDraft(turnNumber: number): AgenticDraft {
  return {
    chapter_title: turnNumber <= 1 ? 'Prologue' : `Tour ${turnNumber}`,
    section_type: 'action',
    narrative: {
      context: '',
      action: '',
      dialogue: '',
      reflection: '',
      atmosphere: 'tense'
    },
    memory_updates: defaultMemoryUpdates(),
    choices: [],
    state_update: undefined,
    scene_description: 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: null,
    done: false
  };
}

function parseToolArguments(rawArgs: string): Record<string, unknown> {
  const parsed = parseJsonSafely(rawArgs);
  return parsed ?? {};
}

type ParsedPseudoToolCall = {
  name: string;
  args: Record<string, unknown>;
};

const SUPPORTED_AGENTIC_TOOL_NAMES = new Set<string>([
  'set_scene',
  'update_world',
  'update_npc',
  'update_faction',
  'add_memory',
  'offer_choices',
  'finalize_turn'
]);

function isSupportedAgenticToolName(name: string | undefined): boolean {
  return SUPPORTED_AGENTIC_TOOL_NAMES.has(String(name || '').trim().toLowerCase());
}

function parseLooseJsonObject(rawObject: string): Record<string, unknown> | null {
  const direct = parseJsonSafely(rawObject);
  if (direct) return direct;

  const normalized = String(rawObject || '')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, '$1');

  return parseJsonSafely(normalized);
}

function extractPseudoToolCalls(rawText: string): ParsedPseudoToolCall[] {
  const text = String(rawText || '');
  const calls: ParsedPseudoToolCall[] = [];

  let cursor = 0;
  while (cursor < text.length) {
    const callIndex = text.indexOf('call:', cursor);
    if (callIndex === -1) break;

    let nameStart = callIndex + 5;
    while (nameStart < text.length && /\s/.test(text[nameStart])) nameStart += 1;

    let nameEnd = nameStart;
    while (nameEnd < text.length && /[A-Za-z0-9_]/.test(text[nameEnd])) nameEnd += 1;

    const name = text.slice(nameStart, nameEnd).trim().toLowerCase();
    if (!name) {
      cursor = callIndex + 5;
      continue;
    }

    while (nameEnd < text.length && /\s/.test(text[nameEnd])) nameEnd += 1;
    if (text[nameEnd] !== '{') {
      cursor = nameEnd;
      continue;
    }

    const braceStart = nameEnd;
    let depth = 0;
    let inString = false;
    let escaping = false;
    let braceEnd = -1;

    for (let i = braceStart; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (char === '\\') {
          escaping = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
        continue;
      }

      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          braceEnd = i;
          break;
        }
      }
    }

    if (braceEnd === -1) break;

    const rawArgs = text.slice(braceStart, braceEnd + 1);
    const parsedArgs = parseLooseJsonObject(rawArgs) ?? {};
    calls.push({ name, args: parsedArgs });

    cursor = braceEnd + 1;
  }

  return calls;
}

function draftHasMeaningfulData(draft: AgenticDraft): boolean {
  return Boolean(
    draft.narrative.context ||
    draft.narrative.action ||
    draft.narrative.dialogue ||
    draft.narrative.reflection ||
    draft.choices.length ||
    draft.state_update ||
    draft.memory_updates.notes.length ||
    draft.memory_updates.relations.length ||
    draft.memory_updates.places.length ||
    draft.memory_updates.injuries.length ||
    draft.memory_updates.resources.length
  );
}

const UNUSABLE_STORY_OUTPUT_PATTERN = /n'a pas renvoyé de sortie exploitable/i;
const TOOL_CALL_LEAK_PATTERN = /<\|?tool_call\|?>|tool_call|(?:^|\s)call:[a-z_]+\s*\{/i;

function hasPlayableChapterContent(chapter: StoryChapter): boolean {
  const action = cleanText(chapter.narrative.action, 280);
  if (!action) return false;
  return !UNUSABLE_STORY_OUTPUT_PATTERN.test(action) && !TOOL_CALL_LEAK_PATTERN.test(action);
}

function hasUsableStoryTurnOutput(rawResponse: string, chapter: StoryChapter): boolean {
  const raw = cleanText(rawResponse, 12000);

  if (hasPlayableChapterContent(chapter)) return true;
  if (!raw) return false;
  if (UNUSABLE_STORY_OUTPUT_PATTERN.test(raw)) return false;
  if (TOOL_CALL_LEAK_PATTERN.test(raw)) return false;

  return chapter.choices.length > 0;
}

function buildStrictJsonRecoveryMessages(messages: ChatMessage[]): ChatMessage[] {
  const recoveryInstruction = `MODE DE REPLI TECHNIQUE (obligatoire):
- N'utilise aucun tool call.
- N'écris jamais de balise <tool_call>, <|tool_call|> ni de syntaxe call:xxx.
- Réponds UNIQUEMENT avec un JSON valide (pas de markdown).
- Champs requis: chapter_title, chapter_number, section_type, narrative{context,action,dialogue,reflection,atmosphere}, choices(3-4), memory_updates, state_update, scene_description, user_edits_applied.`;

  return [
    ...messages,
    {
      role: 'user',
      content: recoveryInstruction
    }
  ];
}

function draftToChapter(draft: AgenticDraft, turnNumber: number, rawFallback = ''): StoryChapter {
  const payload = {
    chapter_title: draft.chapter_title,
    chapter_number: turnNumber,
    section_type: draft.section_type,
    narrative: draft.narrative,
    choices: draft.choices,
    memory_updates: draft.memory_updates,
    state_update: draft.state_update,
    scene_description: draft.scene_description,
    user_edits_applied: draft.user_edits_applied
  };

  const parsed = parseStoryResponse(JSON.stringify(payload), turnNumber);
  if (!parsed.narrative.action && rawFallback) {
    parsed.narrative.action = sanitizeNarrativeText(rawFallback, 5500);
  }
  return parsed;
}

function addMemoryUpdatesToDraft(draft: AgenticDraft, source: StoryMemoryUpdates): void {
  draft.memory_updates = {
    relations: mergeStringLists(draft.memory_updates.relations, source.relations),
    places: mergeStringLists(draft.memory_updates.places, source.places),
    injuries: mergeStringLists(draft.memory_updates.injuries, source.injuries),
    resources: mergeStringLists(draft.memory_updates.resources, source.resources),
    notes: mergeStringLists(draft.memory_updates.notes, source.notes)
  };
}

function applyAgenticToolCall(draft: AgenticDraft, toolName: string, args: Record<string, unknown>): { ok: boolean; note: string } {
  if (toolName === 'set_scene') {
    if (typeof args.chapter_title === 'string') draft.chapter_title = cleanText(args.chapter_title, 90) || draft.chapter_title;
    if (typeof args.section_type === 'string') draft.section_type = cleanText(args.section_type, 40) || draft.section_type;
    if (typeof args.scene_description === 'string') draft.scene_description = cleanText(args.scene_description, 180) || draft.scene_description;

    if (isObjectRecord(args.narrative)) {
      const narrative = coerceNarrative(args.narrative);
      draft.narrative = {
        ...draft.narrative,
        ...narrative
      };
    }

    if (typeof args.context === 'string') draft.narrative.context = cleanText(args.context, 1200);
    if (typeof args.action === 'string') draft.narrative.action = cleanText(args.action, 2200);
    if (typeof args.dialogue === 'string') draft.narrative.dialogue = cleanText(args.dialogue, 1600);
    if (typeof args.reflection === 'string') draft.narrative.reflection = cleanText(args.reflection, 1400);
    if (typeof args.atmosphere === 'string') draft.narrative.atmosphere = cleanText(args.atmosphere, 80) || draft.narrative.atmosphere;

    return { ok: true, note: 'scene updated' };
  }

  if (toolName === 'update_world') {
    const source = isObjectRecord(args.state_update) ? args.state_update : args;
    const patch = coerceStateUpdate(source);
    draft.state_update = mergeStateUpdates(draft.state_update, patch);
    return { ok: true, note: patch ? 'world updated' : 'no world delta detected' };
  }

  if (toolName === 'update_npc') {
    const npcSource = isObjectRecord(args.npc) ? args.npc : args;
    const patch = coerceStateUpdate({ npcs: [npcSource] });
    draft.state_update = mergeStateUpdates(draft.state_update, patch);
    return { ok: true, note: patch?.npcs?.length ? 'npc updated' : 'invalid npc payload' };
  }

  if (toolName === 'update_faction') {
    const factionDeltas: Record<string, number> = {};

    if (isObjectRecord(args.factions)) {
      for (const [id, value] of Object.entries(args.factions)) {
        const delta = Number(value);
        if (Number.isFinite(delta)) {
          factionDeltas[cleanText(id, 60)] = delta;
        }
      }
    }

    const singleFaction = cleanText(args.faction, 60);
    const singleDelta = Number(args.delta);
    if (singleFaction && Number.isFinite(singleDelta)) {
      factionDeltas[singleFaction] = (factionDeltas[singleFaction] ?? 0) + singleDelta;
    }

    const patch = coerceStateUpdate({ factions: factionDeltas });
    draft.state_update = mergeStateUpdates(draft.state_update, patch);
    return { ok: Object.keys(factionDeltas).length > 0, note: Object.keys(factionDeltas).length ? 'faction delta applied' : 'no valid faction delta' };
  }

  if (toolName === 'add_memory') {
    if (isObjectRecord(args.memory_updates)) {
      addMemoryUpdatesToDraft(draft, coerceMemoryUpdates(args.memory_updates));
      return { ok: true, note: 'memory updated' };
    }

    addMemoryUpdatesToDraft(draft, coerceMemoryUpdates(args));
    return { ok: true, note: 'memory updated' };
  }

  if (toolName === 'offer_choices') {
    const sourceChoices = Array.isArray(args.choices)
      ? args.choices
      : (args.choice ? [args.choice] : []);

    const parsedChoices = extractChoices(sourceChoices);
    draft.choices = dedupeChoices([...draft.choices, ...parsedChoices]);
    return { ok: parsedChoices.length > 0, note: parsedChoices.length ? 'choices registered' : 'no valid choices' };
  }

  if (toolName === 'finalize_turn') {
    if (typeof args.user_edits_applied === 'string') {
      const value = cleanText(args.user_edits_applied, 180);
      draft.user_edits_applied = value || null;
    }
    draft.done = true;
    return { ok: true, note: 'turn finalized' };
  }

  return { ok: false, note: `unknown tool: ${toolName}` };
}

export function supportsAgenticToolCalling(providerId: string | undefined, model?: string): boolean {
  const normalized = normalizeProviderId(providerId);
  if (!AGENTIC_TOOL_CALLING_PROVIDERS.has(normalized)) return false;

  if (!model) return true;

  const caps = detectModelCapabilities({ providerId: normalized, model });
  return caps.supportsNativeTools;
}

async function generateStoryTurnWithTools(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  turnNumber: number
): Promise<StoryTurnGenerationResult> {
  const stepCaps = detectModelCapabilities(config);
  const baseConversation = toOpenAiMessageList(messages);

  // ── Phase 1: Narrative generation without tools ─────────────────────────────
  // The model writes freely — full prose or JSON — unencumbered by tool schemas.
  // Full reasoning ON, full token budget, ideal temperature.
  const phase1Response = await callOpenAiCompatibleRaw(baseConversation, config, {
    maxTokens: stepCaps.maxOutputTokens,
    temperature: stepCaps.idealTemperature,
    skipReasoning: false
  });

  const phase1Text = cleanText(phase1Response.content, 8000);

  // Happy path: model already returned valid structured JSON
  const phase1Json = parseJsonSafely(phase1Text);
  if (phase1Json) {
    const chapter = parseStoryResponse(phase1Text, turnNumber);
    if (hasPlayableChapterContent(chapter)) {
      return { chapter, rawResponse: phase1Text, mode: 'structured-json', steps: 1, toolCalls: 0 };
    }
  }

  if (!phase1Text) {
    throw new Error('[storyEngine] Phase 1 retourna une réponse vide.');
  }

  // ── Phase 2: Structured extraction via tools ────────────────────────────────
  // We have the narrative. Now extract state updates and choices.
  const draft = createAgenticDraft(turnNumber);

  // Pre-seed draft with Phase 1 prose (if not JSON, it's the action text)
  if (!phase1Json) {
    draft.narrative.action = phase1Text;
  }

  const extractionConversation: OpenAiMessage[] = [
    ...baseConversation,
    { role: 'assistant', content: phase1Text },
    {
      role: 'user',
      content: `Extrais les données structurées de cette scène (sans réécrire la narration):
• update_world — hp delta, crédits delta, lieu si changé, blessures, inventaire
• update_npc — chaque PNJ présent: affinity, status, note
• offer_choices — 3-4 choix distincts et concrets, ancrés dans cette scène précise
• finalize_turn`
    }
  ];

  const rawChunks: string[] = [phase1Text];
  let totalToolCalls = 0;
  let steps = 1;

  for (let step = 1; step <= 6; step += 1) {
    steps = step + 1;

    const extractMsg = await callOpenAiCompatibleRaw(extractionConversation, config, {
      tools: AGENTIC_GM_TOOLS,
      toolChoice: 'auto',
      maxTokens: 1200,
      temperature: 0.4,
      skipReasoning: true
    });

    const assistantContent = cleanText(extractMsg.content, 4000);
    if (assistantContent) rawChunks.push(assistantContent);

    const toolCalls = Array.isArray(extractMsg.tool_calls) ? extractMsg.tool_calls : [];

    if (!toolCalls.length) {
      // No structured tool calls — try pseudo tool call parsing
      const pseudoCalls = extractPseudoToolCalls(assistantContent)
        .filter(tc => isSupportedAgenticToolName(tc.name));
      for (const tc of pseudoCalls) {
        totalToolCalls += 1;
        applyAgenticToolCall(draft, tc.name, tc.args);
      }
      break;
    }

    extractionConversation.push({
      role: 'assistant',
      content: extractMsg.content ?? '',
      tool_calls: toolCalls
    });

    for (const tc of toolCalls) {
      totalToolCalls += 1;
      const args = parseToolArguments(tc.function.arguments);
      const result = applyAgenticToolCall(draft, tc.function.name, args);
      extractionConversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result)
      });
    }

    if (draft.done && draft.choices.length > 0) break;
  }

  const rawResponse = rawChunks.join('\n\n').trim();
  const chapter = draftToChapter(draft, turnNumber, phase1Text);

  return {
    chapter,
    rawResponse,
    mode: 'agentic-tools',
    steps,
    toolCalls: totalToolCalls
  };
}

export async function generateStoryTurn(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  turnNumber: number
): Promise<StoryTurnGenerationResult> {
  const normalizedProviderId = normalizeProviderId(config.providerId);
  const normalizedConfig = normalizedProviderId === config.providerId
    ? config
    : { ...config, providerId: normalizedProviderId };

  if (supportsAgenticToolCalling(normalizedProviderId, normalizedConfig.model)) {
    try {
      const agenticResult = await generateStoryTurnWithTools(messages, normalizedConfig, turnNumber);
      if (hasUsableStoryTurnOutput(agenticResult.rawResponse, agenticResult.chapter)) {
        return agenticResult;
      }

      console.warn('[storyEngine] Tool-calling a renvoyé une sortie vide/inexploitable, fallback JSON.');
    } catch (error) {
      if (isAbortError(error)) {
        console.warn('[storyEngine] Tool-calling interrompu par timeout, fallback local non bloquant.', error);
        const emergencyChapter = fallbackChapter(
          `Le générateur IA a dépassé le temps imparti pendant le lancement. Le récit démarre en mode de secours pour ne pas bloquer la partie.`,
          turnNumber
        );

        return {
          chapter: emergencyChapter,
          rawResponse: JSON.stringify(emergencyChapter),
          mode: 'structured-json',
          steps: 0,
          toolCalls: 0
        };
      }

      console.warn('[storyEngine] Tool-calling indisponible, fallback JSON.', error);
    }
  }

  try {
    const rawResponse = await callTextModel(messages, normalizedConfig);
    const chapter = parseStoryResponse(rawResponse, turnNumber);

    if (!hasUsableStoryTurnOutput(rawResponse, chapter)) {
      console.warn('[storyEngine] Sortie JSON initiale inexploitable, retry strict JSON.');

      const recoveryMessages = buildStrictJsonRecoveryMessages(messages);
      const recoveryRawResponse = await callTextModel(recoveryMessages, normalizedConfig);
      const recoveryChapter = parseStoryResponse(recoveryRawResponse, turnNumber);

      if (hasUsableStoryTurnOutput(recoveryRawResponse, recoveryChapter)) {
        return {
          chapter: recoveryChapter,
          rawResponse: recoveryRawResponse,
          mode: 'structured-json',
          steps: 2,
          toolCalls: 0
        };
      }

      console.warn('[storyEngine] Retry strict JSON toujours inexploitable, fallback local non bloquant.');
      const emergencyChapter = fallbackChapter(
        `Le flux IA était instable sur ce tour. Le récit continue avec des choix sûrs.`,
        turnNumber
      );

      return {
        chapter: emergencyChapter,
        rawResponse: JSON.stringify(emergencyChapter),
        mode: 'structured-json',
        steps: 2,
        toolCalls: 0
      };
    }

    return {
      chapter,
      rawResponse,
      mode: 'structured-json',
      steps: 1,
      toolCalls: 0
    };
  } catch (error) {
    if (isAbortError(error)) {
      console.warn('[storyEngine] Requête texte interrompue par timeout, fallback local non bloquant.', error);
      const emergencyChapter = fallbackChapter(
        `Le générateur IA a mis trop de temps à répondre. Le récit continue avec un chapitre de secours, sans bloquer le lancement.`,
        turnNumber
      );

      return {
        chapter: emergencyChapter,
        rawResponse: JSON.stringify(emergencyChapter),
        mode: 'structured-json',
        steps: 0,
        toolCalls: 0
      };
    }

    throw error;
  }
}

function buildBackgroundWorldSystemPrompt(
  input: BackgroundWorldInput,
  promptMode: StoryPromptMode = 'json'
): string {
  const setup = input.setup;
  const protagonist = [setup.protagonistFirstName || '', setup.protagonistLastName || ''].join(' ').trim() || 'Le protagoniste';

  const recentBlock = input.recentSummary.length
    ? `\nRÉSUMÉ RÉCENT:\n${input.recentSummary.map(item => `- ${cleanText(item, 220)}`).join('\n')}`
    : '';

  const memoryBlock = input.memoryFacts.length
    ? `\nMÉMOIRE LONG TERME:\n${input.memoryFacts.slice(-20).map(item => `- ${cleanText(item, 200)}`).join('\n')}`
    : '';

  const recentBackgroundEventsBlock = input.recentBackgroundEvents?.length
    ? `\nDERNIERS ÉVÉNEMENTS HORS-ÉCRAN (ne pas répéter à l'identique):\n${input.recentBackgroundEvents
      .slice(0, 6)
      .map(event => `- ${cleanText(event.title, 90)} :: ${cleanText(event.summary, 220)}`)
      .join('\n')}`
    : '';

  let worldBlock = '\nÉTAT MONDE: indisponible';
  if (input.worldState) {
    const p = input.worldState.player;
    const topFactions = Object.entries(input.worldState.factions)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 5)
      .map(([id, score]) => `${id}=${score > 0 ? '+' : ''}${score}`)
      .join(', ');
    const npcs = input.worldState.npcs
      .filter(npc => npc.alive !== false)
      .slice(0, 8)
      .map(npc => `${npc.name}(${npc.status}, aff=${npc.affinity})`)
      .join(', ');

    worldBlock = `\nÉTAT MONDE:\n- HP=${p.hp}/100 | Crédits=${p.credits}\n- Lieu=${p.location} | Date=${p.date}\n- PNJs=${npcs || 'aucun'}\n- Factions=${topFactions || 'neutre'}`;
  }

  const base = `Tu es le Simulateur Galactique hors-écran d'une campagne Star Wars.\nTu résous uniquement les dynamiques de fond entre les tours du joueur.\n\nRÈGLES:\n- La plupart du temps, reste discret (pas d'événement majeur à chaque tour).\n- Déclenche un événement visible seulement s'il apporte une tension utile.\n- Respecte la continuité du monde et des factions.\n- N'écris pas une scène complète du joueur.\n- Si aucun événement utile: inject_now=false, impacts minimes ou nuls.\n- Si événement: reste concis, concret, exploitable (state_update + mémoire).\n- Interdiction de recycler quasiment à l'identique un événement hors-écran récent (même idée, même titre, même résumé).\n\nSETUP:\n- Protagoniste: ${protagonist}\n- Ère: ${setup.era} | Faction: ${setup.faction} | Rôle: ${setup.role}\n- Prémisse: ${setup.premise || 'Libre'}${worldBlock}${recentBlock}${memoryBlock}${recentBackgroundEventsBlock}`;

  const jsonContract = `Réponds UNIQUEMENT en JSON valide:\n{\n  "title": "Titre court",\n  "summary_public": "Message bref affichable au joueur",\n  "summary_private": "Contexte MJ optionnel",\n  "inject_now": false,\n  "prompt_hook": "Consigne courte pour influencer le prochain tour",\n  "memory_updates": {\n    "relations": [],\n    "places": [],\n    "injuries": [],\n    "resources": [],\n    "notes": []\n  },\n  "state_update": {\n    "hp": 0,\n    "credits": 0,\n    "location": "",\n    "date_advance": "",\n    "npcs": [],\n    "factions": {},\n    "injuries_new": [],\n    "injuries_resolved": [],\n    "inventory_gained": [],\n    "inventory_lost": [],\n    "gm_note": ""\n  }\n}`;

  const toolsContract = `MODE AGENTIQUE (tool-calling):\n- Utilise queue_world_event pour construire l'événement de fond.\n- inject_now=true uniquement si l'événement mérite d'être annoncé immédiatement.\n- Termine avec finalize_background_tick.`;

  return `${base}\n\n${promptMode === 'tool-calls' ? toolsContract : jsonContract}`;
}

function buildBackgroundWorldTickPrompt(turnNumber: number): string {
  return `Résous le tick hors-écran après le tour ${turnNumber}.\nDécide s'il y a un mouvement galactique pertinent à injecter maintenant.`;
}

function applyBackgroundToolCall(
  draft: BackgroundEventDraft,
  toolName: string,
  args: Record<string, unknown>
): { ok: boolean; note: string } {
  if (toolName === 'queue_world_event') {
    const patch = coerceBackgroundWorldEvent(args);
    if (!patch) return { ok: false, note: 'no background event payload' };
    draft.event = mergeBackgroundEvent(draft.event, patch);
    return { ok: true, note: 'background event updated' };
  }

  if (toolName === 'finalize_background_tick') {
    draft.done = true;
    return { ok: true, note: 'background tick finalized' };
  }

  return { ok: false, note: `unknown tool: ${toolName}` };
}

async function generateBackgroundWorldEventWithTools(
  input: BackgroundWorldInput,
  config: StoryProviderConfig
): Promise<BackgroundWorldGenerationResult> {
  const conversation: OpenAiMessage[] = [
    {
      role: 'system',
      content: buildBackgroundWorldSystemPrompt(input, 'tool-calls')
    },
    {
      role: 'user',
      content: buildBackgroundWorldTickPrompt(input.turnNumber)
    }
  ];

  const draft = createBackgroundEventDraft();
  const rawChunks: string[] = [];
  let totalToolCalls = 0;
  let steps = 0;

  for (let step = 1; step <= 5; step += 1) {
    steps = step;

    const assistantMessage = await callOpenAiCompatibleRaw(conversation, config, {
      tools: AGENTIC_BACKGROUND_TOOLS,
      toolChoice: 'auto',
      maxTokens: 900,
      temperature: step === 1 ? 0.8 : 0.65
    });

    const assistantContent = cleanText(assistantMessage.content, 8000);
    if (assistantContent) rawChunks.push(assistantContent);

    const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
    if (!toolCalls.length) {
      if (assistantContent) {
        const parsed = parseJsonSafely(assistantContent);
        const patch = coerceBackgroundWorldEvent(parsed);
        if (patch) {
          draft.event = mergeBackgroundEvent(draft.event, patch);
        }
      }
      break;
    }

    conversation.push({
      role: 'assistant',
      content: assistantMessage.content ?? '',
      tool_calls: toolCalls
    });

    for (const toolCall of toolCalls) {
      totalToolCalls += 1;
      const args = parseToolArguments(toolCall.function.arguments);
      const result = applyBackgroundToolCall(draft, toolCall.function.name, args);

      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result)
      });
    }

    if (draft.done) break;
  }

  const rawResponse = rawChunks.join('\n\n').trim();
  return {
    event: hasBackgroundEventImpact(draft.event) ? draft.event : null,
    rawResponse: rawResponse || JSON.stringify(draft.event),
    mode: 'agentic-tools',
    steps: Math.max(1, steps),
    toolCalls: totalToolCalls
  };
}

async function generateBackgroundWorldEventStructured(
  input: BackgroundWorldInput,
  config: StoryProviderConfig
): Promise<BackgroundWorldGenerationResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildBackgroundWorldSystemPrompt(input, 'json')
    },
    {
      role: 'user',
      content: buildBackgroundWorldTickPrompt(input.turnNumber)
    }
  ];

  const rawResponse = await callTextModel(messages, config);
  const parsed = parseJsonSafely(rawResponse);
  const event = coerceBackgroundWorldEvent(parsed);

  return {
    event: hasBackgroundEventImpact(event) ? event : null,
    rawResponse,
    mode: 'structured-json',
    steps: 1,
    toolCalls: 0
  };
}

export async function generateBackgroundWorldEvent(
  input: BackgroundWorldInput,
  config: StoryProviderConfig
): Promise<BackgroundWorldGenerationResult> {
  const normalizedProviderId = normalizeProviderId(config.providerId);
  const normalizedConfig = normalizedProviderId === config.providerId
    ? config
    : { ...config, providerId: normalizedProviderId };

  if (supportsAgenticToolCalling(normalizedProviderId, normalizedConfig.model)) {
    try {
      return await generateBackgroundWorldEventWithTools(input, normalizedConfig);
    } catch (error) {
      if (isAbortError(error)) {
        console.warn('[storyEngine] Background tool-calling interrompu par timeout, skip du tick.', error);
        return {
          event: null,
          rawResponse: '',
          mode: 'structured-json',
          steps: 0,
          toolCalls: 0
        };
      }

      console.warn('[storyEngine] Background tool-calling indisponible, fallback JSON.', error);
    }
  }

  try {
    return await generateBackgroundWorldEventStructured(input, normalizedConfig);
  } catch (error) {
    if (isAbortError(error)) {
      console.warn('[storyEngine] Background requête texte interrompue par timeout, skip du tick.', error);
      return {
        event: null,
        rawResponse: '',
        mode: 'structured-json',
        steps: 0,
        toolCalls: 0
      };
    }

    throw error;
  }
}

async function callAnthropic(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  ensureApiKey(config.providerId, config.apiKey);

  const systemMessage = messages.find(message => message.role === 'system');
  const conversation = messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: message.role, content: message.content }));

  const caps = detectModelCapabilities(config);
  const body: Record<string, unknown> = {
    model: resolveModel(config),
    max_tokens: caps.maxOutputTokens,
    messages: conversation
  };

  // Extended thinking for Claude 4+ models
  if (caps.reasoningStyle === 'anthropic-thinking') {
    const thinkingBudget = caps.tier === 'large' ? 8000 : 5000;
    body.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
    body.temperature = 1; // Required with extended thinking
  } else {
    body.temperature = caps.idealTemperature;
  }

  if (systemMessage?.content) {
    body.system = systemMessage.content;
  }

  const { controller, cancel } = withTimeoutSignal(50000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': String(config.apiKey || '').trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(`Anthropic: ${message}`);
    }

    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string; thinking?: string }>;
    };

    // Extended thinking responses have multiple blocks: [{type:'thinking',...},{type:'text',...}]
    const textBlock = data.content?.find(b => b.type === 'text');
    return textBlock?.text || data.content?.[0]?.text || '';
  } finally {
    cancel();
  }
}

async function callOllama(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  const baseUrl = cleanText(config.ollamaUrl, 200) || 'http://localhost:11434';
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  const body = {
    model: resolveModel(config),
    messages,
    stream: false,
    options: {
      temperature: 0.9
    }
  };

  const { controller, cancel } = withTimeoutSignal(50000);

  try {
    const response = await fetch(`${normalizedBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(`Ollama: ${message}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      response?: string;
    };

    return data.message?.content || data.response || '';
  } finally {
    cancel();
  }
}

export async function callTextModel(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  const providerId = normalizeProviderId(config.providerId);
  const normalizedConfig = providerId === config.providerId
    ? config
    : { ...config, providerId };

  if (!providerId || providerId === 'none') {
    throw new Error('Aucun provider texte sélectionné.');
  }

  if (providerId === 'anthropic') {
    return callAnthropic(messages, normalizedConfig);
  }

  if (providerId === 'ollama') {
    return callOllama(messages, normalizedConfig);
  }

  return callOpenAiCompatible(messages, normalizedConfig);
}

export function summarizeChapterForPrompt(chapter: StoryChapter): string {
  const title = cleanText(chapter.chapter_title, 72);
  const type = cleanText(chapter.section_type, 28) || 'action';
  const action = sanitizeNarrativeText(chapter.narrative.action || chapter.narrative.context, 190);
  const dialogue = sanitizeNarrativeText(chapter.narrative.dialogue, 110);
  const reflection = sanitizeNarrativeText(chapter.narrative.reflection, 110);
  const atmosphere = cleanText(chapter.narrative.atmosphere, 90);

  const stateBits: string[] = [];
  const su = chapter.state_update;
  if (su) {
    if (typeof su.location === 'string' && su.location.trim()) stateBits.push(`déplacement vers ${cleanText(su.location, 50)}`);
    if (typeof su.date_advance === 'string' && su.date_advance.trim()) stateBits.push(`temps avancé de ${cleanText(su.date_advance, 40)}`);
    if (typeof su.hp === 'number' && su.hp !== 0) stateBits.push(`HP${su.hp > 0 ? '+' : ''}${su.hp}`);
    if (typeof su.credits === 'number' && su.credits !== 0) stateBits.push(`crédits${su.credits > 0 ? '+' : ''}${su.credits}`);

    const npcNames = Array.from(new Set(
      (su.npcs || [])
        .map(npc => cleanText(npc.name, 60))
        .filter(Boolean)
    )).slice(0, 3);
    if (npcNames.length) stateBits.push(`PNJs: ${npcNames.join(', ')}`);

    const factionBits = Object.entries(su.factions || {})
      .filter(([, delta]) => typeof delta === 'number' && delta !== 0)
      .slice(0, 3)
      .map(([id, delta]) => `${id}${delta > 0 ? '+' : ''}${delta}`);
    if (factionBits.length) stateBits.push(`factions: ${factionBits.join(', ')}`);

    const injuries = (su.injuries_new || [])
      .map(injury => cleanText(injury.description, 60))
      .filter(Boolean)
      .slice(0, 2);
    if (injuries.length) stateBits.push(`blessures: ${injuries.join(', ')}`);

    const gained = (su.inventory_gained || [])
      .map(item => `${item.qty > 1 ? `${item.qty}× ` : ''}${cleanText(item.name, 50)}`)
      .filter(Boolean)
      .slice(0, 2);
    if (gained.length) stateBits.push(`gain: ${gained.join(', ')}`);

    const resolved = (su.injuries_resolved || [])
      .map(item => cleanText(item, 60))
      .filter(Boolean)
      .slice(0, 2);
    if (resolved.length) stateBits.push(`résolu: ${resolved.join(', ')}`);
  }

  const narrativeBits = [
    action,
    dialogue ? `dialogue: ${dialogue}` : '',
    reflection ? `intérieur: ${reflection}` : ''
  ].filter(Boolean).join(' ');

  const memoryNotes = [
    ...chapter.memory_updates.relations.slice(0, 2).map(item => cleanText(item, 70)),
    ...chapter.memory_updates.places.slice(0, 1).map(item => cleanText(item, 70)),
    ...chapter.memory_updates.notes.slice(0, 1).map(item => cleanText(item, 100))
  ].filter(Boolean);

  const summaryParts = [
    `Tour ${chapter.chapter_number}: ${title} (${type})`,
    narrativeBits,
    stateBits.length ? `Conséquences: ${stateBits.join('; ')}` : '',
    memoryNotes.length ? `Mémoire: ${memoryNotes.join(' · ')}` : '',
    atmosphere ? `Ambiance: ${atmosphere}` : ''
  ].filter(Boolean);

  return cleanText(summaryParts.join(' — '), 420);
}

export function normalizeProviderId(rawProviderId: string | undefined): string {
  const providerId = String(rawProviderId || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    groq: 'grok',
    xai: 'grok',
    together: 'openrouter',
    togetherai: 'openrouter'
  };
  return aliases[providerId] || providerId;
}
