/* ═══════════════════════════════════════════════
   UI Store — Theme, Sidebar, Modals
══════════════════════════════════════════════ */
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getPreferences } from '$db';
import { resolveUiLanguage, type UiLanguageCode } from '$lib/config/languages';

// ─── Theme ───────────────────────────────────
function createThemeStore() {
  const { subscribe, set, update } = writable<'light' | 'dark' | 'auto'>('dark');

  return {
    subscribe,
    set: (value: 'light' | 'dark' | 'auto') => {
      set(value);
      if (browser) {
        applyTheme(value);
        savePreference('theme', value);
      }
    },
    init: async () => {
      if (browser) {
        const prefs = await getPreferences();
        set(prefs.theme || 'dark');
        applyTheme(prefs.theme || 'dark');
      }
    }
  };
}

function applyTheme(theme: 'light' | 'dark' | 'auto') {
  if (!browser) return;

  let actualTheme = theme;
  if (theme === 'auto') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', actualTheme);
}

async function savePreference(key: string, value: any) {
  const { savePreferences } = await import('$db');
  savePreferences({ [key]: value });
}

export const theme = createThemeStore();

// ─── UI Language ───────────────────────────
function createUiLanguageStore() {
  const { subscribe, set } = writable<UiLanguageCode>('auto');

  function applyLanguage(code: UiLanguageCode) {
    if (!browser) return;
    document.documentElement.lang = resolveUiLanguage(code);
  }

  return {
    subscribe,
    set: (value: UiLanguageCode) => {
      set(value);
      applyLanguage(value);
      if (browser) {
        savePreference('uiLanguage', value);
      }
    },
    init: async () => {
      if (!browser) return;

      const prefs = await getPreferences();
      const saved = prefs.uiLanguage || 'auto';

      set(saved);
      applyLanguage(saved);
    }
  };
}

export const uiLanguage = createUiLanguageStore();

// ─── Sidebar ────────────────────────────────
export const sidebarOpen = writable(true);
export const sidebarCollapsed = writable(false);

export function toggleSidebar() {
  sidebarOpen.update(v => !v);
}

// ─── Modals ───────────────────────────────
interface ModalState {
  isOpen: boolean;
  type: string | null;
  data?: any;
}

function createModalStore() {
  const { subscribe, set, update } = writable<ModalState>({
    isOpen: false,
    type: null,
    data: null
  });

  return {
    subscribe,
    open: (type: string, data?: any) => {
      set({ isOpen: true, type, data });
    },
    close: () => {
      set({ isOpen: false, type: null, data: null });
    },
    updateData: (data: any) => {
      update(s => ({ ...s, data }));
    }
  };
}

export const modal = createModalStore();

// ─── Toasts ────────────────────────────────
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function pushToast(toast: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    const newToast = { ...toast, id };

    update(toasts => [...toasts, newToast]);

    const duration = toast.duration || 4000;
    if (duration > 0) {
      setTimeout(() => {
        update(toasts => toasts.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }

  return {
    subscribe,
    add: pushToast,
    remove: (id: string) => {
      update(toasts => toasts.filter(t => t.id !== id));
    },
    success: (message: string) => {
      return pushToast({ type: 'success', message });
    },
    error: (message: string) => {
      return pushToast({ type: 'error', message, duration: 6000 });
    }
  };
}

export const toasts = createToastStore();

export function showToast(message: string, type: Toast['type'] = 'info', duration?: number) {
  toasts.add({ type, message, ...(duration !== undefined ? { duration } : {}) });
}

// ─── Search ────────────────────────────────
export const searchQuery = writable('');
export const searchOpen = writable(false);

// ─── View Mode ─────────────────────────────
export const viewMode = writable<'grid' | 'list'>('grid');

// ─── Sort Options ──────────────────────────
export type SortOption = 'updatedAt' | 'createdAt' | 'title' | 'lastPlayedAt';

export const sortBy = writable<SortOption>('updatedAt');
export const sortDirection = writable<'asc' | 'desc'>('desc');

// ─── Filter Options ─────────────────────────
export interface Filters {
  era?: string;
  faction?: string;
  role?: string;
  tags: string[];
  folderId?: string;
}

export const filters = writable<Filters>({ tags: [] });

export function resetFilters() {
  filters.set({ tags: [] });
}

// ─── Selection ──────────────────────────────
export const selectedStories = writable<Set<string>>(new Set());

export function toggleSelection(id: string) {
  selectedStories.update(set => {
    const newSet = new Set(set);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return newSet;
  });
}

export function selectAll(ids: string[]) {
  selectedStories.set(new Set(ids));
}

export function clearSelection() {
  selectedStories.set(new Set());
}

// ─── Derived Stores ─────────────────────────
export const hasSelection = derived(
  selectedStories,
  $selected => $selected.size > 0
);

export const selectionCount = derived(
  selectedStories,
  $selected => $selected.size
);
