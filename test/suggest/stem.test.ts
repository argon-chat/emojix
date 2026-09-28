/**
 * The Snowball ports against the reference output: the first 400 pairs of snowball-data's
 * russian/ and english/ voc.txt → output.txt (https://github.com/snowballstem/snowball-data).
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stem } from "../../src/core/suggest";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "../fixtures", name), "utf8")) as [word: string, stem: string][];

describe.each([
  ["ru", "stem-ru.json"],
  ["en", "stem-en.json"],
])("%s", (locale, file) => {
  test("matches Snowball on every fixture pair", () => {
    const pairs = fixture(file);
    expect(pairs).toHaveLength(400);
    const wrong = pairs.filter(([word, expected]) => stem(word, locale) !== expected);
    expect(wrong).toEqual([]);
  });
});

test("ё is е for Russian", () => {
  expect(stem("ёлками", "ru")).toBe(stem("елками", "ru"));
  expect(stem("котики", "ru")).toBe("котик");
});

test("en-gb stems as en; other locales (uk included) are left alone", () => {
  expect(stem("running", "en")).toBe("run");
  expect(stem("running", "en-gb")).toBe("run");
  expect(stem("котики", "uk")).toBe("котики");
  expect(stem("running", "de")).toBe("running");
});
