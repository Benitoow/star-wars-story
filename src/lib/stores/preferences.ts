import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { DEFAULT_PREFERENCES, getPreferences, savePreferences, type Preferences } from '$lib/persistence';

function applyTheme(theme: Preferences['theme']): void {
  if (browser) document.documentElement.setAttribute('data-theme', theme);
}

function createPreferences() {
  const { subscribe, set } = writable<Preferences>({ ...DEFAULT_PREFERENCES });

  return {
    subscribe,
    /** Load persisted preferences into the store (browser boot). */
    async load(): Promise<Preferences> {
      const prefs = await getPreferences();
      applyTheme(prefs.theme);
      set(prefs);
      return prefs;
    },
    /** Persist a partial change and reflect it in the store. */
    async update(patch: Partial<Preferences>): Promise<Preferences> {
      const next = await savePreferences(patch);
      if (patch.theme) applyTheme(next.theme);
      set(next);
      return next;
    }
  };
}

export const preferences = createPreferences();
