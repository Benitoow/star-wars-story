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
  current_location?: string;
  current_goal?: string;
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
  clocks?: Record<string, { current: number; max: number }>;
  sector_influence?: Record<string, number>;
  rumors?: string[];
  environment_status?: string;
  director_instruction?: string;
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
  clocks_new?: { name: string; max_steps: number }[];
  clocks_advance?: Record<string, number>; // name -> delta
  sector_influence?: Record<string, number>; // faction_id -> delta
  rumors_new?: string[];
  environment_status?: string;
  director_instruction?: string;
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
