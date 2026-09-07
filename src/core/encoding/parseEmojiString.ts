/**
 * parseEmojiString - Emoji parsing and analysis utilities
 * 
 * Provides functions for:
 * - Detecting emoji-only messages (for enlarged display in chat)
 * - Extracting emoji from text
 * - Counting emoji in text
 * 
 * Inspired by Telegram Web implementation.
 */

import { fixNonStandardEmoji } from './fixNonStandardEmoji';

/**
 * Comprehensive emoji regex pattern
 * Matches:
 * - Basic emoji (🎉)
 * - Emoji with skin tone (👋🏽)
 * - ZWJ sequences (👨‍👩‍👧)
 * - Keycap sequences (#️⃣)
 * - Flag sequences (🇺🇸)
 * - Emoji with VS16 (❤️)
 *
 * Built on Extended_Pictographic and Emoji_Presentation, not on the Emoji property: Unicode
 * marks every digit, `#` and `*` as Emoji (they can start a keycap), so a pattern on `\p{Emoji}`
 * took "12345" for five emoji — every pasted digit became an image, and "123" was an emoji-only
 * message drawn three times larger. A bare digit is text; it is an emoji only inside a keycap
 * sequence. Likewise ©, ® and ™ are pictographs that count only with a VS16 or inside a ZWJ join.
 */
const EMOJI_REGEX = new RegExp(
  [
    // Regional indicator pairs (flags)
    '[\u{1F1E6}-\u{1F1FF}]{2}',
    // Tag sequences (like flag subdivisions)
    '\u{1F3F4}[\u{E0060}-\u{E007F}]+\u{E007F}',
    // Keycap sequences: digit/symbol + VS16 + combining enclosing keycap
    '[\u{0023}\u{002A}\u{0030}-\u{0039}]\uFE0F?\u20E3',
    // ZWJ sequences: pictographs joined by ZWJ, at least one join
    '\\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}]?\uFE0F?' +
      '(?:\u200D\\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}]?\uFE0F?)+',
    // A character that is emoji by default, with optional skin tone and VS16
    '\\p{Emoji_Presentation}[\u{1F3FB}-\u{1F3FF}]?\uFE0F?',
    // A text-by-default pictograph made emoji by VS16 (\u2764\uFE0F \u263A\uFE0F \u00A9\uFE0F)
    '\\p{Extended_Pictographic}\uFE0F',
  ].join('|'),
  'gu'
);

/**
 * Regex for whitespace and invisible characters
 */
const WHITESPACE_REGEX = /[\s\u200B\u200C\u200D\uFEFF]/g;

/**
 * Result of emoji-only check
 */
export interface EmojiOnlyResult {
  /** Whether the text contains only emoji */
  isOnlyEmoji: boolean;
  /** Number of emoji in the text */
  count: number;
  /** Extracted emoji array */
  emojis: string[];
}

/**
 * Maximum emoji count for "emoji only" display mode
 * Messages with more emoji than this won't get enlarged treatment
 */
export const MAX_EMOJI_ONLY_COUNT = 6;

/**
 * Extract all emoji from text
 * 
 * @param text - Text to extract emoji from
 * @returns Array of emoji strings
 * 
 * @example
 * ```ts
 * extractEmojis('Hello 👋 World 🌍!')
 * // → ['👋', '🌍']
 * 
 * extractEmojis('👨‍👩‍👧‍👦 Family')
 * // → ['👨‍👩‍👧‍👦']
 * ```
 */
export function extractEmojis(text: string): string[] {
  if (!text) return [];
  
  // Normalize first
  const normalized = fixNonStandardEmoji(text);
  
  const matches = normalized.match(EMOJI_REGEX);
  return matches ?? [];
}

/**
 * Count emoji in text
 * 
 * @param text - Text to count emoji in
 * @returns Number of emoji
 */
export function countEmojis(text: string): number {
  return extractEmojis(text).length;
}

