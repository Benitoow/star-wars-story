/* ═══════════════════════════════════════════════
   Story engine — domain types (no runtime deps)
══════════════════════════════════════════════ */

export const SECTION_TYPES = [
  'action',        // combat, poursuite, assaut
  'dialogue',      // conversation, négociation, interrogatoire
  'exploration',   // découverte, voyage, reconnaissance
  'tension',       // montée du danger, planification sous pression
  'revelation',    // coup de théâtre, découverte majeure
  'repos',         // soins, récupération, temps calme
  'interlude',     // moment relationnel, réflexion
  'confrontation'  // face-à-face intense, pas forcément physique
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const STORY_ATTRIBUTES = ['combat', 'diplomacy', 'stealth', 'tech', 'force', 'survival'] as const;
export type StoryAttribute = (typeof STORY_ATTRIBUTES)[number];
export type RiskLevel = 'low' | 'medium' | 'high';

export type SkillProfile = Record<StoryAttribute, number>;

export interface StoryChoice {
  text: string;
  attribute: StoryAttribute;
  difficulty: number;            // 1–5
  faction_impact: Record<string, number>;
  tradeoff?: string;             // what this choice sacrifices or risks
  stakes?: string;               // visible consequence if things go badly
  requires_items?: string[];     // exact/fuzzy inventory names needed to attempt it
  consumes_items?: string[];     // inventory names consumed when selected
  risk?: RiskLevel;              // optional model hint; UI recalculates from the player
}

export interface StoryNarrative {
  action: string;       // pure narration — no dialogue
  dialogue: string;     // "Nom : réplique" lines — never an em-dash prefix
  reflection: string;   // protagonist's inner thoughts (optional)
  atmosphere: string;   // tense | calm | mysterious | eerie | heroic
}

export interface StoryMemoryUpdates {
  relations: string[];
  places: string[];
  injuries: string[];
  resources: string[];
  notes: string[];
}

// ── Structured narrative memory ───────────────────────
export const MEMORY_CATEGORIES = ['relations', 'places', 'injuries', 'resources', 'notes'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/** One remembered fact, stamped with the turn that established (or last re-confirmed) it. */
export interface MemoryFact {
  text: string;
  category: MemoryCategory;
  turn: number;
}

// ── Living world state ────────────────────────────────
export type Severity = 'light' | 'moderate' | 'severe';
export type PlayerCondition = 'active' | 'critical'; // critical = downed at 0 HP → next scene is survival/rescue

export interface Injury {
  description: string;
  severity: Severity;
}
export interface InventoryItem {
  name: string;
  qty: number;
}

export interface PlayerState {
  hp: number;          // 0–100
  credits: number;
  location: string;
  date: string;        // in-universe narrative date
  injuries: Injury[];
  inventory: InventoryItem[];
  skills: SkillProfile; // 1–5, derived from role/faction and improved by training
  experience: number;
  level: number;
  criticalTurns: number; // consecutive turns spent at 0 HP
  condition: PlayerCondition;
}

export type NpcStatus = 'ally' | 'neutral' | 'hostile' | 'dead';

export interface NpcRelation {
  name: string;
  affinity: number;    // -100 (hostile) … 100 (loyal)
  status: NpcStatus;
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

export interface CampaignState {
  title: string;
  objective: string;
  progress: string;
  status: 'active' | 'completed' | 'failed';
  dossier?: string; // one-shot factual campaign bible (generated at turn 1)
}

export interface WorldEvent {
  turn: number;
  date: string;
  summary: string;
}

export type EndingType = 'victory' | 'death' | 'retirement' | 'defeat';

export interface GameEnding {
  type: EndingType;
  title: string;
  epilogue: string;
}

export interface WorldState {
  player: PlayerState;
  npcs: NpcRelation[];
  factions: Record<string, number>;  // faction_id → -100…100
  chronology: ChronologyEntry[];
  campaign: CampaignState;
  world_events: WorldEvent[];
  rumors?: string[];
  environment_status?: string;
  ending?: GameEnding;
}

// What the model emits each turn to mutate the world. hp/credits are signed deltas.
export interface StateUpdate {
  hp?: number;            // delta (negative = damage, positive = heal)
  credits?: number;       // delta
  experience?: number;     // delta; 100 XP = one level
  skill_gains?: Partial<SkillProfile>;
  location?: string;      // replaces current location
  date_advance?: string;  // e.g. "quelques heures", "2 jours"
  campaign_update?: Partial<CampaignState>;
  world_events_new?: string[];
  ending?: Partial<GameEnding>;
  npcs?: Array<Partial<NpcRelation> & { name: string }>;  // upsert by name
  factions?: Record<string, number>;  // faction_id → delta
  injuries_new?: Injury[];
  injuries_resolved?: string[];       // partial match on description
  inventory_gained?: InventoryItem[];
  inventory_lost?: InventoryItem[];
  rumors_new?: string[];
  environment_status?: string;
}

export interface StoryChapter {
  chapter_title: string;
  chapter_number: number;
  section_type: string;
  narrative: StoryNarrative;
  choices: StoryChoice[];
  memory_updates: StoryMemoryUpdates;
  state_update?: StateUpdate;
  npcs_present?: string[];  // named NPCs physically present at the END of the scene — drives "talk to" offers
}

// ── Generation I/O ────────────────────────────────────
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type StoryGenerationMode = 'structured-json' | 'agentic-subagents';

export interface StoryProviderConfig {
  providerId: string;
  model: string;
  apiKey?: string;
  reasoningEffort?: string;  // 'auto' (default) = let the model decide
}

export interface StoryTurnResult {
  chapter: StoryChapter;
  worldState: WorldState;
  rawResponse: string;
  mode: StoryGenerationMode;
}

// ── Live chat ("Mode Direct") ─────────────────────────
export interface ChatTurn {
  speaker: 'player' | 'npc';
  content: string;
}

export interface ChatSession {
  npcName: string;     // who we're talking to
  sceneSummary: string; // the beat that opened the conversation
  turns: ChatTurn[];
}

// ── Story setup (player's choices at creation) ────────
export interface StorySetup {
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
  language?: string;
}
