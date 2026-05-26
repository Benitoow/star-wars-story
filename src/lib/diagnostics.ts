/* Full per-story diagnostics export — share it to debug what works and what
   doesn't. Bundles setup, the entire session (every turn, world state, actions,
   memory), generation settings (API key REDACTED) and the recent event log. */
import { browser } from '$app/environment';
import { getLogs } from '$lib/logger';
import { getPreferences, getStory, loadSession } from '$lib/persistence';
import { APP_EDITION, APP_VERSION } from '$lib/version';

export async function buildStoryDiagnostics(storyId: string): Promise<string> {
  const [story, session, prefs] = await Promise.all([getStory(storyId), loadSession(storyId), getPreferences()]);
  const { textApiKey, ...safePrefs } = prefs;

  const payload = {
    app: 'Star Wars Story',
    version: `${APP_VERSION} (${APP_EDITION})`,
    exportedAt: new Date().toISOString(),
    story: story
      ? { id: story.id, title: story.title, setup: story.setup, turnCount: story.turnCount, createdAt: story.createdAt }
      : null,
    session, // world state + every chapter + action/memory history
    preferences: { ...safePrefs, textApiKey: textApiKey ? '[redacted]' : '' },
    logs: getLogs()
  };
  return JSON.stringify(payload, null, 2);
}

function downloadJson(filename: string, content: string): void {
  if (!browser) return;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Build + download the diagnostics file for a story. */
export async function exportStoryDiagnostics(storyId: string): Promise<void> {
  const json = await buildStoryDiagnostics(storyId);
  downloadJson(`sw-diagnostic-${storyId.slice(0, 8)}-${Date.now()}.json`, json);
}
