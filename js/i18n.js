/** Offline game text. Changing language reloads from the menu, not the save data. */
import catalogs from './locale-catalogs.js';

export const LOCALE_KEY = 'bird-view.locale';
export const LANGUAGES = Object.freeze([
  { id: 'zh-Hant', label: '繁體中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'ko', label: '한국어' },
]);
export function normalizeLocale(value) {
  return LANGUAGES.some(l => l.id === value) ? value : 'zh-Hant';
}
let locale = 'zh-Hant';
try { locale = normalizeLocale(globalThis.localStorage?.getItem(LOCALE_KEY)); } catch {}
export const getLocale = () => locale;

/** Source strings are keys; numbered placeholders permit different word orders. */
export function t(source, values = []) {
  const text = locale === 'zh-Hant' ? source : catalogs[locale]?.[source] ?? source;
  return String(text ?? '').replace(/\{(\d+)\}/g, (token, index) =>
    index < values.length ? String(values[index] ?? '') : token);
}

/** Invalid values are rejected. Return false for an unchanged language. */
export function setLocale(value) {
  if (!LANGUAGES.some(l => l.id === value)) throw new RangeError('Unsupported locale');
  if (value === locale) return false;
  // A URL fallback keeps the setting usable when browser storage is disabled.
  try { globalThis.localStorage?.setItem(LOCALE_KEY, value); } catch {}
  const url = new URL(location.href);
  url.searchParams.set('lang', value);
  location.replace(url.href);
  return true;
}

// URL is a fallback for unavailable storage and also supports shareable language links.
if (typeof location !== 'undefined') {
  const requested = new URL(location.href).searchParams.get('lang');
  if (LANGUAGES.some(l => l.id === requested)) {
    locale = requested;
    try { globalThis.localStorage?.setItem(LOCALE_KEY, locale); } catch {}
  }
}
export function applyStaticTranslations(root = document) {
  document.documentElement.lang = locale;
  document.title = t('走，賞鳥趣');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
}
