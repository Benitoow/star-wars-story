import { browser } from '$app/environment';

export type UiLanguageCode = 'auto' | 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'zh';

export interface LanguageOption {
  code: UiLanguageCode;
  name: string;
}

export const UI_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'auto', name: 'Auto-détection' },
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' }
];

const SUPPORTED_LANGUAGE_CODES: Exclude<UiLanguageCode, 'auto'>[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

const LANGUAGE_ALIASES: Record<string, Exclude<UiLanguageCode, 'auto'>> = {
  fr: 'fr',
  en: 'en',
  es: 'es',
  de: 'de',
  it: 'it',
  pt: 'pt',
  ja: 'ja',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh'
};

export function detectBrowserLanguage(): Exclude<UiLanguageCode, 'auto'> {
  if (!browser) return 'fr';

  const candidates = [
    ...(navigator.languages || []),
    navigator.language,
    document.documentElement.lang
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const exactMatch = LANGUAGE_ALIASES[normalized];
    if (exactMatch) return exactMatch;

    const base = normalized.split('-')[0];
    if (SUPPORTED_LANGUAGE_CODES.includes(base as Exclude<UiLanguageCode, 'auto'>)) {
      return base as Exclude<UiLanguageCode, 'auto'>;
    }
  }

  return 'fr';
}

export function resolveUiLanguage(code?: string | null): Exclude<UiLanguageCode, 'auto'> {
  if (!code || code === 'auto') {
    return detectBrowserLanguage();
  }

  const normalized = code.toLowerCase() as UiLanguageCode;
  if (SUPPORTED_LANGUAGE_CODES.includes(normalized as Exclude<UiLanguageCode, 'auto'>)) {
    return normalized as Exclude<UiLanguageCode, 'auto'>;
  }

  return detectBrowserLanguage();
}

export function getLanguageLabel(code: UiLanguageCode | string | null | undefined): string {
  if (!code) return 'Auto-détection';
  const option = UI_LANGUAGE_OPTIONS.find(language => language.code === code);
  return option?.name || 'Auto-détection';
}
