/* ═══════════════════════════════════════════════
   Stories Store — Story Management
══════════════════════════════════════════════ */
import { writable, derived } from 'svelte/store';
import type { Story, Folder } from '$db';
import * as db from '$db';
import { filters, sortBy, sortDirection, searchQuery } from './ui';

// ─── Stories List ────────────────────────────
function createStoriesStore() {
  const { subscribe, set, update } = writable<Story[]>([]);

  return {
    subscribe,
    load: async () => {
      const stories = await db.getAllStories({ includeDeleted: false });
      set(stories);
      return stories;
    },
    loadTrash: async () => {
      const stories = await db.getAllStories({ includeDeleted: true });
      return stories.filter(s => s.isDeleted);
    },
    create: async (data: {
      title: string;
      content: string;
      setup: Story['setup'];
      tags?: string[];
      folderId?: string;
    }) => {
      const story = await db.createStory({
        title: data.title,
        content: data.content,
        setup: data.setup,
        tags: data.tags || [],
        folderId: data.folderId
      });
      update(stories => [story, ...stories]);
      return story;
    },
    update: async (id: string, data: Partial<Story>) => {
      await db.updateStory(id, data);
      update(stories =>
        stories.map(s =>
          s.id === id ? { ...s, ...data, metadata: { ...s.metadata, updatedAt: new Date() } } : s
        )
      );
    },
    delete: async (id: string, permanent = false) => {
      await db.deleteStory(id, permanent);
      if (permanent) {
        update(stories => stories.filter(s => s.id !== id));
      } else {
        update(stories =>
          stories.map(s => (s.id === id ? { ...s, isDeleted: true } : s))
        );
      }
    },
    restore: async (id: string) => {
      await db.restoreStory(id);
      update(stories =>
        stories.map(s => (s.id === id ? { ...s, isDeleted: false } : s))
      );
    },
    archive: async (id: string) => {
      await db.archiveStory(id);
      update(stories => stories.filter(s => s.id !== id));
    },
    unarchive: async (id: string) => {
      await db.unarchiveStory(id);
      const story = await db.getStory(id);
      if (story) {
        update(stories => [story, ...stories]);
      }
    }
  };
}

export const stories = createStoriesStore();

// ─── Current Story ────────────────────────────
export const currentStory = writable<Story | null>(null);

export async function loadStory(id: string) {
  const story = await db.getStory(id);
  currentStory.set(story || null);
  if (story) {
    await db.updateStory(id, {
      metadata: {
        ...story.metadata,
        lastPlayedAt: new Date(),
        playCount: story.metadata.playCount + 1
      }
    });
  }
  return story;
}

export function clearCurrentStory() {
  currentStory.set(null);
}

// ─── Folders ────────────────────────────────
function createFoldersStore() {
  const { subscribe, set, update } = writable<Folder[]>([]);

  return {
    subscribe,
    load: async () => {
      const folders = await db.getFolders();
      set(folders);
      return folders;
    },
    create: async (data: { name: string; parentId?: string; color?: string }) => {
      const folder = await db.createFolder({
        name: data.name,
        parentId: data.parentId,
        color: data.color || '#FFE81F'
      });
      update(folders => [...folders, folder]);
      return folder;
    },
    update: async (id: string, data: Partial<Folder>) => {
      await db.updateFolder(id, data);
      update(folders =>
        folders.map(f => (f.id === id ? { ...f, ...data } : f))
      );
    },
    delete: async (id: string) => {
      await db.deleteFolder(id);
      update(folders => folders.filter(f => f.id !== id));
    }
  };
}

export const folders = createFoldersStore();

// ─── Recent Stories ──────────────────────────
export const recentStories = writable<Story[]>([]);

export async function loadRecentStories() {
  const recent = await db.getRecentStories(5);
  recentStories.set(recent);
  return recent;
}

// ─── Filtered & Sorted Stories ────────────────
export const filteredStories = derived(
  [stories, filters, sortBy, sortDirection, searchQuery],
  ([$stories, $filters, $sortBy, $sortDir, $query]) => {
    // Always exclude deleted and archived stories from the main list
    let result = $stories.filter(s => !s.isDeleted && !s.isArchived);

    // Apply search
    if ($query.trim()) {
      const lower = $query.toLowerCase();
      result = result.filter(
        s =>
          s.title.toLowerCase().includes(lower) ||
          s.content.toLowerCase().includes(lower) ||
          s.tags.some(t => t.toLowerCase().includes(lower))
      );
    }

    // Apply filters
    if ($filters.era) {
      result = result.filter(s => s.setup.era === $filters.era);
    }
    if ($filters.faction) {
      result = result.filter(s => s.setup.faction === $filters.faction);
    }
    if ($filters.role) {
      result = result.filter(s => s.setup.role === $filters.role);
    }
    if ($filters.tags.length > 0) {
      result = result.filter(s =>
        $filters.tags.every(tag => s.tags.includes(tag))
      );
    }
    if ($filters.folderId !== undefined) {
      result = result.filter(s => s.folderId === $filters.folderId);
    }

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch ($sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'createdAt':
          comparison = a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.metadata.updatedAt.getTime() - b.metadata.updatedAt.getTime();
          break;
        case 'lastPlayedAt':
          const aTime = a.metadata.lastPlayedAt?.getTime() || 0;
          const bTime = b.metadata.lastPlayedAt?.getTime() || 0;
          comparison = aTime - bTime;
          break;
      }

      return $sortDir === 'desc' ? -comparison : comparison;
    });

    return result;
  }
);

// ─── Story Versions ─────────────────────────
export const storyVersions = writable<db.StoryVersion[]>([]);

export async function loadVersions(storyId: string) {
  const versions = await db.getVersions(storyId);
  storyVersions.set(versions);
  return versions;
}

export async function restoreStoryVersion(versionId: string) {
  await db.restoreVersion(versionId);
}
