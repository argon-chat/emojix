/**
 * useRecents - Recent emoji persistence composable
 */

import { ref, watch, onMounted, type Ref } from 'vue';
import type { EmojiEntry } from '@/core';

const STORAGE_KEY = 'emojix-recents';

export interface UseRecentsOptions {
  /** Max recent emoji to store */
  maxRecents?: number;
  /** Custom storage key */
  storageKey?: string;
}

export interface UseRecentsResult {
  /** Recent emoji IDs */
  recentIds: Ref<string[]>;
  /** Add emoji to recents */
  addRecent: (emoji: EmojiEntry) => void;
  /** Clear recents */
  clearRecents: () => void;
  /** Check if emoji is in recents */
  isRecent: (emojiId: string) => boolean;
}

export function useRecents(options: UseRecentsOptions = {}): UseRecentsResult {
  const { maxRecents = 36, storageKey = STORAGE_KEY } = options;
  
  const recentIds = ref<string[]>([]);
  
  // Load from localStorage on mount
  onMounted(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          recentIds.value = parsed.slice(0, maxRecents);
        }
      }
    } catch {
      // Ignore errors
    }
  });
  
  // Save to localStorage on change
  watch(
    recentIds,
    (ids) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(ids));
      } catch {
        // Ignore errors (quota exceeded, etc.)
      }
    },
    { deep: true }
  );
  
  const addRecent = (emoji: EmojiEntry) => {
    const id = emoji.id;
    const current = recentIds.value;
    
    // Remove if already in list
    const idx = current.indexOf(id);
    if (idx !== -1) {
      current.splice(idx, 1);
    }
    
    // Add to front
    current.unshift(id);
    
    // Trim to max
    if (current.length > maxRecents) {
      current.length = maxRecents;
    }
    
    // Trigger reactivity
    recentIds.value = [...current];
  };
  
  const clearRecents = () => {
    recentIds.value = [];
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };
  
  const isRecent = (emojiId: string): boolean => {
    return recentIds.value.includes(emojiId);
  };
  
  return {
    recentIds,
    addRecent,
    clearRecents,
    isRecent,
  };
}
