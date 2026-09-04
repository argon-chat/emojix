/**
 * EmojiRegistry - Central store for all emoji data
 * Provides O(1) lookup by ID, hexcode, shortcode
 */

import type { EmojiEntry, CategoryId, Category } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import { SearchIndex, type SearchResult } from './SearchIndex';

/**
 * Main emoji registry - singleton pattern
 */
export class EmojiRegistry {
  /** Primary index: emoji ID -> entry */
  private byId = new Map<string, EmojiEntry>();
  
  /** Index: hexcode -> entry */
  private byHexcode = new Map<string, EmojiEntry>();
  
  /** Index: shortcode -> entry */
  private byShortcode = new Map<string, EmojiEntry>();
  
  /** Index: category -> emoji IDs */
  private byCategory = new Map<CategoryId, string[]>();
  
  /** Category metadata */
  private categories = new Map<CategoryId, Category>();
  
  /** Search index */
  private searchIndex = new SearchIndex();
  
  /**
   * Entries not yet in the search trie. Building the trie for ~3800 emoji (every shortcode,
   * keyword and name word) is only worth it once someone actually searches, so registrations are
   * parked here until the first search() and indexed then; null once the trie is live.
   */
  private searchPending: EmojiEntry[] | null = [];
  
  constructor() {
    // Initialize categories
    for (const cat of DEFAULT_CATEGORIES) {
      this.categories.set(cat.id, { ...cat });
      this.byCategory.set(cat.id, []);
    }
  }
  
  /**
   * Register an emoji
   */
  register(emoji: EmojiEntry): void {
    // Add to primary index
    this.byId.set(emoji.id, emoji);
    
    // Add to secondary indices
    this.byHexcode.set(emoji.hexcode, emoji);
    this.byShortcode.set(emoji.shortcode.toLowerCase(), emoji);
    
    // Add to category
    const categoryList = this.byCategory.get(emoji.category);
    if (categoryList) {
      categoryList.push(emoji.id);
    } else {
      this.byCategory.set(emoji.category, [emoji.id]);
    }
    
    // Update category count
    const category = this.categories.get(emoji.category);
    if (category) {
      category.count++;
    }
    
    // Add to search index (deferred until the first search)
    if (this.searchPending) this.searchPending.push(emoji);
    else this.searchIndex.add(emoji);
  }
  
  /**
   * Register multiple emoji at once (more efficient)
   */
  registerBulk(emojis: EmojiEntry[]): void {
    for (const emoji of emojis) {
      this.register(emoji);
    }
  }
  
  /**
   * Unregister an emoji
   */
  unregister(emojiId: string): boolean {
    const emoji = this.byId.get(emojiId);
    if (!emoji) return false;
    
    // Remove from all indices
    this.byId.delete(emojiId);
    this.byHexcode.delete(emoji.hexcode);
    this.byShortcode.delete(emoji.shortcode.toLowerCase());
    
    // Remove from category
    const categoryList = this.byCategory.get(emoji.category);
    if (categoryList) {
      const idx = categoryList.indexOf(emojiId);
      if (idx !== -1) {
        categoryList.splice(idx, 1);
      }
    }
    
    // Update category count
    const category = this.categories.get(emoji.category);
    if (category && category.count > 0) {
      category.count--;
    }
    
    // Remove from search
    if (this.searchPending) {
      const idx = this.searchPending.findIndex(e => e.id === emojiId);
      if (idx !== -1) this.searchPending.splice(idx, 1);
    } else {
      this.searchIndex.remove(emojiId);
    }
    
    return true;
  }
  
  /**
   * Get emoji by ID
   */
  getById(id: string): EmojiEntry | undefined {
    return this.byId.get(id);
  }
  
  /**
   * Get emoji by hexcode
   */
  getByHexcode(hexcode: string): EmojiEntry | undefined {
    return this.byHexcode.get(hexcode.toLowerCase());
  }
  
  /**
   * Get emoji by shortcode
   */
  getByShortcode(shortcode: string): EmojiEntry | undefined {
    // Remove colons if present
    const normalized = shortcode.replace(/:/g, '').toLowerCase();
    return this.byShortcode.get(normalized);
  }
  
  /**
   * Get all emoji in a category
   */
  getByCategory(categoryId: CategoryId): EmojiEntry[] {
    const ids = this.byCategory.get(categoryId) ?? [];
    return ids
      .map(id => this.byId.get(id))
      .filter((e): e is EmojiEntry => e !== undefined);
  }
  
  /**
   * Search emoji by query
   */
  search(query: string, limit = 50): SearchResult[] {
    this.ensureSearchIndex();
    return this.searchIndex.search(query, limit);
  }
  
  private ensureSearchIndex(): void {
    if (!this.searchPending) return;
    const pending = this.searchPending;
    this.searchPending = null;
    for (const emoji of pending) this.searchIndex.add(emoji);
  }
  
  /**
   * Get all categories with counts
   */
  getCategories(): Category[] {
    return Array.from(this.categories.values())
      .filter(c => c.count > 0 || c.id === 'custom')
      .sort((a, b) => a.order - b.order);
  }
  
  /**
   * Get category metadata
   */
  getCategory(categoryId: CategoryId): Category | undefined {
    return this.categories.get(categoryId);
  }
  
  /**
   * Get total emoji count
   */
  get size(): number {
    return this.byId.size;
  }
  
  /**
   * Get all emoji
   */
  getAll(): EmojiEntry[] {
    return Array.from(this.byId.values());
  }
  
  /**
   * Check if emoji exists
   */
  has(emojiId: string): boolean {
    return this.byId.has(emojiId);
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.byId.clear();
    this.byHexcode.clear();
    this.byShortcode.clear();
    this.searchIndex.clear();
    this.searchPending = [];
    
    // Reset category counts
    for (const cat of this.categories.values()) {
      cat.count = 0;
    }
    for (const list of this.byCategory.values()) {
      list.length = 0;
    }
  }
}

/**
 * Global singleton instance
 */
export const emojiRegistry = new EmojiRegistry();
