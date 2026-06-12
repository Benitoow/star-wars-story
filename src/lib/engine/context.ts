/* ═══════════════════════════════════════════════
   Context builder — keep the raw recent history as long
   as it fits the token budget, compress only the overflow
   (oldest turns) into a campaign archive. The opposite of
   summarizing from turn 1: a big-context model gets the
   real prose, a small one stays within budget.
══════════════════════════════════════════════ */
import { cleanText } from './text';
import { summarizeChapterForPrompt } from './prompts/system';
import type { ChatMessage, StoryChapter } from './types';

// Token budget for the RAW transcript (≈ chars / 4). Tuned in settings; this
// default is safe for common models while already far richer than summaries.
export const DEFAULT_CONTEXT_BUDGET = 200000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The scene as the player saw it (prose + dialogue), used as the assistant turn. */
export function chapterToScene(chapter: StoryChapter): string {
  const parts = [cleanText(chapter.narrative.action, 6000)];
  if (chapter.narrative.dialogue) parts.push(cleanText(chapter.narrative.dialogue, 3000));
  if (chapter.narrative.reflection) parts.push(cleanText(chapter.narrative.reflection, 1500));
  return parts.filter(Boolean).join('\n\n');
}

export interface NarrativeContext {
  transcript: ChatMessage[]; // raw recent turns (user action / assistant scene)
  archive: string[];         // compressed older turns that didn't fit the budget
}

/**
 * Pair chapters with the actions that produced them, then keep the most recent
 * turns raw within `budgetTokens`; everything older is summarized into `archive`.
 *
 * History shape: chapter[0] is the opening (no action); chapter[k>0] was produced
 * by actionHistory[k-1].
 */
export function buildNarrativeContext(
  chapterHistory: StoryChapter[],
  actionHistory: string[],
  budgetTokens: number = DEFAULT_CONTEXT_BUDGET
): NarrativeContext {
  if (!chapterHistory.length) return { transcript: [], archive: [] };

  type Unit = { messages: ChatMessage[]; chapter: StoryChapter; cost: number };
  const units: Unit[] = chapterHistory.map((chapter, i) => {
    const messages: ChatMessage[] = [];
    if (i > 0) {
      const action = cleanText(actionHistory[i - 1], 600);
      if (action) messages.push({ role: 'user', content: action });
    }
    messages.push({ role: 'assistant', content: chapterToScene(chapter) });
    const cost = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    return { messages, chapter, cost };
  });

  // Walk from the newest unit backward, keeping whole turns within budget.
  // Always keep at least the most recent turn, even if it alone exceeds budget.
  let used = 0;
  let keepFrom = units.length;
  for (let i = units.length - 1; i >= 0; i -= 1) {
    if (used + units[i].cost > budgetTokens && keepFrom < units.length) break;
    used += units[i].cost;
    keepFrom = i;
  }

  const archive = units.slice(0, keepFrom).map((u) => summarizeChapterForPrompt(u.chapter));
  const transcript = units.slice(keepFrom).flatMap((u) => u.messages);
  return { transcript, archive };
}

// Grammatical 6+ letter words to ignore (connectors, not imagery).
const STOP_TERMS = new Set([
  'toujours', 'pendant', 'devant', 'derrière', 'derriere', 'encore', 'autour', 'contre',
  'lorsque', 'ensuite', 'pourtant', 'cependant', 'désormais', 'desormais', 'aussitôt',
  'aussitot', 'comme', 'parmi', 'malgré', 'malgre', 'tandis', 'puisque'
]);
const TERM_RE = /[a-zà-öø-ÿ]{6,}/gi;

/**
 * Words a model has leaned on across recent scenes (e.g. "pourpre" every turn).
 * Data-driven — counts how many distinct scenes each word appears in — so it
 * generalizes to any stylistic tic instead of hardcoding a banned list.
 */
export function detectOverusedTerms(
  chapters: StoryChapter[],
  { scenes = 8, minScenes = 3, max = 6 } = {}
): string[] {
  const recent = chapters.slice(-scenes);
  if (recent.length < minScenes) return [];

  const scenesPerWord = new Map<string, number>();
  for (const chapter of recent) {
    const text = `${chapter.narrative.action}\n${chapter.narrative.dialogue}\n${chapter.narrative.reflection}`.toLowerCase();
    const seen = new Set(text.match(TERM_RE) ?? []);
    for (const word of seen) {
      if (!STOP_TERMS.has(word)) scenesPerWord.set(word, (scenesPerWord.get(word) ?? 0) + 1);
    }
  }

  const threshold = Math.max(minScenes, Math.ceil(recent.length * 0.5));
  return [...scenesPerWord.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}