/**
 * Check if text contains only emoji (no other text)
 * Used for chat messages to determine if they should be displayed larger
 * 
 * @param text - Text to check
 * @param maxCount - Maximum emoji count (default: 6)
 * @returns Object with isOnlyEmoji flag, count, and extracted emojis
 * 
 * @example
 * ```ts
 * isEmojiOnly('😀😀😀')
 * // → { isOnlyEmoji: true, count: 3, emojis: ['😀', '😀', '😀'] }
 * 
 * isEmojiOnly('Hello 😀')
 * // → { isOnlyEmoji: false, count: 1, emojis: ['😀'] }
 * 
 * isEmojiOnly('😀'.repeat(10))
 * // → { isOnlyEmoji: false, count: 10, emojis: [...] } // Too many for "emoji only" mode
 * ```
 */
export function isEmojiOnly(text: string, maxCount = MAX_EMOJI_ONLY_COUNT): EmojiOnlyResult {
  if (!text) {
    return { isOnlyEmoji: false, count: 0, emojis: [] };
  }
  
  // Normalize emoji
  const normalized = fixNonStandardEmoji(text);
  
  // Extract all emoji
  const emojis = extractEmojis(normalized);
  const count = emojis.length;
  
  // No emoji = not emoji only
  if (count === 0) {
    return { isOnlyEmoji: false, count: 0, emojis: [] };
  }
  
  // Too many emoji = not considered "emoji only" for enlarged display
  if (count > maxCount) {
    return { isOnlyEmoji: false, count, emojis };
  }
  
  // Remove all emoji from text
  const withoutEmoji = normalized.replace(EMOJI_REGEX, '');
  
  // Remove whitespace
  const withoutWhitespace = withoutEmoji.replace(WHITESPACE_REGEX, '');
  
  // If nothing left, it's emoji only
  const isOnlyEmoji = withoutWhitespace.length === 0;
  
  return { isOnlyEmoji, count, emojis };
}

/**
 * Get emoji size multiplier based on count
 * Used for enlarged emoji display in chat
 * 
 * @param count - Number of emoji
 * @returns Size multiplier (1-3)
 */
export function getEmojiSizeMultiplier(count: number): number {
  if (count === 1) return 3;    // 3x size for single emoji
  if (count === 2) return 2.5;  // 2.5x for two emoji
  if (count === 3) return 2;    // 2x for three emoji
  if (count <= 6) return 1.5;   // 1.5x for 4-6 emoji
  return 1;                      // Normal size for more
}

/**
 * Parse text for custom emoji references
 * Custom emoji are referenced as documentId wrapped in <custom-emoji> tags
 * or as special placeholders
 * 
 * @param text - Text that may contain custom emoji references
 * @returns Array of custom emoji IDs
 */
export function extractCustomEmojiIds(text: string): string[] {
  if (!text) return [];
  
  const ids: string[] = [];
  
  // Match custom-emoji tags: <custom-emoji data-document-id="123">
  const tagRegex = /<custom-emoji[^>]*data-document-id=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    if (match[1]) {
      ids.push(match[1]);
    }
  }
  
  return ids;
}

/**
 * Check if a single character/string is an emoji
 */
export function isEmoji(char: string): boolean {
  if (!char) return false;
  const emojis = extractEmojis(char);
  return emojis.length > 0 && emojis[0] === char;
}

/**
 * Split text into segments of text and emoji
 */
export interface TextSegment {
  type: 'text' | 'emoji';
  content: string;
}

export function splitTextAndEmoji(text: string): TextSegment[] {
  if (!text) return [];
  
  const normalized = fixNonStandardEmoji(text);
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  
  // Reset regex
  EMOJI_REGEX.lastIndex = 0;
  
  let match;
  while ((match = EMOJI_REGEX.exec(normalized)) !== null) {
    // Add text before this emoji
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: normalized.slice(lastIndex, match.index),
      });
    }
    
    // Add emoji
    segments.push({
      type: 'emoji',
      content: match[0],
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < normalized.length) {
    segments.push({
      type: 'text',
      content: normalized.slice(lastIndex),
    });
  }
  
  return segments;
}
