import { describe, test, expect } from "vitest";
import { EMOTICONS, emoticonBefore } from "../../src/core/suggest";

const emoticon = (text: string) => EMOTICONS.find((e) => e.text === text);

describe("EMOTICONS", () => {
  test("ones ending in a letter wait for a boundary; the rest are immediate", () => {
    for (const text of [":D", ":P", "xD", ":o"]) expect(emoticon(text)?.immediate, text).toBe(false);
    for (const text of [":)", ":-)", ":-(", "<3", "^^", ":3"]) expect(emoticon(text)?.immediate, text).toBe(true);
  });

  test("the first mapping of a text wins", () => {
    expect(emoticon(":)")?.hexcode).toBe("1f642");
    expect(emoticon(":o")?.hexcode).toBe("1f632");
    expect(emoticon(":-O")?.hexcode).toBe("1f62e");
  });
});

describe("emoticonBefore", () => {
  test("at the end, after whitespace or at the start", () => {
    expect(emoticonBefore("hello :)")).toEqual({ emoticon: emoticon(":)"), start: 6 });
    expect(emoticonBefore(":)")?.start).toBe(0);
    expect(emoticonBefore("line\n<3")?.emoticon.hexcode).toBe("2764");
  });

  test("not inside a word", () => {
    expect(emoticonBefore("a:)")).toBeNull();
    expect(emoticonBefore("hello :) there")).toBeNull();
    expect(emoticonBefore("")).toBeNull();
  });

  test("the longest one", () => {
    expect(emoticonBefore("no >:(")?.emoticon.text).toBe(">:(");
    expect(emoticonBefore("no :-(")?.emoticon.text).toBe(":-(");
  });

  test("case-sensitive, as typed", () => {
    expect(emoticonBefore("ok :d")).toBeNull();
    expect(emoticonBefore("ok :D")?.emoticon.hexcode).toBe("1f604");
  });
});
