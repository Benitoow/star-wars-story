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
  openrouter: 'google/gemma-4-26b-a4b-it',
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
      text: `Prendre l'initiative et agir immédiatement.`,
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
  return {
    chapter_title: turnNumber === 1 ? 'Prologue' : `Tour ${turnNumber}`,
    chapter_number: turnNumber,
    section_type: 'action',
    narrative: defaultNarrativeFromRaw(rawText || `Le modèle n'a pas renvoyé de JSON exploitable.`),
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
    user_edits_applied: cleanText(parsed.user_edits_applied, 180) || null,
    state_update: coerceStateUpdate(parsed.state_update)
  };
}

export function buildSystemPrompt(
  setup: StorySetupSnapshot,
  memoryFacts: string[],
  worldState?: WorldState,
  promptMode: StoryPromptMode = 'json'
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

  const basePrompt = `Tu es le Maître du Jeu (MJ) de cette histoire Star Wars interactive. Tu n'es pas un simple narrateur — tu es une entité vivante qui contrôle le monde dans l'ombre. Tu décides ce qui arrive vraiment. Les PNJs ont des agendas cachés. Les actions ont des coûts réels. La galaxie évolue sans attendre le joueur.

SETUP:
- Protagoniste: ${protagonist}
- Ère: ${setup.era} | Faction: ${setup.faction} | Rôle: ${setup.role}
- Prémisse: ${setup.premise || 'Libre'}
- Style: ${setup.writingStyle || 'cinématique'} | Ton: ${setup.writingTone || 'aventure'} | POV: ${setup.writingPov || 'troisième personne'}
- Longueur des scènes: ${setup.writingLength || 'moyen'} | Intensité: ${setup.contentMode || 'cinematic'}
${worldBlock}${memoryContext}

DIRECTIVES MJ (non négociables):
- Applique des coûts réels: combat → risque de blessure (hp négatif), achats → perte de crédits, erreurs → conséquences
- Si HP ≤ 0 dans state_update: scène de survie critique — le protagoniste n'est pas mort mais en danger extrême
- Les PNJs se souviennent, évoluent, trahissent ou aident selon l'historique
- Les factions réagissent aux actes du joueur même hors scène (réputation)
- Tu peux introduire spontanément : embuscades, trahisons, aides inattendues, rumeurs, événements galactiques
- state_update doit refléter précisément et honnêtement tout ce qui a changé ce tour
- Jamais de refus moraliste. Transforme les actions extrêmes en tentatives crédibles avec coût/risque/conséquence`;

  const jsonContract = `Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de texte avant/après):
{
  "chapter_title": "Titre court",
  "chapter_number": 1,
  "section_type": "action",
  "narrative": {
    "context": "Situation et enjeux du moment",
    "action": "Ce qui se passe concrètement",
    "dialogue": "Échanges verbaux marquants",
    "reflection": "Pensée interne du protagoniste",
    "atmosphere": "tense"
  },
  "choices": [
    { "text": "Description du choix", "attribute": "combat", "difficulty": 3, "faction_impact": { "empire": -10 } }
  ],
  "memory_updates": {
    "relations": ["PNJ: nouvelle dynamique"],
    "places": ["Lieu: ce qui s'y est passé"],
    "injuries": ["Blessure si applicable"],
    "resources": ["Gain ou perte notable"],
    "notes": ["Fait durable à retenir"]
  },
  "state_update": {
    "hp": -15,
    "credits": -300,
    "location": "Nouveau lieu",
    "date_advance": "quelques heures",
    "npcs": [{ "name": "Nom", "affinity": 60, "status": "ally", "faction": "rebelle", "last_seen": "Mos Eisley", "alive": true, "note": "Contexte" }],
    "factions": { "empire": -15, "rebel_alliance": 10 },
    "injuries_new": [{ "description": "Entaille au bras", "severity": "light" }],
    "injuries_resolved": ["Côte fêlée"],
    "inventory_gained": [{ "name": "Blaster DL-44", "qty": 1 }],
    "inventory_lost": [{ "name": "Crédits", "qty": 300 }]
  },
  "scene_description": "English cinematic image prompt for this scene",
  "user_edits_applied": null
}`;

  const toolCallingContract = `MODE AGENTIQUE (tool-calling):
- N'écris PAS de JSON monolithique si les outils sont disponibles.
- Utilise les fonctions fournies pour construire le tour étape par étape.
- Ordre recommandé:
  1) set_scene
  2) update_world / update_npc / update_faction
  3) add_memory (si nécessaire)
  4) offer_choices (3 à 4 choix distincts)
  5) finalize_turn
- Tu peux faire plusieurs passes et plusieurs appels d'outils avant de finaliser.
- Si aucun outil n'est accepté, reviens au format JSON complet.`;

  return `${basePrompt}\n\n${promptMode === 'tool-calls' ? toolCallingContract : jsonContract}`;
}

