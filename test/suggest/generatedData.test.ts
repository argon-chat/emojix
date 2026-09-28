/**
 * The checked-in output of scripts/build-keywords.ts: sorted for binary search, normalised as
 * queries are, and every hexcode one the registry knows.
 */

import { describe, test, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emojiRegistry } from "../../src/core/registry/EmojiRegistry";
import { initializeEmojix } from "../../src/data/loader";
import { SUGGEST_LOCALES, normalizeQuery } from "../../src/core/suggest";
import type { EmoticonData, KeywordIndexData, ShortcodeData } from "../../src/core/suggest/types";

const DATA = join(__dirname, "../../src/data");
const read = <T>(file: string) => JSON.parse(readFileSync(join(DATA, file), "utf8")) as T;
const keywords = (locale: string) => read<KeywordIndexData>(`keywords/${locale}.json`);

const unresolved = (hexcodes: Iterable<string>) => [...hexcodes].filter((h) => !emojiRegistry.getByHexcode(h));
const strictlySorted = (entries: [string, ...unknown[]][]) => entries.every((e, i) => i === 0 || entries[i - 1]![0] < e[0]);

beforeAll(() => initializeEmojix());

test("every emojibase locale has an index, and nothing else does", () => {
  expect(SUGGEST_LOCALES).toHaveLength(28);
  for (const locale of ["en", "en-gb", "ru", "uk", "ja", "zh", "zh-hant", "pt", "es-mx"]) expect(SUGGEST_LOCALES).toContain(locale);
  expect(existsSync(join(DATA, "keywords/NOTICE"))).toBe(true);
});

describe.each(["en", "ru"])("%s.json", (locale) => {
  const data = keywords(locale);

  test("is the locale's, version 1, with thousands of keys", () => {
    expect(data.locale).toBe(locale);
    expect(data.version).toBe(1);
    expect(data.keys.length).toBeGreaterThan(4000);
  });

  test("keys and stems are sorted by code unit, without duplicates", () => {
    expect(strictlySorted(data.keys)).toBe(true);
    expect(strictlySorted(data.stems)).toBe(true);
  });

  test("keys are normalised and hold a letter or digit; hexcode lists are deduplicated", () => {
    for (const [key, hexcodes] of data.keys) {
      expect(normalizeQuery(key), key).toBe(key);
      expect(/[\p{L}\p{N}]/u.test(key), key).toBe(true);
      expect(new Set(hexcodes).size, key).toBe(hexcodes.length);
    }
  });

  test("every hexcode resolves in the registry", () => {
    const all = new Set([...data.keys, ...data.stems].flatMap(([, hexcodes]) => hexcodes));
    expect(unresolved(all)).toEqual([]);
  });
});

test("ru and en have stems; ja and uk have none", () => {
  expect(keywords("ru").stems.length).toBeGreaterThan(4000);
  expect(keywords("en").stems.length).toBeGreaterThan(4000);
  expect(keywords("ja").stems).toEqual([]);
  expect(keywords("uk").stems).toEqual([]);
});

test("no skin-tone variant is indexed", () => {
  const toned = keywords("en").keys.flatMap(([, hexcodes]) => hexcodes).filter((h) => /1f3f[b-f]/.test(h));
  expect(toned).toEqual([]);
});

test("shortcodes are sorted, well-formed and resolve", () => {
  const { version, codes } = read<ShortcodeData>("shortcodes.json");
  expect(version).toBe(1);
  expect(codes.length).toBeGreaterThan(3000);
  expect(codes.every(([code], i) => i === 0 || codes[i - 1]![0] <= code)).toBe(true);
  expect(codes.filter(([code]) => !/^[a-z0-9_+-]+$/.test(code))).toEqual([]);
  expect(new Set(codes.map(([code, hexcode]) => `${code} ${hexcode}`)).size).toBe(codes.length);
  expect(unresolved(codes.map(([, hexcode]) => hexcode))).toEqual([]);
});

test("emoticons are unique and resolve", () => {
  const { items } = read<EmoticonData>("emoticons.json");
  expect(items.length).toBeGreaterThan(60);
  expect(new Set(items.map(([text]) => text)).size).toBe(items.length);
  expect(unresolved(items.map(([, hexcode]) => hexcode))).toEqual([]);
});
