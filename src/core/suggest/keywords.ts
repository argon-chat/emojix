import { findExact, lowerBound } from './search';
import { stemPhrase } from './stem';
import type { KeywordIndexData, KeywordMatch } from './types';

// Asset URLs, fetched rather than import()ed: a module is never unloaded, so imported data could
// never be freed by releaseKeywordIndexes().
const FILES = import.meta.glob<string>('../../data/keywords/*.json', { query: '?url', import: 'default', eager: true });
const URLS = new Map(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), url]),
);

/** Every locale with a keyword index (emojibase ids: "en", "en-gb", "ru", "zh-hant", …). */
export const SUGGEST_LOCALES: readonly string[] = Object.freeze([...URLS.keys()].sort());

type Entries = KeywordIndexData['keys'];

interface Candidate {
  match: KeywordMatch;
  /** Position in its key's hexcode list: strongest match first (see KeywordIndexData). */
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

/**
 * Loads in flight and loaded, by locale. Written only when a load starts, so one still in flight
 * at releaseKeywordIndexes() cannot put its index back.
 */
const loaded = new Map<string, Promise<KeywordIndex>>();

async function fetchIndex(url: string): Promise<KeywordIndex> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new KeywordIndex((await response.json()) as KeywordIndexData);
}

/** The index of a locale in SUGGEST_LOCALES, fetched on first use and kept until releaseKeywordIndexes(). */
export function loadKeywordIndex(locale: string): Promise<KeywordIndex> {
  const cached = loaded.get(locale);
  if (cached) return cached;
  const url = URLS.get(locale);
  if (url === undefined) return Promise.reject(new Error(`No emoji keywords for locale "${locale}"`));
  const promise = fetchIndex(url);
  loaded.set(locale, promise);
  // A failed fetch is retried on the next call; the identity check leaves a newer load alone.
  promise.catch(() => loaded.get(locale) === promise && loaded.delete(locale));
  return promise;
}

/** Drops every index, loaded or loading, so its data can be collected; the next load fetches again. */
export function releaseKeywordIndexes(): void {
  loaded.clear();
}
