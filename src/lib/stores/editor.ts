/* ═══════════════════════════════════════════════
   Story Editor Store
══════════════════════════════════════════════ */
import { writable, derived, get } from 'svelte/store';
import type { Story } from '$lib/db';
import { createStory as dbCreateStory, updateStory as dbUpdateStory, getStory as dbGetStory } from '$lib/db';
import { initializeDB } from '$lib/db';
import { logger } from '$lib/utils/logger';

// ─── Types ─────────────────────────────────────
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
}

export interface EditorStory {
  id: string;
  title: string;
  content: string;
  setup: StorySetup;
  tags: string[];
  folderId?: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

interface EditorState {
  story: EditorStory;
  isDirty: boolean;
  lastSaved?: Date;
}

// ─── Stores ────────────────────────────────────
const defaultStory: EditorStory = {
  id: '',
  title: 'Nouvelle Histoire',
  content: '',
  setup: {
    era: '',
    faction: '',
    role: '',
    premise: '',
    protagonistFirstName: '',
    protagonistLastName: '',
    protagonistAvatar: '🧑‍🚀',
    writingStyle: 'cinematique',
    writingTone: 'aventure',
    writingPov: 'troisieme',
    writingLength: 'moyen',
    contentMode: 'cinematic'
  },
  tags: []
};

const editorState = writable<EditorState>({
  story: { ...defaultStory },
  isDirty: false
});

// ─── Public Stores ─────────────────────────────
export const story = derived(editorState, $state => $state.story);
export const isDirty = derived(editorState, $state => $state.isDirty);
export const lastSaved = derived(editorState, $state => $state.lastSaved);

export const currentSetup = derived(editorState, $state => $state.story.setup);

// ─── Actions ───────────────────────────────────
export function resetEditor() {
  editorState.set({
    story: { ...defaultStory },
    isDirty: false
  });
}

export function setStory(storyData: EditorStory) {
  editorState.update(state => ({
    ...state,
    story: { ...storyData },
    isDirty: false
  }));
}

export function updateContent(content: string) {
  editorState.update(state => ({
    ...state,
    story: { ...state.story, content },
    isDirty: true
  }));
}

export function updateTitle(title: string) {
  editorState.update(state => ({
    ...state,
    story: { ...state.story, title },
    isDirty: true
  }));
}

export function updateSetupField<K extends keyof StorySetup>(
  field: K,
  value: StorySetup[K]
) {
  editorState.update(state => ({
    ...state,
    story: {
      ...state.story,
      setup: { ...state.story.setup, [field]: value }
    },
    isDirty: true
  }));
}

export function addTag(tag: string) {
  editorState.update(state => ({
    ...state,
    story: {
      ...state.story,
      tags: [...state.story.tags, tag]
    },
    isDirty: true
  }));
}

export function removeTag(tag: string) {
  editorState.update(state => ({
    ...state,
    story: {
      ...state.story,
      tags: state.story.tags.filter(t => t !== tag)
    },
    isDirty: true
  }));
}

// ─── Database Operations ────────────────────────
export async function loadStory(id: string): Promise<void> {
  await initializeDB();
  const storyData = await dbGetStory(id);
  
  if (!storyData) {
    throw new Error('Histoire non trouvée');
  }

  setStory({
    id: storyData.id,
    title: storyData.title,
    content: storyData.content,
    setup: storyData.setup,
    tags: storyData.tags,
    folderId: storyData.folderId,
    theme: storyData.theme
  });
}

export async function saveStory(): Promise<void> {
  const state = get(editorState);
  
  if (!state.story.id) {
    throw new Error('Impossible de sauvegarder: ID manquant');
  }

  await dbUpdateStory(state.story.id, {
    title: state.story.title,
    content: state.story.content,
    setup: state.story.setup,
    tags: state.story.tags,
    folderId: state.story.folderId,
    theme: state.story.theme
  });

  editorState.update(s => ({
    ...s,
    isDirty: false,
    lastSaved: new Date()
  }));
}

export async function createStory(setup: StorySetup): Promise<Story> {
  await initializeDB();
  
  const newStory = await dbCreateStory({
    title: 'Nouvelle Histoire',
    content: '',
    setup,
    tags: [],
    folderId: undefined,
    theme: undefined
  });

  setStory({
    id: newStory.id,
    title: newStory.title,
    content: newStory.content,
    setup: newStory.setup,
    tags: newStory.tags,
    folderId: newStory.folderId,
    theme: newStory.theme
  });

  return newStory;
}

// ─── Auto-save ─────────────────────────────────
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSave(intervalMs = 30000) {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  
  autoSaveInterval = setInterval(async () => {
    const state = get(editorState);
    if (state.isDirty && state.story.id) {
      try {
        await saveStory();
      } catch (error) {
        logger.error('editor-store: auto-save échoué.', error);
      }
    }
  }, intervalMs);
}

export function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}