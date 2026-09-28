import { test, expect } from "vitest";
import { SUGGEST_LOCALES, resolveSuggestLocales } from "../../src/core/suggest";

test("app ids and browser tags map to emojibase locales", () => {
  expect(resolveSuggestLocales("jp", ["en-US", "ru"])).toEqual(["ja", "en", "ru"]);
  expect(resolveSuggestLocales("ru_pt", [])).toEqual(["ru", "en"]);
  expect(resolveSuggestLocales("en_tengwar", ["en-GB"])).toEqual(["en", "en-gb"]);
  expect(resolveSuggestLocales("ru", ["pt-BR", "es-MX"])).toEqual(["ru", "pt", "es-mx", "en"]);
  expect(resolveSuggestLocales("zh-TW", ["zh-Hant-HK", "zh-CN"])).toEqual(["zh-hant", "zh", "en"]);
});

test("unavailable locales are dropped; en is always there", () => {
  expect(resolveSuggestLocales("am", [])).toEqual(["en"]);
  expect(resolveSuggestLocales("am", ["hy", "xx-YY", ""])).toEqual(["en"]);
});

test("at most 4, deduplicated, en kept", () => {
  expect(resolveSuggestLocales("de", ["de-AT", "fr", "it", "es", "pt"])).toEqual(["de", "fr", "it", "en"]);
  expect(resolveSuggestLocales("en-US", ["en", "en-GB", "ru", "uk", "ja"])).toEqual(["en", "en-gb", "ru", "uk"]);
  for (const locale of resolveSuggestLocales("fr-CA", ["nb-NO", "no", "sv"])) expect(SUGGEST_LOCALES).toContain(locale);
});
