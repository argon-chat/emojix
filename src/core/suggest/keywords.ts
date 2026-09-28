import { findExact, lowerBound } from './search';
import { stemPhrase } from './stem';
import type { KeywordIndexData, KeywordMatch } from './types';

const FILES = import.meta.glob<KeywordIndexData>('../../data/keywords/*.json', { import: 'default' });
const LOADERS = new Map(
  Object.entries(FILES).map(([path, load]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), load]),
);

/** Every locale with a keyword index (emojibase ids: "en", "en-gb", "ru", "zh-hant", …). */
export const SUGGEST_LOCALES: readonly string[] = Object.freeze([...LOADERS.keys()].sort());

type Entries = KeywordIndexData['keys'];

interface Candidate {
  match: KeywordMatch;
  /** Position in its key's hexcode list: emoji order. */
  rank: number;
}

/** Calls `visit` for every entry whose key starts with `prefix`. */
function scanPrefix(entries: Entries, prefix: string, visit: (key: string, hexcodes: readonly string[]) => void) {
  for (let i = lowerBound(entries, prefix); i < entries.length && entries[i]![0].startsWith(prefix); i++) {
    visit(entries[i]![0], entries[i]![1]);
  }
}

const byExact = (x: KeywordMatch, y: KeywordMatch) => (x.exact === y.exact ? 0 : x.exact ? -1 : 1);
const byKind = (x: KeywordMatch, y: KeywordMatch) => (x.kind === y.kind ? 0 : x.kind === 'keyword' ? -1 : 1);
const byKey = (x: KeywordMatch, y: KeywordMatch) => (x.key === y.key ? 0 : x.key < y.key ? -1 : 1);

/** Which match of one emoji to keep: exact, least unmatched, keyword over stem. */
function preferred(a: Candidate, b: Candidate): number {
  const [x, y] = [a.match, b.match];
  return byExact(x, y) || x.unmatched - y.unmatched || byKind(x, y) || byKey(x, y) || a.rank - b.rank;
}

/** Result order: exact, least unmatched, key. */
function compare(a: Candidate, b: Candidate): number {
  const [x, y] = [a.match, b.match];
  return byExact(x, y) || x.unmatched - y.unmatched || byKey(x, y) || byKind(x, y) || a.rank - b.rank;
}

/** The emoji keywords of one locale (see scripts/build-keywords.ts). Queries are normalizeQuery()'d. */
export class KeywordIndex {
  readonly locale: string;
  /** Length of the longest key, in code units. */
  readonly longestKey: number;
  private readonly keys: Entries;
  private readonly stems: Entries;

  constructor(data: KeywordIndexData) {
    this.locale = data.locale;
    this.keys = data.keys;
    this.stems = data.stems;
    let longest = 0;
    for (const [key] of data.keys) longest = Math.max(longest, key.length);
    this.longestKey = longest;
  }

  /**
   * Emoji whose key starts with the query, or whose stem starts with the query's stem (or is a
   * prefix of it, from 3 characters: "котики" → "котик" finds "кот"). One match per emoji, the best;
   * exact first, then by how much of the key is left over.
   */
  matchPrefix(query: string, limit = 64): KeywordMatch[] {
    if (!query || limit <= 0) return [];
    const best = new Map<string, Candidate>();
    const offer = (key: string, hexcodes: readonly string[], kind: KeywordMatch['kind'], unmatched: number) => {
      hexcodes.forEach((hexcode, rank) => {
        const candidate: Candidate = {
          match: { hexcode, key, kind, exact: unmatched === 0, unmatched, locale: this.locale },
          rank,
        };
        const current = best.get(hexcode);
        if (!current || preferred(candidate, current) < 0) best.set(hexcode, candidate);
      });
    };

    scanPrefix(this.keys, query, (key, hexcodes) => offer(key, hexcodes, 'keyword', key.length - query.length));
    if (this.stems.length) {
      const stemmed = stemPhrase(query, this.locale);
      scanPrefix(this.stems, stemmed, (key, hexcodes) => offer(key, hexcodes, 'stem', key.length - stemmed.length));
      for (let n = 3; n < stemmed.length; n++) {
        const i = findExact(this.stems, stemmed.slice(0, n));
        if (i >= 0) offer(this.stems[i]![0], this.stems[i]![1], 'stem', stemmed.length - n);
      }
    }

    return [...best.values()].sort(compare).slice(0, limit).map((c) => c.match);
  }

  /** Emoji with a key equal to the query, then those whose stem equals the query's. */
  matchExact(query: string): KeywordMatch[] {
    const out: KeywordMatch[] = [];
    const locale = this.locale;
    const i = findExact(this.keys, query);
    if (i >= 0) {
      for (const hexcode of this.keys[i]![1]) out.push({ hexcode, key: query, kind: 'keyword', exact: true, unmatched: 0, locale });
    }
    if (this.stems.length) {
      const stemmed = stemPhrase(query, locale);
      const j = findExact(this.stems, stemmed);
      if (j >= 0) {
        const seen = new Set(out.map((m) => m.hexcode));
        for (const hexcode of this.stems[j]![1]) {
          if (!seen.has(hexcode)) out.push({ hexcode, key: stemmed, kind: 'stem', exact: true, unmatched: 0, locale });
        }
      }
    }
    return out;
  }
}

const loaded = new Map<string, Promise<KeywordIndex>>();

/** The index of a locale in SUGGEST_LOCALES, fetched on first use and kept. */
export function loadKeywordIndex(locale: string): Promise<KeywordIndex> {
  const cached = loaded.get(locale);
  if (cached) return cached;
  const load = LOADERS.get(locale);
  if (!load) return Promise.reject(new Error(`No emoji keywords for locale "${locale}"`));
  const promise = load().then((data) => new KeywordIndex(data));
  loaded.set(locale, promise);
  // A failed fetch (offline, a stale chunk) is retried on the next call.
  promise.catch(() => loaded.get(locale) === promise && loaded.delete(locale));
  return promise;
}
