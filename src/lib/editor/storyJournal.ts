import type { StorySetup } from '$lib/stores/editor';
import type { StoryChapter } from '$lib/ai/storyEngine';
import { ERAS } from '$lib/editor/setupCatalog';

export function chapterToJournalMarkdown(chapter: StoryChapter, index: number): string {
  const lines: string[] = [];
  lines.push(`## Chapitre ${chapter.chapter_number || index + 1} — ${chapter.chapter_title}`);

  if (chapter.narrative.context) lines.push(`**Contexte**\n${chapter.narrative.context}`);
  if (chapter.narrative.action) lines.push(`**Action**\n${chapter.narrative.action}`);
  if (chapter.narrative.dialogue) lines.push(`**Dialogue**\n${chapter.narrative.dialogue}`);
  if (chapter.narrative.reflection) lines.push(`**Réflexion**\n${chapter.narrative.reflection}`);

  if (chapter.choices.length) {
    lines.push('**Choix proposés**');
    chapter.choices.forEach((choice, choiceIndex) => {
      lines.push(`${choiceIndex + 1}. ${choice.text} [${choice.attribute} · diff ${choice.difficulty}]`);
    });
  }

  if (chapter.memory_updates.notes.length) {
    lines.push(`**Mémoire (notes)**\n- ${chapter.memory_updates.notes.join('\n- ')}`);
  }

  return lines.join('\n\n');
}

export function buildJournalContent(chapterHistory: StoryChapter[]): string {
  if (!chapterHistory.length) return '';
  return chapterHistory.map((chapter, index) => chapterToJournalMarkdown(chapter, index)).join('\n\n---\n\n');
}

export function buildStoryTitle(setup: StorySetup): string {
  const eraLabel = ERAS.find(era => era.id === setup.era)?.name || 'Star Wars';
  const firstName = (setup.protagonistFirstName || '').trim();
  const lastName = (setup.protagonistLastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName ? `${fullName} — ${eraLabel}` : `Chroniques ${eraLabel}`;
}
