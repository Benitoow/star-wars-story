import { browser } from '$app/environment';

export type UiLanguageCode = 'auto' | 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'zh';

export interface LanguageOption {
  code: UiLanguageCode;
  name: string;
}

export const UI_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'auto', name: 'Auto (navigateur)' },
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' }
];

type ConcreteLanguage = Exclude<UiLanguageCode, 'auto'>;
const SUPPORTED: ConcreteLanguage[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

export function detectBrowserLanguage(): ConcreteLanguage {
  if (!browser) return 'fr';
  const candidates = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base as ConcreteLanguage)) return base as ConcreteLanguage;
  }
  return 'fr';
}

export function resolveUiLanguage(code?: string | null): ConcreteLanguage {
  if (!code || code === 'auto') return detectBrowserLanguage();
  const normalized = code.toLowerCase() as ConcreteLanguage;
  return SUPPORTED.includes(normalized) ? normalized : detectBrowserLanguage();
}

export function getLanguageLabel(code: UiLanguageCode | string | null | undefined): string {
  return UI_LANGUAGE_OPTIONS.find((l) => l.code === code)?.name || 'Auto (navigateur)';
}
