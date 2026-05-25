import { db, DEFAULT_PREFERENCES, type Preferences } from './db';

export async function getPreferences(): Promise<Preferences> {
  const stored = await db.preferences.get('preferences');
  return { ...DEFAULT_PREFERENCES, ...(stored ?? {}), id: 'preferences' };
}

export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const next: Preferences = { ...(await getPreferences()), ...patch, id: 'preferences' };
  await db.preferences.put(next);
  return next;
}
