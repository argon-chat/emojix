/**
 * SearchIndex - Trie-based search for emoji by shortcode and keywords
 * Supports prefix matching and fuzzy search
 */

import type { EmojiEntry } from '../types';

/**
 * Trie node for efficient prefix search
 */
interface TrieNode {
  children: Map<string, TrieNode>;
  /** Emoji IDs that match at this node */
  entries: Set<string>;
  /** Is this a complete word? */
  isEnd: boolean;
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  emoji: EmojiEntry;
  score: number; // Higher = more relevant
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy';
}

/**
 * Create a new trie node
 */
function createNode(): TrieNode {
  return {
    children: new Map(),
    entries: new Set(),
    isEnd: false,
  };
}

/**
 * High-performance trie-based search index
 */
export class SearchIndex {
  private root: TrieNode = createNode();
  private emojiMap = new Map<string, EmojiEntry>();
  
  /**
   * Add an emoji to the search index
   */
  add(emoji: EmojiEntry): void {
    this.emojiMap.set(emoji.id, emoji);
    
    // Index shortcode
    this.indexTerm(emoji.shortcode.toLowerCase(), emoji.id, 10);
    
    // Index keywords
    for (const keyword of emoji.keywords) {
      this.indexTerm(keyword.toLowerCase(), emoji.id, 5);
    }
    
    // Index name words
    const nameWords = emoji.name.toLowerCase().split(/\s+/);
    for (const word of nameWords) {
      this.indexTerm(word, emoji.id, 3);
    }
  }
  
  /**
   * Remove an emoji from the search index
   */
  remove(emojiId: string): boolean {
    const emoji = this.emojiMap.get(emojiId);
    if (!emoji) return false;
    
    // Remove from all indexed terms
    this.removeTerm(emoji.shortcode.toLowerCase(), emojiId);
    for (const keyword of emoji.keywords) {
      this.removeTerm(keyword.toLowerCase(), emojiId);
    }
    const nameWords = emoji.name.toLowerCase().split(/\s+/);
    for (const word of nameWords) {
      this.removeTerm(word, emojiId);
    }
    
    this.emojiMap.delete(emojiId);
    return true;
  }
  
  /**
   * Search for emoji matching query
   * Returns results sorted by relevance
   */
  search(query: string, limit = 50): SearchResult[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return [];
    
    const results = new Map<string, SearchResult>();
    
    // Exact shortcode match (highest priority)
    this.findExactMatches(normalizedQuery, results);
    
    // Prefix matches
    this.findPrefixMatches(normalizedQuery, results);
    
    // Contains matches (substring)
    this.findContainsMatches(normalizedQuery, results);
    
    // Sort by score and return
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Clear the entire index
   */
  clear(): void {
    this.root = createNode();
    this.emojiMap.clear();
  }
  
  /**
   * Get index size
   */
  get size(): number {
    return this.emojiMap.size;
  }
  
  /**
   * Index a term for an emoji
   */
  private indexTerm(term: string, emojiId: string, _weight: number): void {
    let node = this.root;
    
    for (const char of term) {
      let child = node.children.get(char);
      if (!child) {
        child = createNode();
        node.children.set(char, child);
      }
      node = child;
      node.entries.add(emojiId);
    }
    
    node.isEnd = true;
  }
  
  /**
   * Remove a term for an emoji
   */
  private removeTerm(term: string, emojiId: string): void {
    let node = this.root;
    
    for (const char of term) {
      const child = node.children.get(char);
      if (!child) return;
      node = child;
      node.entries.delete(emojiId);
    }
  }
  
  /**
   * Find exact matches
   */
  private findExactMatches(query: string, results: Map<string, SearchResult>): void {
    let node = this.root;
    
    for (const char of query) {
      const child = node.children.get(char);
      if (!child) return;
      node = child;
    }
    
    if (node.isEnd) {
      for (const id of node.entries) {
        const emoji = this.emojiMap.get(id);
        if (emoji && emoji.shortcode.toLowerCase() === query) {
          this.addResult(results, emoji, 100, 'exact');
        }
      }
    }
  }
  
  /**
   * Find prefix matches
   */
  private findPrefixMatches(query: string, results: Map<string, SearchResult>): void {
    let node = this.root;
    
    for (const char of query) {
      const child = node.children.get(char);
      if (!child) return;
      node = child;
    }
    
    // Collect all entries under this prefix
    this.collectEntries(node, results, query.length);
  }
  
  /**
   * Recursively collect entries from a node
   */
  private collectEntries(
    node: TrieNode, 
    results: Map<string, SearchResult>,
    queryLength: number
  ): void {
    for (const id of node.entries) {
      const emoji = this.emojiMap.get(id);
      if (emoji) {
        // Score based on how much of the word was matched
        const score = 50 + (queryLength * 5);
        this.addResult(results, emoji, score, 'prefix');
      }
    }
  }
  
  /**
   * Find contains matches (slower, linear scan)
   */
  private findContainsMatches(query: string, results: Map<string, SearchResult>): void {
    if (query.length < 2) return; // Too short for contains search
    
    for (const emoji of this.emojiMap.values()) {
      // Skip if already found with higher score
      if (results.has(emoji.id)) continue;
      
      // Check shortcode
      if (emoji.shortcode.toLowerCase().includes(query)) {
        this.addResult(results, emoji, 30, 'contains');
        continue;
      }
      
      // Check keywords
      for (const keyword of emoji.keywords) {
        if (keyword.toLowerCase().includes(query)) {
          this.addResult(results, emoji, 20, 'contains');
          break;
        }
      }
    }
  }
  
  /**
   * Add or update a result
   */
  private addResult(
    results: Map<string, SearchResult>,
    emoji: EmojiEntry,
    score: number,
    matchType: SearchResult['matchType']
  ): void {
    const existing = results.get(emoji.id);
    if (!existing || existing.score < score) {
      results.set(emoji.id, { emoji, score, matchType });
    }
  }
}
