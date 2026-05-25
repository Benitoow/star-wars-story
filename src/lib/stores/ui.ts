import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// ─── Theme ──────────────────────────────────────────────
// app.css defaults to dark (:root); light is opt-in via [data-theme="light"].
export type Theme = 'dark' | 'light';
const THEME_KEY = 'sw_theme';

function readStoredTheme(): Theme {
  if (!browser) return 'dark';
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(value: Theme): void {
  if (browser) document.documentElement.setAttribute('data-theme', value);
}

function createTheme() {
  const { subscribe, set } = writable<Theme>(readStoredTheme());
  return {
    subscribe,
    init() {
      const value = readStoredTheme();
      applyTheme(value);
      set(value);
    },
    set(value: Theme) {
      if (browser) localStorage.setItem(THEME_KEY, value);
      applyTheme(value);
      set(value);
    },
    toggle() {
      this.set(readStoredTheme() === 'light' ? 'dark' : 'light');
    }
  };
}

export const theme = createTheme();

// ─── Toasts ─────────────────────────────────────────────
export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

function createToasts() {
  const { subscribe, update } = writable<Toast[]>([]);
  let nextId = 1;

  function dismiss(id: number): void {
    update((list) => list.filter((t) => t.id !== id));
  }

  function show(message: string, kind: ToastKind = 'info', durationMs = 3500): number {
    const id = nextId++;
    update((list) => [...list, { id, message, kind }]);
    if (browser && durationMs > 0) {
      window.setTimeout(() => dismiss(id), durationMs);
    }
    return id;
  }

  return { subscribe, show, dismiss };
}

export const toasts = createToasts();
