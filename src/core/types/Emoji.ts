import type { CategoryId } from './Category';

/**
 * Emoji render mode
 */
export type RenderMode = 
  | 'atlas'    // Sprite atlas (WebP/PNG) — consistent across platforms
  | 'native'   // Native system emoji font — lightest, varies by OS
  | 'twemoji'  // Twemoji font (requires font to be loaded)
  | 'noto';    // Noto Color Emoji font (requires font to be loaded)

/**
 * Skin tone modifier values
 */
export type SkinTone = 
  | 'default'   // Yellow (no modifier)
  | 'light'     // 🏻 U+1F3FB
  | 'mediumLight' // 🏼 U+1F3FC
  | 'medium'    // 🏽 U+1F3FD
  | 'mediumDark' // 🏾 U+1F3FE
  | 'dark';     // 🏿 U+1F3FF

/**
 * Skin tone codepoint modifiers
 */
export const SKIN_TONE_CODEPOINTS: Record<Exclude<SkinTone, 'default'>, number> = {
  light: 0x1F3FB,
  mediumLight: 0x1F3FC,
  medium: 0x1F3FD,
  mediumDark: 0x1F3FE,
  dark: 0x1F3FF,
};

/**
 * Reference to sprite position in an atlas
 */
export interface AtlasRef {
  atlasId: string;    // Atlas identifier (e.g., "smileys")
  x: number;          // X position in atlas (pixels)
  y: number;          // Y position in atlas (pixels)
  size: number;       // Sprite size (width = height)
}

/**
 * Animation reference for animated emoji (future)
 */
export interface AnimationRef {
  type: 'lottie' | 'apng' | 'webp' | 'gif';
  url: string;
  duration: number;   // ms
  loop: boolean;
  fallback: AtlasRef; // Static fallback
}

/**
 * Core emoji entry in the registry
 */
export interface EmojiEntry {
  /** Unique identifier (codepoints joined with `-`) */
  id: string;
  
  /** Unicode codepoints array */
  codepoints: number[];
  
  /** Hex string representation (e.g., "1f600") */
  hexcode: string;
  
  /** Shortcode without colons (e.g., "grinning") */
  shortcode: string;
  
  /** Category this emoji belongs to */
  category: CategoryId;
  
  /** Search keywords */
  keywords: string[];
  
  /** Unicode name */
  name: string;
  
  /** Reference to atlas sprite position */
  atlasRef: AtlasRef;
  
  /** Whether this emoji supports skin tone modifiers */
  hasSkinTones?: boolean;
  
  /** For custom emoji: true */
  isCustom?: boolean;
  
  /** For animated emoji (future) */
  animationRef?: AnimationRef;
}

/**
 * Custom emoji pack metadata
 */
export interface CustomPack {
  /** Unique pack identifier */
  id: string;
  
  /** Pack display name */
  name: string;
  
  /** Pack icon (emoji or URL) */
  icon: string;
  
  /** Pack order for display */
  order?: number;
}

/**
 * Custom emoji registration input
 */
export interface CustomEmojiInput {
  /** Unique identifier */
  id: string;
  
  /** Shortcode without colons */
  shortcode: string;
  
  /** Search keywords */
  keywords?: string[];
  
  /** Display name */
  name?: string;
  
  /** Pack this emoji belongs to (optional) */
  packId?: string;
  
  /**
   * Fallback unicode emoji for copy/paste.
   * When user copies text with this custom emoji, this unicode emoji 
   * will be used instead. Enables proper clipboard behavior.
   * Example: "🔥" for animated fire emoji
   */
  fallbackEmoji?: string;
  
  /** Single image URL (mutually exclusive with atlas) */
  url?: string;
  
  /** Atlas URL for sprite sheet */
  atlasUrl?: string;
  
  /** Position in atlas (required if atlasUrl provided) */
  atlasPosition?: { x: number; y: number; size: number };
  
  /** Animation config (future) */
  animation?: Omit<AnimationRef, 'fallback'>;
}

/**
 * Emoji selection event payload
 */
export interface EmojiSelection {
  /** The selected emoji entry */
  emoji: EmojiEntry;
  
  /** Unicode text representation */
  text: string;
  
  /** Applied skin tone (if any) */
  skinTone?: SkinTone;
  
  /** For custom emoji: the original input */
  customData?: CustomEmojiInput;
}
