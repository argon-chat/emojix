/**
 * What counts as an emoji in text.
 *
 * The regression these guard: the pattern was built on the Emoji property, which Unicode gives
 * to every digit, `#` and `*` (they can start a keycap). So "12345" split into five emoji — every
 * pasted digit became an inline image fetched from a CDN that had no such image — and "123" was
 * an emoji-only message drawn three times larger. A bare digit is text.
 */

import { describe, test, expect } from "vitest";
import { splitTextAndEmoji, extractEmojis, isEmojiOnly } from "../src/core/encoding/parseEmojiString";
import { fixNonStandardEmoji, hasEmoji } from "../src/core/encoding/fixNonStandardEmoji";

const emojisOf = (text: string) =>
  splitTextAndEmoji(text).filter((s) => s.type === "emoji").map((s) => s.content);

describe("what is not an emoji", () => {
  test("digits, # and * on their own are text", () => {
    for (const text of ["12345", "Order 42 at 10:30", "#tag", "*bold*", "(c) 2024", "8 800 555 35 35"]) {
      expect(emojisOf(text), text).toEqual([]);
      expect(splitTextAndEmoji(text)).toEqual([{ type: "text", content: text }]);
    }
  });

  test("© ® ™ without a variation selector are text", () => {
    expect(emojisOf("Argon© Inc® Brand™")).toEqual([]);
  });

  test("plain text of any script stays one segment", () => {
    for (const text of ["Привет, мир!", "Hello, world!", "こんにちは", "Բարև"]) {
      expect(splitTextAndEmoji(text)).toEqual([{ type: "text", content: text }]);
    }
  });

  test("a number is not an emoji-only message", () => {
    expect(isEmojiOnly("123").isOnlyEmoji).toBe(false);
    expect(isEmojiOnly("#").isOnlyEmoji).toBe(false);
    expect(isEmojiOnly("2024").count).toBe(0);
  });
});

describe("what is an emoji", () => {
  test("default-presentation emoji, with and without skin tone", () => {
    expect(emojisOf("hi 😀 there 👋🏽")).toEqual(["😀", "👋🏽"]);
  });

  test("keycaps are the one case where a digit is an emoji", () => {
    expect(emojisOf("press 1️⃣ or #️⃣")).toEqual(["1️⃣", "#️⃣"]);
    // A keycap written without its VS16 is normalised to the canonical form first.
    expect(emojisOf("1⃣")).toEqual(["1️⃣"]);
  });

  test("flags", () => {
    expect(emojisOf("🇺🇸 and 🇦🇲")).toEqual(["🇺🇸", "🇦🇲"]);
  });

  test("ZWJ sequences stay whole", () => {
    expect(emojisOf("👨‍👩‍👧 family, 🏳️‍🌈 flag, ❤️‍🔥 heart, 🧑🏽‍🤝‍🧑🏻 pair")).toEqual([
      "👨‍👩‍👧", "🏳️‍🌈", "❤️‍🔥", "🧑🏽‍🤝‍🧑🏻",
    ]);
  });

  test("text-presentation pictographs count with a VS16", () => {
    expect(emojisOf("❤️ ☺️ ©️")).toEqual(["❤️", "☺️", "©️"]);
  });

  test("emoji-only messages are still recognised", () => {
    expect(isEmojiOnly("😀😀").isOnlyEmoji).toBe(true);
    expect(isEmojiOnly("😀 😀 😀").count).toBe(3);
    expect(isEmojiOnly("😀 text").isOnlyEmoji).toBe(false);
  });

  test("splitting round-trips the text", () => {
    const text = "Call me 📞 at 12:30, ok? 👍🏻 #42 🎉🎉";
    expect(splitTextAndEmoji(text).map((s) => s.content).join("")).toBe(fixNonStandardEmoji(text));
    expect(extractEmojis(text)).toEqual(["📞", "👍🏻", "🎉", "🎉"]);
  });
});

describe("normalisation", () => {
  test("hasEmoji answers the same every time it is asked", () => {
    // A global regex used with test() remembers lastIndex and answered true/false alternately.
    for (let i = 0; i < 5; i++) {
      expect(hasEmoji("a 🎉 b")).toBe(true);
      expect(hasEmoji("plain 123")).toBe(false);
    }
  });

  test("plain numbers pass through untouched", () => {
    const text = "Total: 1234567890 items, #1";
    expect(fixNonStandardEmoji(text)).toBe(text);
  });

  test("a heart without VS16 gets one", () => {
    expect(fixNonStandardEmoji("I ❤ you")).toBe("I ❤️ you");
  });
});
