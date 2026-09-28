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

  test("none that is ordinary text: a digit and ), a capital and :", () => {
    expect(EMOTICONS.filter((e) => /^(?:\d\)|[A-Z]:)$/.test(e.text))).toEqual([]);
    expect(emoticon("8)")).toBeUndefined();
    expect(emoticon("D:")).toBeUndefined();
  });
});

describe("emoticonBefore", () => {
  test("at the end, after whitespace or at the start", () => {
    expect(emoticonBefore("hello :)")).toEqual({ emoticon: emoticon(":)"), start: 6 });
    expect(emoticonBefore(":)")?.start).toBe(0);
    expect(emoticonBefore("line\n<3")?.emoticon.hexcode).toBe("2764");
  });

  test("not after a letter or digit", () => {
    expect(emoticonBefore("a:)")).toBeNull();
    expect(emoticonBefore("1:)")).toBeNull();
    expect(emoticonBefore("hello :) there")).toBeNull();
    expect(emoticonBefore("")).toBeNull();
  });

  test("not right after an opening bracket", () => {
    expect(emoticonBefore("(:)")).toBeNull();
    expect(emoticonBefore("see (:)")).toBeNull();
    expect(emoticonBefore("(8)")).toBeNull();
    expect(emoticonBefore("( :)")?.emoticon.text).toBe(":)");
  });

  test("text that only looks like one", () => {
    expect(emoticonBefore("item 8)")).toBeNull();
    expect(emoticonBefore("Plan D:")).toBeNull();
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
