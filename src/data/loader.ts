/**
 * Registers the bundled emoji: atlases (scripts/build-atlases.ts writes them and atlases.ts) and
 * the emoji data.
 *
 * Cheap by design: atlases are registered by manifest and URL only (the browser fetches an atlas
 * when a sprite from it is first shown) and the search trie is built on the first search.
 */

import type { EmojiEntry, AtlasRef } from '../core/types/Emoji';
import { emojiRegistry } from '../core/registry/EmojiRegistry';
import { atlasLoader } from '../core/atlas/AtlasLoader';
import { hexcodeToCodepoints, unifiedHexcode } from '../core/encoding/CodepointUtils';
import type { CompactEmoji } from './compact';
import { BUNDLED_ATLASES } from './atlases';
import emojiData from './emoji-data.json';

const TONE_NAMES: Record<string, string> = {
  '1f3fb': 'light skin tone',
  '1f3fc': 'medium-light skin tone',
  '1f3fd': 'medium skin tone',
  '1f3fe': 'medium-dark skin tone',
  '1f3ff': 'dark skin tone',
};

/** "waving hand: medium skin tone", "people holding hands: light skin tone, dark skin tone". */
function variantName(base: string, hexcode: string): string {
  const tones = [...new Set(hexcode.split('-').filter((h) => h in TONE_NAMES))].map((h) => TONE_NAMES[h]);
  return tones.length ? `${base}: ${tones.join(', ')}` : base;
}

let initialized = false;

/** Initialize the emoji registry with the bundled data. Safe to call more than once. */
export async function initializeEmojix(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const refs = new Map<string, AtlasRef>();
  for (const { manifest, url } of BUNDLED_ATLASES) {
    void atlasLoader.register(manifest, url);
    for (const [key, { col, row }] of Object.entries(manifest.sprites)) {
      refs.set(key, { atlasId: manifest.id, x: col * manifest.spriteSize, y: row * manifest.spriteSize, size: manifest.spriteSize });
    }
  }
  // The build lists only emoji with a sprite; this never shows unless the data and atlases disagree.
  const refOf = (hexcode: string): AtlasRef => refs.get(unifiedHexcode(hexcode)) ?? { atlasId: '', x: 0, y: 0, size: 0 };

  for (const e of emojiData as CompactEmoji[]) {
    const entry: EmojiEntry = {
      id: e.i,
      codepoints: hexcodeToCodepoints(e.i),
      hexcode: e.i,
      shortcode: e.s,
      category: e.g,
      keywords: e.k,
      name: e.n,
      atlasRef: refOf(e.i),
      hasSkinTones: e.t ?? false,
    };
    if (e.h) emojiRegistry.registerHidden(entry);
    else emojiRegistry.register(entry);

    for (const [index, hexcode] of (e.v ?? []).entries()) {
      emojiRegistry.registerHidden({
        id: hexcode,
        codepoints: hexcodeToCodepoints(hexcode),
        hexcode,
        shortcode: `${e.s}_tone${index + 1}`,
        category: e.g,
        keywords: [],
        name: variantName(e.n, hexcode),
        atlasRef: refOf(hexcode),
      });
    }
  }
}
