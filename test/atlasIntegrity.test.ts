/**
 * The generated emoji data and the atlases agree (scripts/build-atlases.ts writes both).
 *
 * What would go wrong otherwise: an entry without a sprite draws the atlas's first cell (a 😀 where
 * a 🧑‍🚀 was meant); a manifest pointing at a missing or differently sized image draws nothing or a
 * shifted neighbour; a variant or component that is not registered falls back to the system font.
 */

import { describe, test, expect, beforeAll } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AtlasManifest } from "../src/core/types/Atlas";
import type { CompactEmoji } from "../src/data/compact";
import { unifiedHexcode } from "../src/core/encoding/CodepointUtils";
import { emojiRegistry } from "../src/core/registry/EmojiRegistry";
import { atlasLoader } from "../src/core/atlas/AtlasLoader";
import { spriteResolver } from "../src/core/atlas/SpriteResolver";
import { initializeEmojix } from "../src/data/loader";
import { BUNDLED_ATLASES } from "../src/data/atlases";

const ATLASES = join(__dirname, "../src/assets/atlases");
const data = JSON.parse(readFileSync(join(__dirname, "../src/data/emoji-data.json"), "utf8")) as CompactEmoji[];
const manifests = readdirSync(ATLASES)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => JSON.parse(readFileSync(join(ATLASES, f), "utf8")) as AtlasManifest);

/** Canvas size from a WebP's VP8X / VP8 / VP8L header. */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

const spriteKeys = new Map<string, string>();
for (const m of manifests) for (const key of Object.keys(m.sprites)) spriteKeys.set(key, m.id);

describe("the data", () => {
  test("covers emojibase 17 with Apple art: every listed emoji, its skin tones and the components", () => {
    const listed = data.filter((e) => !e.h);
    expect(listed.length).toBeGreaterThan(1850);
    expect(data.reduce((n, e) => n + (e.v?.length ?? 0), 0)).toBeGreaterThan(1800);
    expect(data.filter((e) => e.h).length).toBe(9);
    for (const category of ["smileys", "people", "animals", "food", "travel", "activities", "objects", "symbols", "flags"]) {
      expect(listed.some((e) => e.g === category), category).toBe(true);
    }
  });

  test("every entry and every skin-tone variant has a sprite", () => {
    const missing: string[] = [];
    for (const e of data) {
      for (const hexcode of [e.i, ...(e.v ?? [])]) if (!spriteKeys.has(unifiedHexcode(hexcode))) missing.push(hexcode);
    }
    expect(missing).toEqual([]);
  });

  test("ids are unique, and so are the sprites they point at", () => {
    const ids = data.flatMap((e) => [e.i, ...(e.v ?? [])]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids.map(unifiedHexcode)).size).toBe(ids.length);
  });
});

describe("the atlases", () => {
  test("every manifest's image exists, with the size the manifest says", () => {
    for (const m of manifests) {
      const file = join(ATLASES, `${m.id}.${m.format}`);
      expect(existsSync(file), file).toBe(true);
      expect(webpSize(file), m.id).toEqual(m.dimensions);
    }
  });

  test("sprites sit inside their atlas, one per cell", () => {
    for (const m of manifests) {
      const cells = new Set<string>();
      for (const [key, { col, row }] of Object.entries(m.sprites)) {
        expect(col, key).toBeLessThan(m.columns);
        expect((row + 1) * m.spriteSize, key).toBeLessThanOrEqual(m.dimensions.height);
        expect((col + 1) * m.spriteSize, key).toBeLessThanOrEqual(m.dimensions.width);
        cells.add(`${col}:${row}`);
      }
      expect(cells.size, m.id).toBe(Object.keys(m.sprites).length);
    }
  });

  test("a sprite is filed in exactly one atlas, and every sprite is used", () => {
    const total = manifests.reduce((n, m) => n + Object.keys(m.sprites).length, 0);
    expect(spriteKeys.size).toBe(total);
    const used = new Set(data.flatMap((e) => [e.i, ...(e.v ?? [])]).map(unifiedHexcode));
    expect([...spriteKeys.keys()].filter((k) => !used.has(k))).toEqual([]);
  });

  test("the loader imports exactly these atlases", () => {
    expect(BUNDLED_ATLASES.map((a) => a.manifest.id).sort()).toEqual(manifests.map((m) => m.id).sort());
    const index = JSON.parse(readFileSync(join(ATLASES, "index.json"), "utf8")) as Record<string, AtlasManifest>;
    expect(Object.keys(index).sort()).toEqual(manifests.map((m) => m.id).sort());
  });
});

describe("registered", () => {
  beforeAll(() => initializeEmojix());

  test("every registered emoji resolves to a registered atlas", () => {
    for (const e of data) {
      for (const hexcode of [e.i, ...(e.v ?? [])]) {
        const entry = emojiRegistry.getByHexcode(hexcode);
        expect(entry, hexcode).toBeDefined();
        expect(atlasLoader.get(entry!.atlasRef.atlasId), hexcode).toBeDefined();
        expect(spriteResolver.getStyle(entry!, 20), hexcode).not.toBeNull();
      }
    }
  });

  test("text finds its entry with or without variation selectors; variants stay out of the lists", () => {
    expect(emojiRegistry.getByText("❤️")?.id).toBe(emojiRegistry.getByText("❤")?.id);
    expect(emojiRegistry.getByText("1️⃣")).toBeDefined();
    expect(emojiRegistry.getByText("1⃣")).toBe(emojiRegistry.getByText("1️⃣"));
    expect(emojiRegistry.getByText("🇺🇦")?.category).toBe("flags");
    expect(emojiRegistry.getByText("👨‍👩‍👧‍👦")).toBeDefined();

    const toned = emojiRegistry.getByText("👋🏽")!;
    expect(toned.atlasRef.atlasId).toBe("tone3");
    expect(toned.name).toBe("waving hand: medium skin tone");
    expect(emojiRegistry.getByText("🏽")?.atlasRef.atlasId).toBe("people");
    expect(emojiRegistry.getByCategory("people").some((e) => e.id === toned.id)).toBe(false);
    expect(emojiRegistry.search("waving", 50).some((r) => r.emoji.id === toned.id)).toBe(false);
  });

  test("an emoji-sized box shows exactly its cell: percentages that land on the sprite", () => {
    const entry = emojiRegistry.getByText("😀")!;
    const m = atlasLoader.get(entry.atlasRef.atlasId)!.manifest;
    const style = spriteResolver.getRelativeStyle(entry)!;
    const [sw, sh] = style.backgroundSize.split(" ").map(parseFloat);
    const [px, py] = style.backgroundPosition.split(" ").map(parseFloat);
    // In a 100-unit box the image is sw × sh units and sits at p% × (box − image).
    expect(sw).toBeCloseTo((m.dimensions.width / m.spriteSize) * 100, 3);
    expect(sh).toBeCloseTo((m.dimensions.height / m.spriteSize) * 100, 3);
    expect((px! / 100) * (100 - sw!)).toBeCloseTo((-entry.atlasRef.x / m.spriteSize) * 100, 2);
    expect((py! / 100) * (100 - sh!)).toBeCloseTo((-entry.atlasRef.y / m.spriteSize) * 100, 2);
  });
});
