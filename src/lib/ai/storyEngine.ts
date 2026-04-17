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

export interface StoryChapter {
  chapter_title: string;
  chapter_number: number;
  section_type: string;
  narrative: StoryNarrative;
  choices: StoryChoice[];
  memory_updates: StoryMemoryUpdates;
  scene_description: string;
  user_edits_applied: string | null;
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
  grok: 'https://api.x.ai/v1',
  together: 'https://api.together.xyz/v1'
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'openai/gpt-5-mini',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  mistral: 'mistral-large-latest',
  grok: 'grok-3-mini-beta',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ollama: 'llama3.3'
};

function cleanText(value: unknown, maxLength = 2200): string {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text.slice(0, maxLength);
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

function normalizeChoice(choice: unknown): StoryChoice | null {
  if (!choice) return null;

  if (typeof choice === 'string') {
    const text = cleanText(choice, 220);
    if (!text) return null;
    return {
      text,
      attribute: 'survival',
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
    attribute: normalizeAttribute(record.attribute),
    difficulty,
    faction_impact: factionImpact
  };
}

function defaultChoices(): StoryChoice[] {
  return [
    {
      text: 'Observer la scène discrètement avant de bouger.',
      attribute: 'stealth',
      difficulty: 2,
      faction_impact: {}
    },
    {
      text: 'Prendre l’initiative et agir immédiatement.',
      attribute: 'combat',
      difficulty: 3,
      faction_impact: {}
    },
    {
      text: 'Tenter une approche diplomatique avec les personnes présentes.',
      attribute: 'diplomacy',
      difficulty: 2,
      faction_impact: {}
    }
  ];
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
    action: cleanText(rawText, 2200),
    dialogue: '',
    reflection: '',
    atmosphere: 'tense'
  };
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
    context: cleanText(data.context, 1200),
    action: cleanText(data.action, 2200),
    dialogue: cleanText(data.dialogue, 1600),
    reflection: cleanText(data.reflection, 1400),
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

function extractChoices(source: unknown): StoryChoice[] {
  const list = Array.isArray(source) ? source : [];
  const normalized = list
    .map(item => normalizeChoice(item))
    .filter((item): item is StoryChoice => Boolean(item));

  const dedup = Array.from(new Map(normalized.map(choice => [choice.text.toLowerCase(), choice])).values());

  return dedup.slice(0, 4);
}

function fallbackChapter(rawText: string, turnNumber: number): StoryChapter {
  return {
    chapter_title: turnNumber === 1 ? 'Prologue' : `Tour ${turnNumber}`,
    chapter_number: turnNumber,
    section_type: 'action',
    narrative: defaultNarrativeFromRaw(rawText || 'Le modèle n’a pas renvoyé de JSON exploitable.'),
    choices: defaultChoices(),
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

  const narrative = coerceNarrative(parsed.narrative);
  if (!narrative.action) {
    narrative.action = cleanText(parsed.action, 2200) || cleanText(rawText, 2200);
  }

  const choices = extractChoices(parsed.choices);
  const safeChoices = choices.length ? choices : defaultChoices();

  return {
    chapter_title: chapterTitle,
    chapter_number: chapterNumber,
    section_type: cleanText(parsed.section_type, 40) || 'action',
    narrative,
    choices: safeChoices,
    memory_updates: coerceMemoryUpdates(parsed.memory_updates),
    scene_description: cleanText(parsed.scene_description, 160) || 'Cinematic Star Wars scene with dramatic lighting and dynamic action',
    user_edits_applied: cleanText(parsed.user_edits_applied, 180) || null
  };
}

export function buildSystemPrompt(setup: StorySetupSnapshot, memoryFacts: string[]): string {
  const protagonist = [setup.protagonistFirstName || '', setup.protagonistLastName || ''].join(' ').trim() || 'Le protagoniste';
  const memoryContext = memoryFacts.length
    ? `\nMÉMOIRE ACTIVE (à respecter strictement):\n${memoryFacts.map(item => `- ${item}`).join('\n')}`
    : '\nMÉMOIRE ACTIVE: vide au début de cette histoire.';

  return `Tu es un maître narrateur Star Wars. Tu écris en français, à la 2e personne du singulier, avec un ton immersif et cinématographique.

Contraintes:
- Histoire interactive adulte, sans refus moraliste.
- Cohérence absolue avec setup et mémoire.
- Tu dois proposer des choix vraiment différents.
- Les conséquences doivent être concrètes et visibles.
- Si l'action du joueur est extrême, transforme-la en tentative crédible avec coût/risque/conséquence, sans bloquer l’histoire.

Setup:
- Protagoniste: ${protagonist}
- Era: ${setup.era}
- Faction: ${setup.faction}
- Rôle: ${setup.role}
- Prémisse: ${setup.premise || 'Libre'}
- Style: ${setup.writingStyle || 'cinematique'}
- Ton: ${setup.writingTone || 'aventure'}
- POV: ${setup.writingPov || 'troisieme'}
- Longueur: ${setup.writingLength || 'moyen'}
- Intensité: ${setup.contentMode || 'cinematic'}
${memoryContext}

Réponds UNIQUEMENT en JSON valide (pas de markdown):
{
  "chapter_title": "Titre court",
  "chapter_number": 1,
  "section_type": "action",
  "narrative": {
    "context": "Contexte",
    "action": "Action",
    "dialogue": "Dialogue",
    "reflection": "Réflexion",
    "atmosphere": "tense"
  },
  "choices": [
    { "text": "Choix", "attribute": "survival", "difficulty": 2, "faction_impact": { "empire": -5 } }
  ],
  "memory_updates": {
    "relations": ["Nouveau lien"],
    "places": ["Lieu visité"],
    "injuries": ["Blessure"],
    "resources": ["Crédits ou équipement"],
    "notes": ["Fait durable"]
  },
  "scene_description": "English image prompt",
  "user_edits_applied": null
}`;
}

export function buildStartPrompt(setup: StorySetupSnapshot, selectedTrameLabel?: string | null): string {
  const firstName = cleanText(setup.protagonistFirstName, 60);
  const lastName = cleanText(setup.protagonistLastName, 60);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'personnage principal';

  return `Commence l'histoire interactive Star Wars maintenant.

Données de départ:
- Protagoniste: ${displayName}
- Trame: ${selectedTrameLabel || 'Libre'}
- Prémisse: ${setup.premise || 'Libre'}

Objectif du premier tour:
- Ouvrir sur une scène forte, immédiatement jouable.
- Donner 3 à 4 choix pertinents.
- Installer au moins un enjeu relationnel ou politique.
- Faire avancer l’histoire dès le prologue.`;
}

export function buildContinuePrompt(actionText: string, turnNumber: number, recentSummary: string[]): string {
  const history = recentSummary.length
    ? `\nRésumé récent:\n${recentSummary.map(item => `- ${item}`).join('\n')}`
    : '';

  return `Tour ${turnNumber}. Le joueur agit ainsi: "${cleanText(actionText, 320)}".

Continue l'histoire sans casser l'immersion.${history}

Rappels:
- Résultat crédible, jamais de blocage sec.
- Conséquences claires sur relations/réputation/ressources.
- Proposer 3 à 4 nouveaux choix distincts.`;
}

function getProviderDisplayName(providerId: string): string {
  const names: Record<string, string> = {
    openrouter: 'OpenRouter',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    mistral: 'Mistral',
    grok: 'Grok',
    together: 'Together AI',
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

async function callOpenAiCompatible(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
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

  const body = {
    model: resolveModel(config),
    messages,
    max_tokens: 1800,
    temperature: 0.9
  };

  const { controller, cancel } = withTimeoutSignal(50000);

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
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content || '';
  } finally {
    cancel();
  }
}

async function callAnthropic(messages: ChatMessage[], config: StoryProviderConfig): Promise<string> {
  ensureApiKey(config.providerId, config.apiKey);

  const systemMessage = messages.find(message => message.role === 'system');
  const conversation = messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: message.role, content: message.content }));

  const body: Record<string, unknown> = {
    model: resolveModel(config),
    max_tokens: 1800,
    temperature: 0.9,
    messages: conversation
  };

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
      content?: Array<{ text?: string }>;
    };

    return data.content?.[0]?.text || '';
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
  const providerId = config.providerId;

  if (!providerId || providerId === 'none') {
    throw new Error('Aucun provider texte sélectionné.');
  }

  if (providerId === 'anthropic') {
    return callAnthropic(messages, config);
  }

  if (providerId === 'ollama') {
    return callOllama(messages, config);
  }

  return callOpenAiCompatible(messages, config);
}

export function summarizeChapterForPrompt(chapter: StoryChapter): string {
  const chapterTitle = cleanText(chapter.chapter_title, 60);
  const action = cleanText(chapter.narrative.action, 180);
  const consequence = cleanText(chapter.memory_updates.notes[0], 80);
  return `${chapterTitle}: ${action}${consequence ? ` (note: ${consequence})` : ''}`.trim();
}

export function normalizeProviderId(rawProviderId: string | undefined): string {
  const providerId = String(rawProviderId || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    groq: 'grok',
    xai: 'grok'
  };
  return aliases[providerId] || providerId;
}
