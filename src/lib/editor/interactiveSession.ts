import type { StorySetup } from '$lib/stores/editor';
import type {
  ChatMessage,
  StoryChapter,
  WorldState
} from '$lib/ai/storyEngine';

const INTERACTIVE_SESSION_PREFIX = 'sw_svelte_interactive_story_';

export interface LoggedBackgroundEvent {
  id: string;
  turn: number;
  title: string;
  summary: string;
  promptHook?: string;
  privateSummary?: string;
}

export interface InteractiveSessionPayload {
  version: 1;
  turnNumber: number;
  selectedTrame: string | null;
  currentChapter: StoryChapter | null;
  chapterHistory: StoryChapter[];
  actionHistory: string[];
  aiMessages: ChatMessage[];
  memoryLog: string[];
  setupSnapshot: StorySetup;
  backgroundEvents?: LoggedBackgroundEvent[];
  worldState?: WorldState;
  campaignArchive?: string[];
}

function storySessionKey(id: string): string {
  return `${INTERACTIVE_SESSION_PREFIX}${id}`;
}

export function saveInteractiveSessionPayload(storyId: string | null, payload: InteractiveSessionPayload): void {
  if (!storyId || typeof localStorage === 'undefined') return;
  localStorage.setItem(storySessionKey(storyId), JSON.stringify(payload));
}

export function loadInteractiveSessionPayload(id: string, fallbackSetup: StorySetup): InteractiveSessionPayload | null {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(storySessionKey(id));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<InteractiveSessionPayload>;
    if (!Array.isArray(parsed.chapterHistory) || !parsed.chapterHistory.length) return null;

    return {
      version: 1,
      turnNumber: Number(parsed.turnNumber || parsed.chapterHistory.length || 0),
      selectedTrame: typeof parsed.selectedTrame === 'string' ? parsed.selectedTrame : null,
      currentChapter: parsed.currentChapter ?? parsed.chapterHistory[parsed.chapterHistory.length - 1] ?? null,
      chapterHistory: parsed.chapterHistory,
      actionHistory: Array.isArray(parsed.actionHistory) ? parsed.actionHistory : [],
      aiMessages: Array.isArray(parsed.aiMessages) ? parsed.aiMessages : [],
      memoryLog: Array.isArray(parsed.memoryLog) ? parsed.memoryLog : [],
      backgroundEvents: Array.isArray(parsed.backgroundEvents) ? parsed.backgroundEvents : [],
      setupSnapshot: (parsed.setupSnapshot as StorySetup) || fallbackSetup,
      worldState: parsed.worldState as WorldState | undefined,
      campaignArchive: Array.isArray(parsed.campaignArchive)
        ? parsed.campaignArchive.filter((item): item is string => typeof item === 'string')
        : []
    };
  } catch {
    return null;
  }
}

export function clearInteractiveSessionPayload(id: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(storySessionKey(id));
}
