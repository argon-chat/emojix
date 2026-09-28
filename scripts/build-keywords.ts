/**
 * Builds the data behind emoji suggestions while typing, from emojibase-data 17.
 *
 *   bun run scripts/build-keywords.ts
 *
 * Only emoji listed in src/data/emoji-data.json (scripts/build-atlases.ts) are indexed, by their
 * hexcode as written there; skin-tone variants and components are not.
 *
 * Output, checked in (labels and keywords are CLDR data: see src/data/keywords/NOTICE):
 *   src/data/keywords/{locale}.json   KeywordIndexData, one per emojibase locale
 *   src/data/shortcodes.json          ShortcodeData: the emojibase, GitHub and CLDR shortcodes
 *   src/data/emoticons.json           EmoticonData: emojibase's emoticons plus EXTRA_EMOTICONS
 */

import { existsSync } from 'fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { gzipSync } from 'zlib';
import type { CompactEmoji } from '../src/data/compact';
import type { EmoticonData, KeywordIndexData, ShortcodeData } from '../src/core/suggest/types';
import { normalizeQuery } from '../src/core/suggest/normalize';
import { hasStemmer, stemPhrase } from '../src/core/suggest/stem';

const ROOT = join(import.meta.dir, '..');
const DATA_DIR = join(ROOT, 'src/data');
const KEYWORDS_DIR = join(DATA_DIR, 'keywords');
const EMOJIBASE = dirname(Bun.resolveSync('emojibase-data/package.json', ROOT));

/** In priority order: on a code claimed by two emoji, the first source's comes first. */
const SHORTCODE_SOURCES = ['emojibase', 'github', 'cldr'];

const EXTRA_EMOTICONS: [string, string][] = [
  [':-)', '1F642'], [':-(', '2639'], [':(', '2639'], [":'(", '1F622'], [':-D', '1F604'], [':-P', '1F61B'],
  [';-)', '1F609'], ['<3', '2764'], ['</3', '1F494'], [':-*', '1F618'], [':-|', '1F610'], [':|', '1F610'],
  [':-/', '1F615'], [':/', '1F615'], [':-O', '1F62E'], [':O', '1F62E'], [':o', '1F62E'], ['-_-', '1F611'],
  ['^_^', '1F60A'], ['^^', '1F60A'], ['>:(', '1F620'], ['B-)', '1F60E'], ['8)', '1F60E'],
];

interface EmojibaseEntry {
  hexcode: string;
  label?: string;
  tags?: string[];
  emoticon?: string | string[];
  order?: number;
}

type Entries = [string, string[]][];

