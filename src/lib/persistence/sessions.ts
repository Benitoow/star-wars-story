import { fromLegacyFacts, sanitizeMemory } from '$lib/engine/memory';
import type { ChatSession, ChatTurn, StoryChapter } from '$lib/engine/types';
import { db, SESSION_VERSION, type StoredSession } from './db';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sanitizeChat(raw: unknown): ChatSession | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Partial<ChatSession>;
  const turns = asArray<ChatTurn>(c.turns).filter(
    (t) => !!t && (t.speaker === 'player' || t.speaker === 'npc') && typeof t.content === 'string'
  );
  if (!turns.length) return undefined;
  return {
    npcName: typeof c.npcName === 'string' ? c.npcName : '',
    sceneSummary: typeof c.sceneSummary === 'string' ? c.sceneSummary : '',
    turns
  };
}

/** Light shape repair — IndexedDB data may predate the current code. */
function sanitize(raw: StoredSession): StoredSession {
  const chapterHistory = asArray<StoryChapter>(raw.chapterHistory);
  const memoryFacts = asArray<string>(raw.memoryFacts);
  // v1 saves only have the flat fact list — upgrade it to structured memory.
  const memory = sanitizeMemory(raw.memory);
  return {
    storyId: raw.storyId,
    version: SESSION_VERSION,
    turnNumber: Number.isFinite(raw.turnNumber) && raw.turnNumber >= 0 ? raw.turnNumber : chapterHistory.length,
    worldState: raw.worldState,
    currentChapter: raw.currentChapter ?? chapterHistory[chapterHistory.length - 1] ?? null,
    chapterHistory,
    actionHistory: asArray<string>(raw.actionHistory),
    memoryFacts,
    memory: memory.length ? memory : fromLegacyFacts(memoryFacts),
    trameId: raw.trameId ?? null,
    chat: sanitizeChat(raw.chat)
  };
}

export async function saveSession(session: StoredSession): Promise<void> {
  await db.sessions.put({ ...session, version: SESSION_VERSION });
}

export async function loadSession(storyId: string): Promise<StoredSession | null> {
  const raw = await db.sessions.get(storyId);
  return raw ? sanitize(raw) : null;
}

export async function clearSession(storyId: string): Promise<void> {
  await db.sessions.delete(storyId);
}
