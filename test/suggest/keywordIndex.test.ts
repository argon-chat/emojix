import { describe, test, expect, beforeAll } from "vitest";
import { KeywordIndex, loadKeywordIndex, normalizeQuery, type KeywordMatch } from "../../src/core/suggest";

let en: KeywordIndex;
let ru: KeywordIndex;

beforeAll(async () => {
  [en, ru] = await Promise.all([loadKeywordIndex("en"), loadKeywordIndex("ru")]);
});

const find = (matches: KeywordMatch[], hexcode: string) => matches.find((m) => m.hexcode === hexcode);

describe("normalizeQuery", () => {
  test("NFKC, lower case, trimmed, whitespace collapsed", () => {
    expect(normalizeQuery("  Ｆｉｒｅ \t\n Truck  ")).toBe("fire truck");
    expect(normalizeQuery("ОГОНЬ")).toBe("огонь");
    expect(normalizeQuery("")).toBe("");
  });
});

describe("loadKeywordIndex", () => {
  test("loads once per locale", async () => {
    expect(await loadKeywordIndex("en")).toBe(en);
    expect(en.locale).toBe("en");
    expect(en.longestKey).toBeGreaterThan(20);
  });

  test("rejects a locale without an index", async () => {
    await expect(loadKeywordIndex("xx")).rejects.toThrow();
  });
});

describe("matchPrefix", () => {
  test('"fire" is 🔥, exactly', () => {
    expect(find(en.matchPrefix("fire"), "1f525")).toMatchObject({ key: "fire", kind: "keyword", exact: true, unmatched: 0, locale: "en" });
  });

  test('"fir" finds 🔥 by prefix', () => {
    expect(find(en.matchPrefix("fir"), "1f525")).toMatchObject({ key: "fire", kind: "keyword", exact: false, unmatched: 1 });
  });

  test('"thumbs up" is 👍', () => {
    expect(find(en.matchPrefix("thumbs up"), "1f44d")).toMatchObject({ exact: true, kind: "keyword" });
  });

  test('ru "огонь" is 🔥', () => {
    expect(find(ru.matchPrefix("огонь"), "1f525")).toMatchObject({ key: "огонь", exact: true, locale: "ru" });
  });

  test('ru "котики" finds cats through the stem "кот"', () => {
    const matches = ru.matchPrefix("котики");
    const cat = find(matches, "1f431") ?? find(matches, "1f408");
    expect(cat).toMatchObject({ kind: "stem", key: "кот", unmatched: 2 });
  });

  test("English plurals match through stems", () => {
    expect(find(en.matchPrefix("unicorns"), "1f984")).toMatchObject({ kind: "stem", key: "unicorn", exact: true });
    expect(find(en.matchPrefix("volcanoes"), "1f30b")).toMatchObject({ kind: "stem", key: "volcano" });
  });

  test("an unknown query matches nothing", () => {
    expect(en.matchPrefix("qqzzxx")).toEqual([]);
    expect(ru.matchPrefix("щщщщщ")).toEqual([]);
    expect(en.matchPrefix("")).toEqual([]);
  });

  test("one match per emoji, exact first, then by unmatched, then by key", () => {
    const matches = en.matchPrefix("ca", 500);
    expect(new Set(matches.map((m) => m.hexcode)).size).toBe(matches.length);
    for (let i = 1; i < matches.length; i++) {
      const [a, b] = [matches[i - 1]!, matches[i]!];
      expect(Number(b.exact) <= Number(a.exact)).toBe(true);
      if (a.exact === b.exact) expect(a.unmatched <= b.unmatched).toBe(true);
      if (a.exact === b.exact && a.unmatched === b.unmatched) expect(a.key <= b.key).toBe(true);
    }
  });

  test("limit", () => {
    expect(en.matchPrefix("s")).toHaveLength(64);
    expect(en.matchPrefix("s", 5)).toHaveLength(5);
  });
});

describe("matchExact", () => {
  test("keys only by equality", () => {
    expect(find(en.matchExact("fire"), "1f525")).toMatchObject({ kind: "keyword", exact: true });
    expect(en.matchExact("fir")).toEqual([]);
  });

  test("then the stem", () => {
    const matches = ru.matchExact("котики");
    expect(find(matches, "1f9ad")).toMatchObject({ kind: "stem", key: "котик" });
    expect(new Set(matches.map((m) => m.hexcode)).size).toBe(matches.length);
  });
});
