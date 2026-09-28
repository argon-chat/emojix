import { describe, test, expect } from "vitest";
import { matchShortcodes, shortcodeExact } from "../../src/core/suggest";

describe("matchShortcodes", () => {
  test('"joy" is 😂, exactly, first', () => {
    expect(matchShortcodes("joy")[0]).toEqual({ hexcode: "1f602", code: "joy", exact: true, unmatched: 0 });
  });

  test("prefixes count what is left of the code", () => {
    expect(matchShortcodes("jo").find((m) => m.hexcode === "1f602")).toMatchObject({ code: "joy", exact: false, unmatched: 1 });
  });

  test('"thup" is 👍 by word prefixes (th + up), with a penalty', () => {
    const match = matchShortcodes("thup").find((m) => m.hexcode === "1f44d");
    expect(match).toEqual({ hexcode: "1f44d", code: "thumbs_up", exact: false, unmatched: "thumbs_up".length - 4 + 4 });
  });

  test("word prefixes may skip words", () => {
    expect(matchShortcodes("fwtoj").some((m) => m.code === "face_with_tears_of_joy")).toBe(true);
  });

  test('"+1" is 👍', () => {
    expect(matchShortcodes("+1")[0]).toMatchObject({ hexcode: "1f44d", exact: true });
  });

  test("case-insensitive; anything outside [a-z0-9_+-] matches nothing", () => {
    expect(matchShortcodes("JOY")[0]?.hexcode).toBe("1f602");
    expect(matchShortcodes("Joy!")).toEqual([]);
    expect(matchShortcodes("")).toEqual([]);
    expect(matchShortcodes("радость")).toEqual([]);
  });

  test("one match per emoji, best first, limited", () => {
    const matches = matchShortcodes("sm", 1000);
    expect(new Set(matches.map((m) => m.hexcode)).size).toBe(matches.length);
    for (let i = 1; i < matches.length; i++) expect(matches[i - 1]!.unmatched <= matches[i]!.unmatched).toBe(true);
    expect(matchShortcodes("s")).toHaveLength(32);
    expect(matchShortcodes("s", 3)).toHaveLength(3);
  });

  test("word-prefix matching needs 3 characters", () => {
    expect(matchShortcodes("tu").some((m) => m.code === "thumbs_up")).toBe(false);
  });
});

describe("shortcodeExact", () => {
  test("a whole code, no colons", () => {
    expect(shortcodeExact("joy")).toBe("1f602");
    expect(shortcodeExact("thumbs_up")).toBe("1f44d");
    expect(shortcodeExact("+1")).toBe("1f44d");
    expect(shortcodeExact("jo")).toBeNull();
    expect(shortcodeExact(":joy:")).toBeNull();
  });
});
