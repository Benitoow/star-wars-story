import type { UiLanguageCode } from '$lib/config/languages';

export const DATA_SCHEMA_VERSION = 2;

type ThemeMode = 'light' | 'dark' | 'auto';

const SUPPORTED_UI_LANGUAGES: UiLanguageCode[] = ['auto', 'fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

function isUiLanguageCode(value: unknown): value is UiLanguageCode {
  return typeof value === 'string' && SUPPORTED_UI_LANGUAGES.includes(value as UiLanguageCode);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeMetadata(metadata: unknown) {
  const source = isRecord(metadata) ? metadata : {};

  return {
    createdAt: toDate(source.createdAt) ?? new Date(),
    updatedAt: toDate(source.updatedAt) ?? new Date(),
    lastPlayedAt: toDate(source.lastPlayedAt),
    playCount: typeof source.playCount === 'number' ? source.playCount : 0,
    wordCount: typeof source.wordCount === 'number' ? source.wordCount : 0
  };
}

function normalizeSetup(setup: unknown) {
  const source = isRecord(setup) ? setup : {};

  return {
    era: typeof source.era === 'string' ? source.era : '',
    faction: typeof source.faction === 'string' ? source.faction : '',
    role: typeof source.role === 'string' ? source.role : '',
    premise: typeof source.premise === 'string' ? source.premise : ''
  };
}

function normalizeStoryRecord(story: unknown) {
  if (!isRecord(story)) {
    throw new Error('Invalid story payload');
  }

  const content = typeof story.content === 'string' ? story.content : '';
  const title = typeof story.title === 'string' ? story.title : 'Nouvelle Histoire';
  const tags = toStringArray(story.tags);

  return {
    id: typeof story.id === 'string' ? story.id : crypto.randomUUID(),
    title,
    content,
    setup: normalizeSetup(story.setup),
    metadata: normalizeMetadata(story.metadata),
    tags,
    folderId: typeof story.folderId === 'string' ? story.folderId : undefined,
    theme: isRecord(story.theme)
      ? {
          primaryColor: typeof story.theme.primaryColor === 'string' ? story.theme.primaryColor : undefined,
          backgroundColor: typeof story.theme.backgroundColor === 'string' ? story.theme.backgroundColor : undefined,
          fontFamily: typeof story.theme.fontFamily === 'string' ? story.theme.fontFamily : undefined
        }
      : undefined,
    version: typeof story.version === 'number' ? story.version : 1,
    isArchived: typeof story.isArchived === 'boolean' ? story.isArchived : false,
    isDeleted: typeof story.isDeleted === 'boolean' ? story.isDeleted : false,
    deletedAt: toDate(isRecord(story) ? story.deletedAt : undefined)
  };
}

function normalizeFolderRecord(folder: unknown) {
  if (!isRecord(folder)) {
    throw new Error('Invalid folder payload');
  }

  return {
    id: typeof folder.id === 'string' ? folder.id : crypto.randomUUID(),
    name: typeof folder.name === 'string' ? folder.name : 'Nouveau dossier',
    parentId: typeof folder.parentId === 'string' ? folder.parentId : undefined,
    color: typeof folder.color === 'string' ? folder.color : '#FFE81F',
    createdAt: toDate(folder.createdAt) ?? new Date(),
    storyCount: typeof folder.storyCount === 'number' ? folder.storyCount : undefined
  };
}

function normalizeStoryVersionRecord(version: unknown) {
  if (!isRecord(version)) {
    throw new Error('Invalid story version payload');
  }

  return {
    id: typeof version.id === 'string' ? version.id : crypto.randomUUID(),
    storyId: typeof version.storyId === 'string' ? version.storyId : '',
    content: typeof version.content === 'string' ? version.content : '',
    setup: normalizeSetup(version.setup),
    savedAt: toDate(version.savedAt) ?? new Date(),
    version: typeof version.version === 'number' ? version.version : 1
  };
}

function normalizePreferencesRecord(preferences: unknown) {
  if (!isRecord(preferences)) {
    throw new Error('Invalid preferences payload');
  }

  const uiLanguage: UiLanguageCode = isUiLanguageCode(preferences.uiLanguage)
    ? preferences.uiLanguage
    : 'auto';

  const theme: ThemeMode = isThemeMode(preferences.theme)
    ? preferences.theme
    : 'dark';

  const imageProvider = typeof preferences.imageProvider === 'string'
    ? preferences.imageProvider
    : (typeof preferences.defaultImageProvider === 'string' ? preferences.defaultImageProvider : undefined);

  const imageModel = typeof preferences.imageModel === 'string'
    ? preferences.imageModel
    : (typeof preferences.defaultImgModel === 'string' ? preferences.defaultImgModel : undefined);

  const contentMode = typeof preferences.contentMode === 'string'
    ? preferences.contentMode
    : (typeof preferences.contentIntensity === 'string' ? preferences.contentIntensity : undefined);

  return {
    id: 'preferences' as const,
    firstName: typeof preferences.firstName === 'string' ? preferences.firstName : undefined,
    lastName: typeof preferences.lastName === 'string' ? preferences.lastName : undefined,
    avatarEmoji: typeof preferences.avatarEmoji === 'string' ? preferences.avatarEmoji : undefined,
    uiLanguage,
    theme,
    textProvider: typeof preferences.textProvider === 'string' ? preferences.textProvider : undefined,
    textModel: typeof preferences.textModel === 'string' ? preferences.textModel : undefined,
    textApiKey: typeof preferences.textApiKey === 'string' ? preferences.textApiKey : undefined,
    ollamaUrl: typeof preferences.ollamaUrl === 'string' ? preferences.ollamaUrl : undefined,
    imageProvider,
    imageModel,
    imageApiKey: typeof preferences.imageApiKey === 'string' ? preferences.imageApiKey : undefined,
    writingStyle: typeof preferences.writingStyle === 'string' ? preferences.writingStyle : undefined,
    writingPov: typeof preferences.writingPov === 'string' ? preferences.writingPov : undefined,
    writingTone: typeof preferences.writingTone === 'string' ? preferences.writingTone : undefined,
    writingLength: typeof preferences.writingLength === 'string' ? preferences.writingLength : undefined,
    contentMode,
    defaultImageProvider: typeof preferences.defaultImageProvider === 'string'
      ? preferences.defaultImageProvider
      : imageProvider,
    defaultImgModel: typeof preferences.defaultImgModel === 'string'
      ? preferences.defaultImgModel
      : imageModel,
    autoSave: typeof preferences.autoSave === 'boolean' ? preferences.autoSave : true,
    autoSaveInterval: typeof preferences.autoSaveInterval === 'number' ? preferences.autoSaveInterval : 30000,
    showOnboarding: typeof preferences.showOnboarding === 'boolean' ? preferences.showOnboarding : true,
    shortcuts: isRecord(preferences.shortcuts)
      ? {
          newStory: typeof preferences.shortcuts.newStory === 'string' ? preferences.shortcuts.newStory : 'ctrl+n',
          saveStory: typeof preferences.shortcuts.saveStory === 'string' ? preferences.shortcuts.saveStory : 'ctrl+s',
          search: typeof preferences.shortcuts.search === 'string' ? preferences.shortcuts.search : 'ctrl+f',
          toggleSidebar: typeof preferences.shortcuts.toggleSidebar === 'string' ? preferences.shortcuts.toggleSidebar : 'ctrl+b',
          settings: typeof preferences.shortcuts.settings === 'string' ? preferences.shortcuts.settings : 'ctrl+,',
          help: typeof preferences.shortcuts.help === 'string' ? preferences.shortcuts.help : '?'
        }
      : {
          newStory: 'ctrl+n',
          saveStory: 'ctrl+s',
          search: 'ctrl+f',
          toggleSidebar: 'ctrl+b',
          settings: 'ctrl+,',
          help: '?'
        },
    profiles: Array.isArray(preferences.profiles)
      ? preferences.profiles
          .filter(isRecord)
          .map(profile => ({
            id: typeof profile.id === 'string' ? profile.id : crypto.randomUUID(),
            name: typeof profile.name === 'string' ? profile.name : 'Nouveau Profil',
            icon: typeof profile.icon === 'string' ? profile.icon : '🚀',
            config: isRecord(profile.config)
              ? {
                  defaultEra: typeof profile.config.defaultEra === 'string' ? profile.config.defaultEra : undefined,
                  defaultFaction: typeof profile.config.defaultFaction === 'string' ? profile.config.defaultFaction : undefined,
                  defaultRole: typeof profile.config.defaultRole === 'string' ? profile.config.defaultRole : undefined,
                  defaultPremise: typeof profile.config.defaultPremise === 'string' ? profile.config.defaultPremise : undefined,
                  preferredImageProvider: typeof profile.config.preferredImageProvider === 'string' ? profile.config.preferredImageProvider : undefined,
                  preferredImgModel: typeof profile.config.preferredImgModel === 'string' ? profile.config.preferredImgModel : undefined,
                  customPromptPrefix: typeof profile.config.customPromptPrefix === 'string' ? profile.config.customPromptPrefix : undefined
                }
              : {}
          }))
      : [],
    activeProfileId: typeof preferences.activeProfileId === 'string' ? preferences.activeProfileId : undefined
  };
}

function normalizeWeeklyStat(stat: unknown) {
  if (!isRecord(stat)) {
    return undefined;
  }

  return {
    weekStart: toDate(stat.weekStart) ?? new Date(),
    storiesCreated: typeof stat.storiesCreated === 'number' ? stat.storiesCreated : 0,
    timeSpent: typeof stat.timeSpent === 'number' ? stat.timeSpent : 0,
    favoriteFaction: typeof stat.favoriteFaction === 'string' ? stat.favoriteFaction : undefined,
    favoriteRole: typeof stat.favoriteRole === 'string' ? stat.favoriteRole : undefined
  };
}

function normalizeAppStateRecord(appState: unknown) {
  if (!isRecord(appState)) {
    throw new Error('Invalid app state payload');
  }

  return {
    id: 'appState' as const,
    currentStoryId: typeof appState.currentStoryId === 'string' ? appState.currentStoryId : undefined,
    recentStories: toStringArray(appState.recentStories),
    trashCleanUpDate: toDate(appState.trashCleanUpDate),
    firstVisitDate: toDate(appState.firstVisitDate) ?? new Date(),
    analytics: isRecord(appState.analytics)
      ? {
          storiesCreated: typeof appState.analytics.storiesCreated === 'number' ? appState.analytics.storiesCreated : 0,
          totalPlayTime: typeof appState.analytics.totalPlayTime === 'number' ? appState.analytics.totalPlayTime : 0,
          choicesMade: typeof appState.analytics.choicesMade === 'number' ? appState.analytics.choicesMade : 0,
          imagesGenerated: typeof appState.analytics.imagesGenerated === 'number' ? appState.analytics.imagesGenerated : 0,
          weeklyStats: Array.isArray(appState.analytics.weeklyStats)
            ? appState.analytics.weeklyStats.map(normalizeWeeklyStat).filter((stat): stat is NonNullable<ReturnType<typeof normalizeWeeklyStat>> => Boolean(stat))
            : []
        }
      : {
          storiesCreated: 0,
          totalPlayTime: 0,
          choicesMade: 0,
          imagesGenerated: 0,
          weeklyStats: []
        }
  };
}

function serializeStoryRecord(story: ReturnType<typeof normalizeStoryRecord>) {
  return {
    ...cloneRecord(story),
    metadata: {
      ...cloneRecord(story.metadata),
      createdAt: story.metadata.createdAt.toISOString(),
      updatedAt: story.metadata.updatedAt.toISOString(),
      lastPlayedAt: story.metadata.lastPlayedAt?.toISOString()
    },
    deletedAt: story.deletedAt?.toISOString()
  };
}

function serializeFolderRecord(folder: ReturnType<typeof normalizeFolderRecord>) {
  return {
    ...cloneRecord(folder),
    createdAt: folder.createdAt.toISOString()
  };
}

function serializeStoryVersionRecord(version: ReturnType<typeof normalizeStoryVersionRecord>) {
  return {
    ...cloneRecord(version),
    savedAt: version.savedAt.toISOString()
  };
}

function serializeAppStateRecord(appState: ReturnType<typeof normalizeAppStateRecord>) {
  return {
    ...cloneRecord(appState),
    firstVisitDate: appState.firstVisitDate.toISOString(),
    trashCleanUpDate: appState.trashCleanUpDate?.toISOString(),
    analytics: {
      ...cloneRecord(appState.analytics),
      weeklyStats: appState.analytics.weeklyStats.map(stat => ({
        ...cloneRecord(stat),
        weekStart: stat.weekStart.toISOString()
      }))
    }
  };
}

export function normalizeStoryForStorage(story: unknown) {
  return normalizeStoryRecord(story);
}

export function normalizeFolderForStorage(folder: unknown) {
  return normalizeFolderRecord(folder);
}

export function normalizePreferencesForStorage(preferences: unknown) {
  return normalizePreferencesRecord(preferences);
}

export function normalizeAppStateForStorage(appState: unknown) {
  return normalizeAppStateRecord(appState);
}

export function createStoryExportEnvelope(story: unknown) {
  const normalized = normalizeStoryRecord(story);
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    story: serializeStoryRecord(normalized)
  };
}

export function createAllDataExportEnvelope(input: {
  stories: unknown[];
  folders: unknown[];
  storyVersions: unknown[];
  preferences: unknown;
  appState: unknown;
}) {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      stories: input.stories.map(story => serializeStoryRecord(normalizeStoryRecord(story))),
      folders: input.folders.map(folder => serializeFolderRecord(normalizeFolderRecord(folder))),
      storyVersions: input.storyVersions.map(version => serializeStoryVersionRecord(normalizeStoryVersionRecord(version))),
      preferences: serializePreferencesForExport(normalizePreferencesRecord(input.preferences)),
      appState: serializeAppStateRecord(normalizeAppStateRecord(input.appState))
    }
  };
}