const byKey = <T extends [string, ...unknown[]]>(a: T, b: T) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const hasWordCharacter = (key: string) => /[\p{L}\p{N}]/u.test(key);
const trimPunctuation = (word: string) => word.replace(/^\p{P}+|\p{P}+$/gu, '');

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function write(path: string, data: unknown): Promise<{ raw: number; gzip: number }> {
  const text = `${JSON.stringify(data)}\n`;
  await writeFile(path, text);
  return { raw: Buffer.byteLength(text), gzip: gzipSync(text).length };
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/** Keys of one emoji: its label, its tags, and every word of those that has more than one. */
function keysOf(entry: EmojibaseEntry): string[] {
  const keys: string[] = [];
  for (const text of [entry.label, ...(entry.tags ?? [])]) {
    if (!text) continue;
    const key = normalizeQuery(text);
    keys.push(key);
    const words = key.split(/[\s_-]+/);
    if (words.length < 2) continue;
    for (const word of words) {
      const trimmed = trimPunctuation(word);
      if ([...trimmed].length >= 2) keys.push(trimmed);
    }
  }
  return keys.filter(hasWordCharacter);
}

/** Map entries sorted by key, each hexcode list deduplicated and in emoji order. */
function sorted(map: Map<string, Set<string>>, order: Map<string, number>): Entries {
  const rank = (hexcode: string) => order.get(hexcode) ?? Number.MAX_SAFE_INTEGER;
  return [...map]
    .map(([key, hexcodes]): [string, string[]] => [key, [...hexcodes].sort((a, b) => rank(a) - rank(b))])
    .sort(byKey);
}

function add(map: Map<string, Set<string>>, key: string, hexcodes: Iterable<string>) {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  for (const hexcode of hexcodes) set.add(hexcode);
}

async function locales(): Promise<string[]> {
  const dirs = await readdir(EMOJIBASE, { withFileTypes: true });
  return dirs
    .filter((d) => d.isDirectory() && existsSync(join(EMOJIBASE, d.name, 'data.json')))
    .map((d) => d.name)
    .sort();
}

async function main() {
  const emojiData = await readJson<CompactEmoji[]>(join(DATA_DIR, 'emoji-data.json'));
  const listed = new Set(emojiData.filter((e) => !e.h).map((e) => e.i));
  const english = await readJson<EmojibaseEntry[]>(join(EMOJIBASE, 'en/data.json'));
  const order = new Map(english.map((e) => [e.hexcode.toLowerCase(), e.order ?? Number.MAX_SAFE_INTEGER]));

  await mkdir(KEYWORDS_DIR, { recursive: true });
  for (const file of await readdir(KEYWORDS_DIR)) {
    if (file.endsWith('.json')) await rm(join(KEYWORDS_DIR, file));
  }

  console.log(`${listed.size} listed emoji\n\nlocale    keys  stems      raw     gzip`);
  for (const locale of await locales()) {
    const entries = await readJson<EmojibaseEntry[]>(join(EMOJIBASE, locale, 'data.json'));
    const keys = new Map<string, Set<string>>();
    for (const entry of entries) {
      const hexcode = entry.hexcode.toLowerCase();
      if (!listed.has(hexcode)) continue;
      for (const key of keysOf(entry)) add(keys, key, [hexcode]);
    }

    const stems = new Map<string, Set<string>>();
    if (hasStemmer(locale)) for (const [key, hexcodes] of keys) add(stems, stemPhrase(key, locale), hexcodes);

    const data: KeywordIndexData = { locale, version: 1, keys: sorted(keys, order), stems: sorted(stems, order) };
    const size = await write(join(KEYWORDS_DIR, `${locale}.json`), data);
    console.log(
      `${locale.padEnd(8)}${String(keys.size).padStart(6)}${String(stems.size).padStart(7)}${kb(size.raw).padStart(10)}${kb(size.gzip).padStart(9)}`,
    );
  }

  const codes: [string, string][] = [];
  const seenCodes = new Set<string>();
  for (const source of SHORTCODE_SOURCES) {
    const map = await readJson<Record<string, string | string[]>>(join(EMOJIBASE, 'en/shortcodes', `${source}.json`));
    for (const [hex, value] of Object.entries(map)) {
      const hexcode = hex.toLowerCase();
      if (!listed.has(hexcode)) continue;
      for (const raw of [value].flat()) {
        const code = raw.toLowerCase();
        if (!/^[a-z0-9_+-]+$/.test(code) || seenCodes.has(`${code} ${hexcode}`)) continue;
        seenCodes.add(`${code} ${hexcode}`);
        codes.push([code, hexcode]);
      }
    }
  }
  // Stable: a code with two emoji keeps the source priority.
  codes.sort(byKey);
  const shortcodes: ShortcodeData = { version: 1, codes };
  const shortcodeSize = await write(join(DATA_DIR, 'shortcodes.json'), shortcodes);
  console.log(`\nshortcodes.json: ${codes.length} codes, ${kb(shortcodeSize.raw)} (${kb(shortcodeSize.gzip)} gzip)`);

  const items: [string, string][] = [];
  const dropped: string[] = [];
  const offer = (text: string, hexcode: string) => {
    if (items.some(([t]) => t === text)) return;
    if (listed.has(hexcode)) items.push([text, hexcode]);
    else dropped.push(`${text} ${hexcode}`);
  };
  for (const entry of english) {
    for (const text of [entry.emoticon ?? []].flat()) offer(text, entry.hexcode.toLowerCase());
  }
  for (const [text, hexcode] of EXTRA_EMOTICONS) offer(text, hexcode.toLowerCase());
  const emoticons: EmoticonData = { version: 1, items };
  await write(join(DATA_DIR, 'emoticons.json'), emoticons);
  console.log(`emoticons.json: ${items.length} emoticons`);
  if (dropped.length) console.log(`  not listed in emoji-data (left out): ${dropped.join(', ')}`);
}

await main();
