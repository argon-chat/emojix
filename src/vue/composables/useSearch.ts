/**
 * useSearch - Debounced search composable
 */

import { ref, watch, type Ref } from 'vue';
import { emojiRegistry, type SearchResult } from '../../core';

export interface UseSearchOptions {
  /** Debounce delay in ms */
  debounce?: number;
  /** Max results */
  limit?: number;
}

export interface UseSearchResult {
  /** Current query */
  query: Ref<string>;
  /** Search results */
  results: Ref<SearchResult[]>;
  /** Is searching */
  isSearching: Ref<boolean>;
  /** Clear search */
  clear: () => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { debounce = 150, limit = 50 } = options;
  
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const isSearching = ref(false);
  
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  watch(query, (newQuery) => {
    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    const trimmed = newQuery.trim();
    
    // Clear immediately if empty
    if (!trimmed) {
      results.value = [];
      isSearching.value = false;
      return;
    }
    
    isSearching.value = true;
    
    // Debounced search
    timeoutId = setTimeout(() => {
      results.value = emojiRegistry.search(trimmed, limit);
      isSearching.value = false;
      timeoutId = null;
    }, debounce);
  });
  
  const clear = () => {
    query.value = '';
    results.value = [];
    isSearching.value = false;
    
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return {
    query,
    results,
    isSearching,
    clear,
  };
}