function serializePreferencesForExport(preferences: ReturnType<typeof normalizePreferencesRecord>) {
  return cloneRecord(preferences);
}

export function parseStoryImportEnvelope(json: string) {
  const payload = JSON.parse(json) as Partial<{ schemaVersion: number; story: unknown }>;
  if (!payload || typeof payload !== 'object' || !payload.story) {
    throw new Error('Invalid story export format');
  }

  if (typeof payload.schemaVersion === 'number' && payload.schemaVersion > DATA_SCHEMA_VERSION) {
    throw new Error('Unsupported story export version');
  }

  return normalizeStoryRecord(payload.story);
}

export function parseAllDataImportEnvelope(json: string) {
  const payload = JSON.parse(json) as Partial<{ schemaVersion: number; data: unknown }>;
  if (!payload || typeof payload !== 'object' || !isRecord(payload.data)) {
    throw new Error('Invalid data export format');
  }

  if (typeof payload.schemaVersion === 'number' && payload.schemaVersion > DATA_SCHEMA_VERSION) {
    throw new Error('Unsupported data export version');
  }

  const data = payload.data;
  const stories = Array.isArray(data.stories) ? data.stories.map(normalizeStoryRecord) : [];
  const folders = Array.isArray(data.folders) ? data.folders.map(normalizeFolderRecord) : [];
  const storyVersions = Array.isArray(data.storyVersions)
    ? data.storyVersions.map(normalizeStoryVersionRecord).filter(version => Boolean(version.storyId))
    : [];
  const preferences = data.preferences ? normalizePreferencesRecord(data.preferences) : undefined;
  const appState = data.appState ? normalizeAppStateRecord(data.appState) : undefined;

  return {
    schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : DATA_SCHEMA_VERSION,
    stories,
    folders,
    storyVersions,
    preferences,
    appState
  };
}

export function cloneWithNormalizedDates<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
