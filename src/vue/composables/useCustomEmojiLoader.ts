/**
 * useCustomEmojiLoader - Vue composable for batched custom emoji loading
 * 
 * Provides reactive loading state and automatic batching
 */

import { ref, onMounted, onUnmounted, type Ref, shallowRef, triggerRef } from 'vue';
import { customEmojiStore } from '@/core';
import type { LoadedEmoji } from '@/core/registry/CustomEmojiQueue';

export interface UseCustomEmojiLoaderOptions {
  /** Document IDs to preload */
  preload?: string[];
  /** Auto-subscribe to load events */
  autoSubscribe?: boolean;
}

export interface UseCustomEmojiLoaderResult {
  /** Map of loaded emoji by document ID */
  loaded: Ref<Map<string, LoadedEmoji>>;
  
  /** Set of currently loading document IDs */
  loading: Ref<Set<string>>;
  
  /** Is any emoji currently loading */
  isLoading: Ref<boolean>;
  
  /** Request a single emoji */
  request: (documentId: string) => LoadedEmoji | null;
  
  /** Request multiple emojis */
  requestMany: (documentIds: string[]) => LoadedEmoji[];
  
  /** Preload emojis (no return) */
  preload: (documentIds: string[]) => void;
  
  /** Check if emoji is loaded */
  isLoaded: (documentId: string) => boolean;
  
  /** Get loaded emoji */
  get: (documentId: string) => LoadedEmoji | undefined;
  
  /** Loading stats */
  stats: Ref<{ pending: number; loaded: number; failed: number } | null>;
}

/**
 * Composable for managing custom emoji loading
 */
export function useCustomEmojiLoader(
  options: UseCustomEmojiLoaderOptions = {}
): UseCustomEmojiLoaderResult {
  const { preload: preloadIds = [], autoSubscribe = true } = options;
  
  // Use shallowRef for map to avoid deep reactivity overhead
  const loaded = shallowRef(new Map<string, LoadedEmoji>());
  const loading = ref(new Set<string>());
  const isLoading = ref(false);
  const stats = ref<{ pending: number; loaded: number; failed: number } | null>(null);
  
  let unsubscribe: (() => void) | null = null;
  
  /**
   * Handle emoji loaded
   */
  const handleLoaded = (emojis: LoadedEmoji[]) => {
    const newLoaded = new Map(loaded.value);
    
    for (const emoji of emojis) {
      newLoaded.set(emoji.documentId, emoji);
      loading.value.delete(emoji.documentId);
    }
    
    loaded.value = newLoaded;
    triggerRef(loaded);
    
    isLoading.value = loading.value.size > 0;
    updateStats();
  };
  
  /**
   * Update loading stats
   */
  const updateStats = () => {
    stats.value = customEmojiStore.getLoadingStats();
  };
  
  /**
   * Request a single emoji
   */
  const request = (documentId: string): LoadedEmoji | null => {
    // Already loaded locally
    const existing = loaded.value.get(documentId);
    if (existing) return existing;
    
    // Mark as loading
    loading.value.add(documentId);
    isLoading.value = true;
    
    const cached = customEmojiStore.ensureLoaded(documentId);
    if (cached) {
      handleLoaded([cached]);
      return cached;
    }
    
    return null;
  };
  
  /**
   * Request multiple emojis
   */
  const requestMany = (documentIds: string[]): LoadedEmoji[] => {
    const results: LoadedEmoji[] = [];
    const toLoad: string[] = [];
    
    for (const id of documentIds) {
      const existing = loaded.value.get(id);
      if (existing) {
        results.push(existing);
      } else {
        toLoad.push(id);
      }
    }
    
    if (toLoad.length > 0) {
      for (const id of toLoad) {
        loading.value.add(id);
      }
      isLoading.value = true;
      
      const cached = customEmojiStore.ensureLoadedMany(toLoad);
      if (cached.length > 0) {
        handleLoaded(cached);
        results.push(...cached);
      }
    }
    
    return results;
  };
  
  /**
   * Preload emojis
   */
  const preloadFn = (documentIds: string[]) => {
    customEmojiStore.preload(documentIds);
  };
  
  /**
   * Check if emoji is loaded
   */
  const isLoadedFn = (documentId: string): boolean => {
    return loaded.value.has(documentId) || customEmojiStore.isQueueLoaded(documentId);
  };
  
  /**
   * Get loaded emoji
   */
  const get = (documentId: string): LoadedEmoji | undefined => {
    return loaded.value.get(documentId);
  };
  
  onMounted(() => {
    // Subscribe to load events
    if (autoSubscribe) {
      unsubscribe = customEmojiStore.onLoaded(handleLoaded);
    }
    
    // Preload specified emojis
    if (preloadIds.length > 0) {
      preloadFn(preloadIds);
    }
    
    updateStats();
  });
  
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });
  
  return {
    loaded,
    loading,
    isLoading,
    request,
    requestMany,
    preload: preloadFn,
    isLoaded: isLoadedFn,
    get,
    stats,
  };
}

/**
 * Setup the global emoji loader with your API loader function
 * Call this once at app initialization
 */
export function setupCustomEmojiLoader(
  loader: (documentIds: string[]) => Promise<LoadedEmoji[]>,
  options?: {
    batchDelay?: number;
    maxBatchSize?: number;
    retryFailed?: boolean;
    maxRetries?: number;
  }
): void {
  customEmojiStore.initLoadingQueue(loader, options);
}
