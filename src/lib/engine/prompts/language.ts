const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'FRANÇAIS',
  en: 'ENGLISH',
  es: 'ESPAÑOL',
  de: 'DEUTSCH',
  it: 'ITALIANO',
  pt: 'PORTUGUÊS',
  ja: '日本語 (JAPANESE)',
  zh: '中文 (CHINESE)'
};

export function languageName(code?: string): string {
  return LANGUAGE_NAMES[(code || 'fr').toLowerCase().trim()] || 'FRANÇAIS';
}

/** Hard language lock — every generated string must be in the target language. */
export function languageInstruction(code?: string): string {
  const lang = languageName(code);
  return `LANGUE OBLIGATOIRE — ${lang} : tout le texte que tu génères (chapter_title, narrative.action, narrative.dialogue, narrative.reflection, atmosphere, et chaque choices[].text) doit être rédigé ENTIÈREMENT EN ${lang}, quelle que soit la langue de la prémisse, de la mémoire ou de l'action du joueur. Ne change JAMAIS de langue.`;
}
