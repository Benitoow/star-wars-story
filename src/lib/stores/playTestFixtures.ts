/* Shared fixtures for the play-store tests. The vi.mock wiring itself cannot
   live here — Vitest hoists it per test file — so only the pure data moves. */
import type { StoryChapter, StoryTurnResult, WorldState } from '$lib/engine/types';

export const setup = { era: 'imperial', faction: 'rebels', role: 'smuggler', premise: 'x', language: 'fr' };

export function world(): WorldState {
  return {
    player: { hp: 100, credits: 100, location: 'Cantina', date: 'Jour 1', injuries: [], inventory: [], condition: 'active', skills: { combat: 2, diplomacy: 2, stealth: 2, tech: 2, force: 2, survival: 2 }, experience: 0, level: 1, criticalTurns: 0 },
    npcs: [{ name: 'Vela', affinity: 10, status: 'neutral', alive: true }],
    factions: {},
    chronology: [{ chapter: 1, date: 'Jour 1', location: 'Cantina', summary: 'Chap 1' }],
    campaign: { title: 'Fil rouge', objective: 'x', progress: 'Départ', status: 'active' },
    world_events: [],
    rumors: []
  };
}

export function chap(n: number): StoryChapter {
  return {
    chapter_title: `Chap ${n}`, chapter_number: n, section_type: 'action',
    narrative: { action: `Scène ${n}.`, dialogue: '', reflection: '', atmosphere: 'tense' },
    choices: [], memory_updates: { relations: [], places: [], injuries: [], resources: [], notes: [] }
  };
}

export function turnResult(n: number): StoryTurnResult {
  return { chapter: chap(n), worldState: world(), rawResponse: '{}', mode: 'structured-json' };
}

