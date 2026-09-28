import data from '../../data/emoticons.json';
import type { Emoticon, EmoticonData } from './types';

export const EMOTICONS: readonly Emoticon[] = Object.freeze(
  (data as EmoticonData).items.map(([text, hexcode]) => ({ text, hexcode, immediate: !/\p{L}$/u.test(text) })),
);

const LONGEST_FIRST = [...EMOTICONS].sort((a, b) => b.text.length - a.text.length);

/**
 * The longest emoticon that ends `text` and starts it or follows whitespace ("hello :)"), exactly
 * as typed; null when there is none ("a:)").
 */
export function emoticonBefore(text: string): { emoticon: Emoticon; start: number } | null {
  for (const emoticon of LONGEST_FIRST) {
    if (!text.endsWith(emoticon.text)) continue;
    const start = text.length - emoticon.text.length;
    if (start === 0 || /\s/.test(text[start - 1]!)) return { emoticon, start };
  }
  return null;
}
