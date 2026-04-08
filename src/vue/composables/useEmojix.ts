/**
 * useEmojix - Main composable for using Emojix
 */

import { ref, computed, readonly, type Ref, type DeepReadonly } from 'vue';
import type { 
  EmojiEntry, 
  EmojiSelection, 
  CustomEmojiInput,
  CustomPack,
  SkinTone,
  CategoryId,
  Category
} from '@/core';
import { 
  emojiRegistry, 
  customEmojiStore,
  codepointsToString,
  SKIN_TONE_CODEPOINTS,
  applySkinTone
} from '@/core';

export interface UseEmojixOptions {
  /** Initial skin tone */
  skinTone?: SkinTone;
  /** Initial category */
  initialCategory?: CategoryId;
  /** Selection callback */
  onSelect?: (selection: EmojiSelection) => void;
}

export interface UseEmojixResult {
  // State
  /** Current skin tone */
  skinTone: Ref<SkinTone>;
  /** Current category */
  currentCategory: Ref<CategoryId>;
  /** Is initialized */
  isReady: Ref<boolean>;
  
  // Getters
  /** All categories */
  categories: DeepReadonly<Ref<Category[]>>;
  /** Emoji in current category */
  categoryEmoji: Ref<EmojiEntry[]>;
  
  // Actions
  /** Set skin tone */
  setSkinTone: (tone: SkinTone) => void;
  /** Set current category */
  setCategory: (categoryId: CategoryId) => void;
  /** Get emoji text with skin tone applied */
  getEmojiText: (emoji: EmojiEntry, tone?: SkinTone) => string;
  /** Search emoji */
  search: (query: string, limit?: number) => EmojiEntry[];
  
  // Custom emoji packs
  /** Register a custom emoji pack */
  registerPack: (pack: CustomPack) => void;
  /** Get all registered packs */
  getPacks: () => CustomPack[];
  
  // Custom emoji
  /** Add custom emoji */
  addCustomEmoji: (input: CustomEmojiInput) => Promise<EmojiEntry>;
  /** Remove custom emoji */
  removeCustomEmoji: (customId: string) => boolean;
  /** Get all custom emoji */
  getCustomEmoji: () => EmojiEntry[];
}

export function useEmojix(options: UseEmojixOptions = {}): UseEmojixResult {
  const {
    skinTone: initialSkinTone = 'default',
    initialCategory = 'smileys',
    // onSelect is available for parent component wiring
  } = options;
  
  // State
  const skinTone = ref<SkinTone>(initialSkinTone);
  const currentCategory = ref<CategoryId>(initialCategory);
  const isReady = ref(true); // Since atlases are bundled, we're always ready
  
  // Categories
  const categories = computed(() => emojiRegistry.getCategories());
  
  // Emoji in current category
  const categoryEmoji = computed(() => {
    return emojiRegistry.getByCategory(currentCategory.value);
  });
  
  // Set skin tone
  const setSkinTone = (tone: SkinTone) => {
    skinTone.value = tone;
  };
  
  // Set category
  const setCategory = (categoryId: CategoryId) => {
    currentCategory.value = categoryId;
  };
  
  // Get emoji text with skin tone
  const getEmojiText = (emoji: EmojiEntry, tone?: SkinTone): string => {
    const useTone = tone ?? skinTone.value;
    
    if (useTone === 'default' || !emoji.hasSkinTones) {
      return codepointsToString(emoji.codepoints);
    }
    
    const modifier = SKIN_TONE_CODEPOINTS[useTone];
    const modified = applySkinTone(emoji.codepoints, modifier);
    return codepointsToString(modified);
  };
  
  // Search
  const search = (query: string, limit = 50): EmojiEntry[] => {
    return emojiRegistry.search(query, limit).map(r => r.emoji);
  };
  
  // Custom emoji packs
  const registerPack = (pack: CustomPack): void => {
    customEmojiStore.registerPack(pack);
  };
  
  const getPacks = (): CustomPack[] => {
    return customEmojiStore.getPacks();
  };
  
  // Custom emoji
  const addCustomEmoji = async (input: CustomEmojiInput): Promise<EmojiEntry> => {
    return customEmojiStore.add(input);
  };
  
  const removeCustomEmoji = (customId: string): boolean => {
    return customEmojiStore.remove(customId);
  };
  
  const getCustomEmoji = (): EmojiEntry[] => {
    return customEmojiStore.getAll().map(c => c.entry);
  };
  
  return {
    // State
    skinTone,
    currentCategory,
    isReady,
    
    // Getters
    categories: readonly(categories),
    categoryEmoji,
    
    // Actions
    setSkinTone,
    setCategory,
    getEmojiText,
    search,
    
    // Custom emoji packs
    registerPack,
    getPacks,
    
    // Custom emoji
    addCustomEmoji,
    removeCustomEmoji,
    getCustomEmoji,
  };
}
