import type { CategoryId } from '../core/types/Category';

/** One emoji in emoji-data.json, as scripts/build-atlases.ts writes it. */
export interface CompactEmoji {
  /** emojibase hexcode, lower-case: the entry's id, and its codepoints. */
  i: string;
  /** Shortcode. */
  s: string;
  /** Category. */
  g: CategoryId;
  /** Keywords. */
  k: string[];
  /** Name. */
  n: string;
  /** Has skin tones. */
  t?: boolean;
  /** Skin-tone variants (emojibase hexcodes, lower-case), each with a sprite. Drawn, not listed. */
  v?: string[];
  /** A component (skin tone swatch, hair): drawn when it stands alone in text, not listed. */
  h?: 1;
}
