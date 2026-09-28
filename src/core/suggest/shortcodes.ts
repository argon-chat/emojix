import data from '../../data/shortcodes.json';
import { findExact, lowerBound } from './search';
import type { ShortcodeData, ShortcodeMatch } from './types';

const CODES = (data as ShortcodeData).codes;
const SHORTCODE = /^[a-z0-9_+-]+$/;
/** Added to `unmatched` of a word-prefix match, so plain prefix matches rank above it. */
const WORD_PREFIX_PENALTY = 4;

/** The words of every code, split on first use. */
let codeWords: string[][] | undefined;

/**
 * The query is a concatenation of non-empty prefixes of some of the words, taken in order:
 * "thup" is thumbs_up (th + up). Backtracking over (query position, word) with failed states memoised.
 */
function isWordPrefixConcatenation(query: string, words: readonly string[]): boolean {
  let failed: Set<number> | undefined;
  const from = (at: number, firstWord: number): boolean => {
    if (at === query.length) return true;
    const state = at * (words.length + 1) + firstWord;
    if (failed?.has(state)) return false;
    for (let w = firstWord; w < words.length; w++) {
      const word = words[w]!;
      let common = 0;
      while (common < word.length && at + common < query.length && word[common] === query[at + common]) common++;
      for (let length = common; length > 0; length--) if (from(at + length, w + 1)) return true;
    }
    (failed ??= new Set()).add(state);
    return false;
  };
  return from(0, 0);
}

interface Candidate {
  match: ShortcodeMatch;
  /** Index in CODES: a code claimed by two emoji lists the higher-priority source first. */
  rank: number;
}

/** Exact, least unmatched, code. */
function compare(a: Candidate, b: Candidate): number {
  const [x, y] = [a.match, b.match];
  const exact = x.exact === y.exact ? 0 : x.exact ? -1 : 1;
  const code = x.code === y.code ? 0 : x.code < y.code ? -1 : 1;
  return exact || x.unmatched - y.unmatched || code || a.rank - b.rank;
}

/**
 * Shortcodes for a query typed after ":" — by prefix ("jo" → joy) and, from 3 characters, by word
 * prefixes ("thup" → thumbs_up). One match per emoji, the best first.
 */
export function matchShortcodes(query: string, limit = 32): ShortcodeMatch[] {
  const q = query.toLowerCase();
  if (!SHORTCODE.test(q) || limit <= 0) return [];
  const best = new Map<string, Candidate>();
  const offer = (rank: number, unmatched: number) => {
    const [code, hexcode] = CODES[rank]!;
    const candidate: Candidate = { match: { hexcode, code, exact: unmatched === 0, unmatched }, rank };
    const current = best.get(hexcode);
    if (!current || compare(candidate, current) < 0) best.set(hexcode, candidate);
  };

  for (let i = lowerBound(CODES, q); i < CODES.length && CODES[i]![0].startsWith(q); i++) {
    offer(i, CODES[i]![0].length - q.length);
  }
  if (q.length >= 3) {
    codeWords ??= CODES.map(([code]) => code.split('_'));
    codeWords.forEach((words, i) => {
      const code = CODES[i]![0];
      if (words.length > 1 && !code.startsWith(q) && isWordPrefixConcatenation(q, words)) {
        offer(i, code.length - q.length + WORD_PREFIX_PENALTY);
      }
    });
  }

  return [...best.values()].sort(compare).slice(0, limit).map((c) => c.match);
}

/** The emoji of a whole shortcode, without its colons ("joy"), or null. */
export function shortcodeExact(code: string): string | null {
  const i = findExact(CODES, code.toLowerCase());
  return i >= 0 ? CODES[i]![1] : null;
}
