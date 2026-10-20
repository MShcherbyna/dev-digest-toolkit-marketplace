import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { en, type Messages } from './en';
import { uk } from './uk';

export type Lang = 'en' | 'uk';
export type { Messages };

/** English is the main version at `#/…`; other languages live under `#/<lang>/…`. */
export const DEFAULT_LANG: Lang = 'en';
export const LANGS: Lang[] = ['en', 'uk'];
export const MESSAGES: Record<Lang, Messages> = { en, uk };

const I18nContext = createContext<Messages>(en);
export const I18nProvider = I18nContext.Provider;
export const useT = () => useContext(I18nContext);

const KEY = 'catalog-lang';

export function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return LANGS.includes(v as Lang) ? (v as Lang) : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // the choice just will not persist
  }
}