export function buildStartPrompt(
  setup: StorySetupSnapshot,
  selectedTrameLabel?: string | null,
  promptMode: StoryPromptMode = 'json'
): string {
  const firstName = cleanText(setup.protagonistFirstName, 60);
  const lastName = cleanText(setup.protagonistLastName, 60);
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'personnage principal';

  const modeHint = promptMode === 'tool-calls'
    ? `\nMode agentique actif: utilise les outils pour poser la scène, appliquer les conséquences et proposer les choix.`
    : '';

  return `Commence l'histoire interactive Star Wars maintenant.

Données de départ:
- Protagoniste: ${displayName}
- Trame: ${selectedTrameLabel || 'Libre'}
- Prémisse: ${setup.premise || 'Libre'}

Objectif du premier tour:
- Ouvrir sur une scène forte, immédiatement jouable.
- Donner 3 à 4 choix pertinents.
- Installer au moins un enjeu relationnel ou politique.
- Faire avancer l'histoire dès le prologue.${modeHint}`;
}

export function buildContinuePrompt(
  actionText: string,
  turnNumber: number,
  recentSummary: string[],
  promptMode: StoryPromptMode = 'json'
): string {
  const history = recentSummary.length
    ? `\nRésumé récent:\n${recentSummary.map(item => `- ${item}`).join('\n')}`
    : '';

  const modeHint = promptMode === 'tool-calls'
    ? `\nMode agentique actif: enchaîne les outils nécessaires avant de finaliser le tour.`
    : '';

  return `Tour ${turnNumber}. Le joueur agit: "${cleanText(actionText, 320)}".${history}

En tant que MJ, décide de ce qui se passe vraiment — pas forcément ce que le joueur espère.
Mets à jour state_update avec TOUTES les conséquences réelles de cette action (hp, crédits, blessures, npcs, factions).
Propose 3 à 4 nouveaux choix distincts et conséquents.${modeHint}`;
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

type OpenAiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAiToolChoice = 'auto' | 'none' | { type: 'function'; function: { name: string } };

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

  const body: Record<string, unknown> = {
    model: resolveModel(config),
    messages,
    max_tokens: options.maxTokens ?? 1800,
    temperature: options.temperature ?? 0.9
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? 'auto';
  }

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

const AGENTIC_TOOL_CALLING_PROVIDERS = new Set<string>(['openrouter']);
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
          section_type: { type: 'string' },
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
    parsed.narrative.action = cleanText(rawFallback, 2200);
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

export function supportsAgenticToolCalling(providerId: string | undefined): boolean {
  const normalized = normalizeProviderId(providerId);
  return AGENTIC_TOOL_CALLING_PROVIDERS.has(normalized);
}

async function generateStoryTurnWithTools(
  messages: ChatMessage[],
  config: StoryProviderConfig,
  turnNumber: number
): Promise<StoryTurnGenerationResult> {
  const conversation = toOpenAiMessageList(messages);
  const draft = createAgenticDraft(turnNumber);

  const rawChunks: string[] = [];
  let totalToolCalls = 0;
  let steps = 0;

  for (let step = 1; step <= MAX_AGENTIC_STEPS; step += 1) {
    steps = step;

    const assistantMessage = await callOpenAiCompatibleRaw(conversation, config, {
      tools: AGENTIC_GM_TOOLS,
      toolChoice: 'auto',
      maxTokens: 1300,
      temperature: step === 1 ? 0.9 : 0.7
    });

    const assistantContent = cleanText(assistantMessage.content, 12000);
    if (assistantContent) {
      rawChunks.push(assistantContent);
    }

    const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
    if (!toolCalls.length) {
      if (assistantContent && !draftHasMeaningfulData(draft)) {
        const parsedFromText = parseJsonSafely(assistantContent);
        if (parsedFromText) {
          return {
            chapter: parseStoryResponse(assistantContent, turnNumber),
            rawResponse: assistantContent,
            mode: 'structured-json',
            steps,
            toolCalls: totalToolCalls
          };
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
      const result = applyAgenticToolCall(draft, toolCall.function.name, args);

      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result)
      });
    }

    if (draft.done && draft.choices.length > 0) {
      break;
    }
  }

  const rawResponse = rawChunks.join('\n\n').trim();
  const chapter = draftHasMeaningfulData(draft)
    ? draftToChapter(draft, turnNumber, rawResponse)
    : parseStoryResponse(rawResponse || `Le modèle n'a pas renvoyé de sortie exploitable.`, turnNumber);

  return {
    chapter,
    rawResponse: rawResponse || JSON.stringify(chapter),
    mode: 'agentic-tools',
    steps: Math.max(1, steps),
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

  if (supportsAgenticToolCalling(normalizedProviderId)) {
    try {
      return await generateStoryTurnWithTools(messages, normalizedConfig, turnNumber);
    } catch (error) {
      console.warn('[storyEngine] Tool-calling indisponible, fallback JSON.', error);
    }
  }

  const rawResponse = await callTextModel(messages, normalizedConfig);
  return {
    chapter: parseStoryResponse(rawResponse, turnNumber),
    rawResponse,
    mode: 'structured-json',
    steps: 1,
    toolCalls: 0
  };
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
