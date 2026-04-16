/* ═══════════════════════════════════════════════
   Database Schema — Dexie.js (IndexedDB)
══════════════════════════════════════════════ */
import Dexie, { type Table } from 'dexie';

export interface Story {
  id: string;
  title: string;
  content: string;
  setup: {
    era: string;
    faction: string;
    role: string;
    premise: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastPlayedAt?: Date;
    playCount: number;
    wordCount: number;
  };
  tags: string[];
  folderId?: string;
  theme?: StoryTheme;
  version: number;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface StoryTheme {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  color: string;
  createdAt: Date;
  storyCount?: number;
}

export interface StoryVersion {
  id: string;
  storyId: string;
  content: string;
  setup: Story['setup'];
  savedAt: Date;
  version: number;
}

export interface UserPreferences {
  id: 'preferences';
  uiLanguage: string;
  theme: 'light' | 'dark' | 'auto';
  defaultImageProvider?: string;
  defaultImgModel?: string;
  autoSave: boolean;
  autoSaveInterval: number;
  showOnboarding: boolean;
  shortcuts: ShortcutMap;
  profiles: CreativeProfile[];
  activeProfileId?: string;
}

export interface ShortcutMap {
  newStory?: string;
  saveStory?: string;
  search?: string;
  toggleSidebar?: string;
  settings?: string;
  help?: string;
}

export interface CreativeProfile {
  id: string;
  name: string;
  icon: string;
  config: {
    defaultEra?: string;
    defaultFaction?: string;
    defaultRole?: string;
    defaultPremise?: string;
    preferredImageProvider?: string;
    preferredImgModel?: string;
    customPromptPrefix?: string;
  };
}

export interface AppState {
  id: 'appState';
  currentStoryId?: string;
  recentStories: string[];
  trashCleanUpDate?: Date;
  firstVisitDate: Date;
  analytics: AnalyticsData;
}

export interface AnalyticsData {
  storiesCreated: number;
  totalPlayTime: number;
  choicesMade: number;
  imagesGenerated: number;
  weeklyStats: WeeklyStat[];
}

export interface WeeklyStat {
  weekStart: Date;
  storiesCreated: number;
  timeSpent: number;
  favoriteFaction?: string;
  favoriteRole?: string;
}

export class StarWarsDB extends Dexie {
  stories!: Table<Story, string>;
  folders!: Table<Folder, string>;
  storyVersions!: Table<StoryVersion, string>;
  preferences!: Table<UserPreferences, string>;
  appState!: Table<AppState, string>;

