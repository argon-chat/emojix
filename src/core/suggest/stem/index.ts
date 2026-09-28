import { stemEnglish } from './english';
import { stemRussian } from './russian';

/** Locales with a stemmer; every other one stems to the word itself. */
export function hasStemmer(locale: string): boolean {
  return locale === 'ru' || locale === 'en' || locale === 'en-gb';
}

/** Snowball stem of a normalised (lower-case) word: Russian for ru, Porter2 for en and en-gb. */
export function stem(word: string, locale: string): string {
  switch (locale) {
    case 'ru':
      return stemRussian(word);
    case 'en':
    case 'en-gb':
      return stemEnglish(word);
    default:
      return word;
  }
}

/** stem() of every space-separated word of a normalised phrase. */
export function stemPhrase(phrase: string, locale: string): string {
  if (!hasStemmer(locale)) return phrase;
  return phrase.includes(' ') ? phrase.split(' ').map((word) => stem(word, locale)).join(' ') : stem(phrase, locale);
}
