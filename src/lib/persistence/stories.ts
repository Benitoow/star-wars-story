import { ROLES } from '$lib/content/catalog';
import type { StorySetup } from '$lib/engine/types';
import { db, type StoredStory } from './db';

function defaultTitle(setup: StorySetup): string {
  const name = [setup.protagonistFirstName, setup.protagonistLastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  const role = ROLES.find((r) => r.id === setup.role)?.name || 'Aventurier';
  return `${role} — nouvelle légende`;
}

export async function createStory(setup: StorySetup, title?: string): Promise<StoredStory> {
  const now = Date.now();
  const story: StoredStory = {
    id: crypto.randomUUID(),
    title: title?.trim() || defaultTitle(setup),
    setup,
    createdAt: now,
    updatedAt: now,
    turnCount: 0
  };
  await db.stories.put(story);
  return story;
}

export async function getStory(id: string): Promise<StoredStory | undefined> {
  return db.stories.get(id);
}

/** Active (non-deleted) stories, most recently played/updated first. */
export async function listStories(): Promise<StoredStory[]> {
  const all = await db.stories.toArray();
  return all
    .filter((s) => !s.deletedAt)
    .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt));
}

export async function updateStory(id: string, patch: Partial<StoredStory>): Promise<void> {
  await db.stories.update(id, { ...patch, updatedAt: Date.now() });
}

/** Record a play tick — bumps lastPlayedAt and (optionally) the turn count. */
export async function touchStory(id: string, turnCount?: number): Promise<void> {
  const now = Date.now();
  await db.stories.update(id, {
    lastPlayedAt: now,
    updatedAt: now,
    ...(typeof turnCount === 'number' ? { turnCount } : {})
  });
}

export async function softDeleteStory(id: string): Promise<void> {
  await db.stories.update(id, { deletedAt: Date.now() });
}

export async function restoreStory(id: string): Promise<void> {
  await db.stories.update(id, { deletedAt: undefined });
}

export async function hardDeleteStory(id: string): Promise<void> {
  await db.transaction('rw', db.stories, db.sessions, async () => {
    await db.stories.delete(id);
    await db.sessions.delete(id);
  });
}