  constructor() {
    super('StarWarsStoryDB');

    this.version(1).stores({
      stories: 'id, title, folderId, *tags, createdAt=[metadata.createdAt], updatedAt=[metadata.updatedAt], isArchived, isDeleted',
      folders: 'id, parentId, name',
      storyVersions: 'id, storyId, savedAt, version',
      preferences: 'id',
      appState: 'id'
    });
  }
}

export const db = new StarWarsDB();

// ─── Default Data ──────────────────────────────
export const DEFAULT_PREFERENCES: UserPreferences = {
  id: 'preferences',
  uiLanguage: 'fr',
  theme: 'dark',
  autoSave: true,
  autoSaveInterval: 30000,
  showOnboarding: true,
  shortcuts: {
    newStory: 'ctrl+n',
    saveStory: 'ctrl+s',
    search: 'ctrl+f',
    toggleSidebar: 'ctrl+b',
    settings: 'ctrl+,',
    help: '?'
  },
  profiles: []
};

export const DEFAULT_APP_STATE: AppState = {
  id: 'appState',
  recentStories: [],
  firstVisitDate: new Date(),
  analytics: {
    storiesCreated: 0,
    totalPlayTime: 0,
    choicesMade: 0,
    imagesGenerated: 0,
    weeklyStats: []
  }
};

// ─── Database Helpers ─────────────────────────
export async function initializeDB(): Promise<void> {
  const prefs = await db.preferences.get('preferences');
  if (!prefs) {
    await db.preferences.put(DEFAULT_PREFERENCES);
  }

  const appState = await db.appState.get('appState');
  if (!appState) {
    await db.appState.put(DEFAULT_APP_STATE);
  }
}

export async function getPreferences(): Promise<UserPreferences> {
  const prefs = await db.preferences.get('preferences');
  return prefs || DEFAULT_PREFERENCES;
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const current = await getPreferences();
  await db.preferences.put({ ...current, ...prefs });
}

export async function getAppState(): Promise<AppState> {
  const state = await db.appState.get('appState');
  return state || DEFAULT_APP_STATE;
}

export async function updateAppState(state: Partial<AppState>): Promise<void> {
  const current = await getAppState();
  await db.appState.put({ ...current, ...state });
}

// ─── Story CRUD ────────────────────────────────
export async function createStory(data: Omit<Story, 'id' | 'metadata' | 'version' | 'isArchived' | 'isDeleted'>): Promise<Story> {
  const id = crypto.randomUUID();
  const now = new Date();

  const story: Story = {
    id,
    ...data,
    metadata: {
      createdAt: now,
      updatedAt: now,
      playCount: 0,
      wordCount: data.content.split(/\s+/).length
    },
    version: 1,
    isArchived: false,
    isDeleted: false
  };

  await db.stories.put(story);
  await addToRecentStories(id);
  await incrementAnalytics('storiesCreated');

  return story;
}

export async function getStory(id: string): Promise<Story | undefined> {
  return db.stories.get(id);
}

export async function updateStory(id: string, data: Partial<Story>): Promise<void> {
  const story = await db.stories.get(id);
  if (!story) throw new Error('Story not found');

  const updated: Partial<Story> = {
    ...data,
    metadata: {
      ...story.metadata,
      updatedAt: new Date(),
      wordCount: data.content?.split(/\s+/).length || story.metadata.wordCount
    }
  };

  if (data.content !== undefined) {
    await createVersion(story);
  }

  await db.stories.update(id, updated);
}

export async function deleteStory(id: string, permanent = false): Promise<void> {
  if (permanent) {
    await db.stories.delete(id);
    await db.storyVersions.where('storyId').equals(id).delete();
  } else {
    await db.stories.update(id, {
      isDeleted: true,
      deletedAt: new Date()
    });
  }
}

export async function restoreStory(id: string): Promise<void> {
  await db.stories.update(id, {
    isDeleted: false,
    deletedAt: undefined
  });
}

export async function archiveStory(id: string): Promise<void> {
  await db.stories.update(id, { isArchived: true });
}

export async function unarchiveStory(id: string): Promise<void> {
  await db.stories.update(id, { isArchived: false });
}

export async function getAllStories(options?: {
  includeDeleted?: boolean;
  includeArchived?: boolean;
  folderId?: string;
  tags?: string[];
}): Promise<Story[]> {
  let collection = db.stories.toCollection();

  const stories = await collection.toArray();

  return stories.filter(s => {
    if (options?.includeDeleted !== true && s.isDeleted) return false;
    if (options?.includeArchived !== true && s.isArchived) return false;
    if (options?.folderId && s.folderId !== options.folderId) return false;
    if (options?.tags?.length) {
      const hasAllTags = options.tags.every(t => s.tags.includes(t));
      if (!hasAllTags) return false;
    }
    return true;
  }).sort((a, b) => 
    b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime()
  );
}

export async function searchStories(query: string): Promise<Story[]> {
  const lowerQuery = query.toLowerCase();
  const stories = await db.stories.toArray();

  return stories.filter(s => {
    if (s.isDeleted) return false;
    return (
      s.title.toLowerCase().includes(lowerQuery) ||
      s.content.toLowerCase().includes(lowerQuery) ||
      s.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  });
}

// ─── Versions ────────────────────────────────
export async function createVersion(story: Story): Promise<void> {
  const versions = await db.storyVersions
    .where('storyId')
    .equals(story.id)
    .toArray();

  const version: StoryVersion = {
    id: crypto.randomUUID(),
    storyId: story.id,
    content: story.content,
    setup: story.setup,
    savedAt: new Date(),
    version: versions.length + 1
  };

  await db.storyVersions.put(version);

  // Keep only last 5 versions
  if (versions.length >= 5) {
    const sorted = versions.sort((a, b) => a.savedAt.getTime() - b.savedAt.getTime());
    const toDelete = sorted.slice(0, versions.length - 4);
    await db.storyVersions.bulkDelete(toDelete.map(v => v.id));
  }
}

export async function getVersions(storyId: string): Promise<StoryVersion[]> {
  return db.storyVersions
    .where('storyId')
    .equals(storyId)
    .reverse()
    .sortBy('savedAt');
}

export async function restoreVersion(versionId: string): Promise<void> {
  const version = await db.storyVersions.get(versionId);
  if (!version) throw new Error('Version not found');

  await db.stories.update(version.storyId, {
    content: version.content,
    setup: version.setup
  });
}

// ─── Folders ────────────────────────────────
export async function createFolder(data: Omit<Folder, 'id' | 'createdAt' | 'storyCount'>): Promise<Folder> {
  const folder: Folder = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date()
  };

  await db.folders.put(folder);
  return folder;
}

export async function getFolders(): Promise<Folder[]> {
  const folders = await db.folders.toArray();
  
  for (const folder of folders) {
    const count = await db.stories.where('folderId').equals(folder.id).count();
    folder.storyCount = count;
  }
  
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateFolder(id: string, data: Partial<Folder>): Promise<void> {
  await db.folders.update(id, data);
}

export async function deleteFolder(id: string): Promise<void> {
  // Move stories in this folder to root
  await db.stories.where('folderId').equals(id).modify({ folderId: undefined });
  await db.folders.delete(id);
}

// ─── Analytics ────────────────────────────────
export async function incrementAnalytics(
  field: keyof Omit<AnalyticsData, 'weeklyStats'>,
  value = 1
): Promise<void> {
  const state = await getAppState();
  (state.analytics as any)[field] = ((state.analytics as any)[field] || 0) + value;
  await db.appState.put(state);
}

export async function addToRecentStories(storyId: string): Promise<void> {
  const state = await getAppState();
  state.recentStories = [
    storyId,
    ...state.recentStories.filter(id => id !== storyId)
  ].slice(0, 10);
  await db.appState.put(state);
}

export async function getRecentStories(limit = 5): Promise<Story[]> {
  const state = await getAppState();
  const stories: Story[] = [];
  
  for (const id of state.recentStories.slice(0, limit)) {
    const story = await db.stories.get(id);
    if (story && !story.isDeleted) {
      stories.push(story);
    }
  }
  
  return stories;
}

// ─── Trash Management ────────────────────────
export async function emptyTrash(): Promise<void> {
  const stories = await db.stories.where('isDeleted').equals(1).toArray();
  
  for (const story of stories) {
    await deleteStory(story.id, true);
  }
}

export async function cleanupOldTrash(daysOld = 30): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const oldTrash = await db.stories
    .filter(s => s.isDeleted && s.deletedAt && s.deletedAt < cutoff)
    .toArray();

  for (const story of oldTrash) {
    await deleteStory(story.id, true);
  }
}

// ─── Export/Import ───────────────────────────
export async function exportStory(id: string): Promise<string> {
  const story = await db.stories.get(id);
  if (!story) throw new Error('Story not found');

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    story: {
      ...story,
      metadata: {
        ...story.metadata,
        createdAt: story.metadata.createdAt.toISOString(),
        updatedAt: story.metadata.updatedAt.toISOString(),
        lastPlayedAt: story.metadata.lastPlayedAt?.toISOString()
      }
    }
  }, null, 2);
}

export async function importStory(jsonString: string): Promise<Story> {
  const data = JSON.parse(jsonString);
  
  if (!data.story) {
    throw new Error('Invalid export format');
  }

  const imported = data.story;
  imported.id = crypto.randomUUID();
  imported.metadata.createdAt = new Date(imported.metadata.createdAt);
  imported.metadata.updatedAt = new Date(imported.metadata.updatedAt);
  if (imported.metadata.lastPlayedAt) {
    imported.metadata.lastPlayedAt = new Date(imported.metadata.lastPlayedAt);
  }

  await db.stories.put(imported);
  return imported;
}

export async function exportAllData(): Promise<string> {
  const stories = await db.stories.toArray();
  const folders = await db.folders.toArray();
  const preferences = await db.preferences.get('preferences');
  const appState = await db.appState.get('appState');

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      stories: stories.map(s => ({
        ...s,
        metadata: {
          ...s.metadata,
          createdAt: s.metadata.createdAt.toISOString(),
          updatedAt: s.metadata.updatedAt.toISOString(),
          lastPlayedAt: s.metadata.lastPlayedAt?.toISOString()
        }
      })),
      folders,
      preferences,
      appState
    }
  }, null, 2);
}
