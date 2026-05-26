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

export interface StoryChoice {
  text: string;
  attribute: StoryAttribute;
  difficulty: number;            // 1–5
  faction_impact: Record<string, number>;
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

export interface WorldState {
  player: PlayerState;
  npcs: NpcRelation[];
  factions: Record<string, number>;  // faction_id → -100…100
  chronology: ChronologyEntry[];
  rumors?: string[];
  environment_status?: string;
}

// What the model emits each turn to mutate the world. hp/credits are signed deltas.
export interface StateUpdate {
  hp?: number;            // delta (negative = damage, positive = heal)
  credits?: number;       // delta
  location?: string;      // replaces current location
  date_advance?: string;  // e.g. "quelques heures", "2 jours"
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
