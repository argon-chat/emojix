/**
 * useSectionedEmoji - Build sectioned emoji data for unified scroll
 * 
 * Order: Recent → Standard categories (smileys, people...) → Custom packs
 * Filters out empty sections automatically.
 */

import { computed, ref, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { EmojiEntry, CategoryId, CategorySection, CustomPack } from '@/core';
import { emojiRegistry, customEmojiStore } from '@/core';

/** Standard emoji category order (no 'recent' or 'custom' - handled separately) */
const STANDARD_CATEGORY_ORDER: readonly CategoryId[] = [
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

export interface UseSectionedEmojiOptions {
  /** Recent emoji IDs */
  recentIds: Ref<string[]>;
  /** Excluded category IDs */
  excludeCategories?: CategoryId[];
  /** Emoji size in pixels */
  emojiSize: number;
  /** Number of columns */
  columns: number;
  /** Gap between items */
  gap: number;
  /** Header height in pixels */
  headerHeight?: number;
}

export interface UseSectionedEmojiResult {
  /** All sections with emoji and Y offsets */
  sections: ComputedRef<CategorySection[]>;
  /** Total height of all sections */
  totalHeight: ComputedRef<number>;
  /** Custom packs for tabs */
  customPacks: ComputedRef<CustomPack[]>;
  /** Get section by ID (category or pack:packId) */
  getSectionById: (id: string) => CategorySection | undefined;
  /** Find section at given Y position */
  getSectionAtY: (y: number) => CategorySection | undefined;
  /** Get Y offset for "emoji" section (first standard category) */
  getEmojiSectionY: () => number;
}

export function useSectionedEmoji(
  options: UseSectionedEmojiOptions
): UseSectionedEmojiResult {
  const {
    recentIds,
    excludeCategories = [],
    emojiSize,
    columns,
    gap,
    headerHeight = 32,
  } = options;

  const rowHeight = emojiSize + gap;

  // Reactive store version - triggers recomputation when store changes
  const storeVersion = ref(customEmojiStore.version);
  let unsubscribe: (() => void) | null = null;
  
  // Subscribe to store changes
  onMounted(() => {
    unsubscribe = customEmojiStore.onChange(() => {
      storeVersion.value = customEmojiStore.version;
    });
  });
  
  onUnmounted(() => {
    unsubscribe?.();
  });

  // Build all sections with calculated Y offsets
  const sections = computed<CategorySection[]>(() => {
    // Track store version for reactivity
    void storeVersion.value;
    const result: CategorySection[] = [];
    let currentY = 0;

    // Helper to add section
    const addSection = (
      id: string,
      name: string,
      icon: string,
      emojis: EmojiEntry[],
      order: number
    ) => {
      if (emojis.length === 0) return;

      const rowCount = Math.ceil(emojis.length / columns);
      const sectionHeight = headerHeight + rowCount * rowHeight;

      result.push({
        category: {
          id: id as CategoryId,
          name,
          icon,
          order,
          count: emojis.length,
        },
        emojis,
        startY: currentY,
        endY: currentY + sectionHeight,
      });

      currentY += sectionHeight;
    };

    // 1. Recent section
    if (!excludeCategories.includes('recent')) {
      const recentEmojis = recentIds.value
        .map(id => emojiRegistry.getById(id))
        .filter((e): e is EmojiEntry => e !== undefined);
      
      addSection('recent', 'Recent', '🕐', recentEmojis, -1);
    }

    // 2. Standard emoji categories
    for (const categoryId of STANDARD_CATEGORY_ORDER) {
      if (excludeCategories.includes(categoryId)) continue;

      const category = emojiRegistry.getCategory(categoryId);
      if (!category) continue;

      const emojis = emojiRegistry.getByCategory(categoryId);
      addSection(categoryId, category.name, category.icon, emojis, category.order);
    }

    // 3. Custom packs
    const packs = customEmojiStore.getPacks();
    for (let i = 0; i < packs.length; i++) {
      const pack = packs[i]!;
      const packEmojis = customEmojiStore.getByPack(pack.id);
      addSection(`pack:${pack.id}`, pack.name, pack.icon, packEmojis, 100 + i);
    }

    // 4. Unassigned custom emoji (if any, show as "Custom" section)
    const unassigned = customEmojiStore.getUnassigned();
    if (unassigned.length > 0) {
      addSection('custom', 'Custom', '⭐', unassigned, 999);
    }

    return result;
  });

  // Total height
  const totalHeight = computed(() => {
    if (sections.value.length === 0) return 0;
    const last = sections.value[sections.value.length - 1]!;
    return last.endY;
  });

  // Custom packs for tabs
  const customPacks = computed<CustomPack[]>(() => {
    // Track store version for reactivity
    void storeVersion.value;
    
    const packs = customEmojiStore.getPacks();
    
    // Add unassigned as "Custom" pack if there are any
    const unassigned = customEmojiStore.getUnassigned();
    if (unassigned.length > 0) {
      return [
        ...packs,
        { id: '__unassigned__', name: 'Custom', icon: '⭐', order: 999 },
      ];
    }
    
    return packs;
  });

  // Get section by ID
  const getSectionById = (id: string): CategorySection | undefined => {
    // Handle special case for unassigned custom
    if (id === 'pack:__unassigned__') {
      return sections.value.find(s => s.category.id === 'custom');
    }
    return sections.value.find(s => s.category.id === id);
  };

  // Find section at given Y position
  const getSectionAtY = (y: number): CategorySection | undefined => {
    for (const section of sections.value) {
      if (y >= section.startY && y < section.endY) {
        return section;
      }
    }
    if (sections.value.length > 0 && y >= sections.value[sections.value.length - 1]!.endY) {
      return sections.value[sections.value.length - 1];
    }
    return sections.value[0];
  };

  // Get Y offset for first standard emoji category
  const getEmojiSectionY = (): number => {
    const firstStandard = sections.value.find(s => 
      STANDARD_CATEGORY_ORDER.includes(s.category.id as CategoryId)
    );
    return firstStandard?.startY ?? 0;
  };

  return {
    sections,
    totalHeight,
    customPacks,
    getSectionById,
    getSectionAtY,
    getEmojiSectionY,
  };
}