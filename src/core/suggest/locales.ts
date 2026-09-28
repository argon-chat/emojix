import { SUGGEST_LOCALES } from './keywords';

const MAX_LOCALES = 4;

/** Language ids that are not the emojibase one: the app's "jp", Norwegian. */
const LANGUAGE_ALIASES = new Map([
  ['jp', 'ja'],
  ['no', 'nb'],
  ['nn', 'nb'],
]);

const TRADITIONAL_CHINESE = new Set(['hant', 'tw', 'hk', 'mo']);

/** The SUGGEST_LOCALES member for an app locale id ("ru_pt") or a BCP 47 tag ("en-US"), or null. */
function toSuggestLocale(tag: string): string | null {
  const id = tag.toLowerCase().replaceAll('_', '-');
  const [first = '', ...rest] = id.split('-');
  const language = LANGUAGE_ALIASES.get(first) ?? first;
  let locale: string;
  if (language === 'zh') locale = rest.some((part) => TRADITIONAL_CHINESE.has(part)) ? 'zh-hant' : 'zh';
  else locale = SUGGEST_LOCALES.includes(id) ? id : language;
  return SUGGEST_LOCALES.includes(locale) ? locale : null;
}

/**
 * The keyword locales to search: the UI locale, then the browser's languages, deduplicated and
 * limited to MAX_LOCALES, always with "en" (people type English words whatever the UI language).
 */
export function resolveSuggestLocales(uiLocale: string, navigatorLanguages: readonly string[]): string[] {
  const locales: string[] = [];
  for (const tag of [uiLocale, ...navigatorLanguages]) {
    const locale = toSuggestLocale(tag);
    if (locale && !locales.includes(locale)) locales.push(locale);
  }
  const en = locales.indexOf('en');
  if (en >= 0 && en < MAX_LOCALES) return locales.slice(0, MAX_LOCALES);
  return [...locales.filter((l) => l !== 'en').slice(0, MAX_LOCALES - 1), 'en'];
}
