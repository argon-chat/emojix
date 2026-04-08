import type { EmojiEntry } from './Emoji';

/**
 * Unicode emoji category IDs based on Unicode CLDR
 */
export type CategoryId =
  | 'recent'       // Recently used (virtual category)
  | 'smileys'      // Smileys & Emotion
  | 'people'       // People & Body
  | 'animals'      // Animals & Nature
  | 'food'         // Food & Drink
  | 'travel'       // Travel & Places
  | 'activities'   // Activities
  | 'objects'      // Objects
  | 'symbols'      // Symbols
  | 'flags'        // Flags
  | 'custom';      // Custom emoji category

/**
 * Category metadata for UI
 */
export interface Category {
  id: CategoryId;
  name: string;
  icon: string;        // Emoji character for category tab
  order: number;       // Display order
  count: number;       // Number of emoji in category
}

/**
 * Section of emoji for unified scroll (Telegram-style)
 */
export interface CategorySection {
  category: Category;
  emojis: EmojiEntry[];
  /** Starting Y offset in virtual scroll */
  startY: number;
  /** Ending Y offset in virtual scroll */
  endY: number;
}

/**
 * Virtual row types for sectioned grid
 */
export type VirtualRow =
  | { type: 'header'; category: Category; y: number }
  | { type: 'emoji-row'; emojis: EmojiEntry[]; y: number; startIndex: number };

/**
 * Category display order for unified scroll
 * Recent → Custom → Standard categories
 */
export const CATEGORY_ORDER: readonly CategoryId[] = [
  'recent',
  'custom', 
  'smileys',
  'people',
  'animals',
  'food',
  'travel',
  'activities',
  'objects',
  'symbols',
  'flags',
] as const;

/**
 * Default category definitions
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'smileys', name: 'Smileys & Emotion', icon: '😀', order: 0, count: 0 },
  { id: 'people', name: 'People & Body', icon: '👋', order: 1, count: 0 },
  { id: 'animals', name: 'Animals & Nature', icon: '🐱', order: 2, count: 0 },
  { id: 'food', name: 'Food & Drink', icon: '🍔', order: 3, count: 0 },
  { id: 'travel', name: 'Travel & Places', icon: '✈️', order: 4, count: 0 },
  { id: 'activities', name: 'Activities', icon: '⚽', order: 5, count: 0 },
  { id: 'objects', name: 'Objects', icon: '💡', order: 6, count: 0 },
  { id: 'symbols', name: 'Symbols', icon: '❤️', order: 7, count: 0 },
  { id: 'flags', name: 'Flags', icon: '🏁', order: 8, count: 0 },
  { id: 'custom', name: 'Custom', icon: '⭐', order: 9, count: 0 },
] as const;
