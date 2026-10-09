import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from './locales/en.json';
import vietnamese from './locales/vi.json';

export const LANGUAGE_STORAGE_KEY = 'nurfia_language';
export type AppLanguage = 'en' | 'vi';
export function getInitialLanguage(): AppLanguage {
  try { return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'vi' ? 'vi' : 'en'; }
  catch { return 'en'; }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: english }, vi: { translation: vietnamese } },
  lng: getInitialLanguage(), fallbackLng: 'en', supportedLngs: ['en', 'vi'],
  keySeparator: false, nsSeparator: false, initAsync: false,
  interpolation: { escapeValue: false }, react: { useSuspense: false },
});

const syncLanguage = (language: string) => {
  const next = language.startsWith('vi') ? 'vi' : 'en';
  document.documentElement.lang = next;
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Storage can be unavailable in private browsing. */ }
};
i18n.on('languageChanged', syncLanguage);
syncLanguage(i18n.language);
window.addEventListener('storage', event => {
  if (event.key === LANGUAGE_STORAGE_KEY && (event.newValue === 'en' || event.newValue === 'vi')) void i18n.changeLanguage(event.newValue);
});

/** English interface copy falls back unchanged; product/customer content is not passed here. */
export function translateUi(value: string | number | null | undefined, options?: Record<string, unknown>): string {
  if (value == null) return '';
  const key = String(value);
  const translated = i18n.language.startsWith('vi') && !Object.hasOwn(vietnamese, key)
    ? caseInsensitiveKeys.get(key.toLowerCase()) || key : key;
  return String(i18n.t(translated, options || {}));
}
const caseInsensitiveKeys = new Map(Object.keys(vietnamese).map(key => [key.toLowerCase(), key]));
export const getLocale = () => i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US';
export default i18n;
