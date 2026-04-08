/**
 * useSectionedVirtualScroll - Virtual scroll for sectioned emoji grid
 * 
 * Handles mixed rows (headers + emoji rows) with different heights.
 * Provides sticky header tracking and scroll-to-section functionality.
 */

import {
  ref,
  computed,
  watch,
  onUnmounted,
  type Ref,
  type ComputedRef,
} from 'vue';
import type { CategorySection, CategoryId, VirtualRow } from '@/core';

export interface SectionedVirtualScrollOptions {
  /** Sections to render */
  sections: ComputedRef<CategorySection[]>;
  /** Container height in pixels */
  containerHeight: Ref<number>;
  /** Emoji size in pixels */
  emojiSize: number;
  /** Number of columns */
  columns: number;
  /** Gap between items */
  gap: number;
  /** Header height in pixels */
  headerHeight?: number;
  /** Buffer rows above/below viewport */
  bufferRows?: number;
}

export interface SectionedVirtualScrollResult {
  /** Visible rows (headers + emoji rows) to render */
  visibleRows: ComputedRef<VirtualRow[]>;
  /** Current scroll position */
  scrollTop: Ref<number>;
  /** Currently visible/active category (for tab sync) */
  currentCategory: ComputedRef<CategoryId | undefined>;
  /** Handle scroll event */
  onScroll: (event: Event) => void;
  /** Container ref to attach */
  containerRef: Ref<HTMLElement | null>;
  /** Scroll to a specific section */
  scrollToSection: (categoryId: CategoryId, behavior?: ScrollBehavior) => void;
  /** Scroll to specific Y position */
  scrollToY: (y: number, behavior?: ScrollBehavior) => void;
  /** Scroll to top */
  scrollToTop: () => void;
}

export function useSectionedVirtualScroll(
  options: SectionedVirtualScrollOptions
): SectionedVirtualScrollResult {
  const {
    sections,
    containerHeight,
    emojiSize,
    columns,
    gap,
    headerHeight = 32,
    bufferRows = 3,
  } = options;

  const scrollTop = ref(0);
  const containerRef = ref<HTMLElement | null>(null);
  const rowHeight = emojiSize + gap;

  // Calculate visible rows (headers + emoji rows)
  const visibleRows = computed<VirtualRow[]>(() => {
    const result: VirtualRow[] = [];
    const viewStart = scrollTop.value;
    const viewEnd = scrollTop.value + containerHeight.value;
    const buffer = bufferRows * rowHeight;

    for (const section of sections.value) {
      // Check if section is in view (with buffer)
      if (section.endY < viewStart - buffer) continue;
      if (section.startY > viewEnd + buffer) break;

      // Add header row if in view
      const headerY = section.startY;
      if (headerY >= viewStart - buffer && headerY <= viewEnd + buffer) {
        result.push({
          type: 'header',
          category: section.category,
          y: headerY,
        });
      }

      // Calculate emoji rows for this section
      const emojiStartY = section.startY + headerHeight;
      const rowCount = Math.ceil(section.emojis.length / columns);

      for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
        const rowY = emojiStartY + rowIdx * rowHeight;

        // Skip if row is before viewport (with buffer)
        if (rowY + rowHeight < viewStart - buffer) continue;
        // Stop if row is after viewport (with buffer)
        if (rowY > viewEnd + buffer) break;

        // Get emojis for this row
        const startIdx = rowIdx * columns;
        const rowEmojis = section.emojis.slice(startIdx, startIdx + columns);

        if (rowEmojis.length > 0) {
          result.push({
            type: 'emoji-row',
            emojis: rowEmojis,
            y: rowY,
            startIndex: startIdx,
          });
        }
      }
    }

    return result;
  });

  // Current category based on scroll position (for tab sync)
  const currentCategory = computed<CategoryId | undefined>(() => {
    // Find section that contains the top of the viewport (with small offset for header)
    const checkY = scrollTop.value + headerHeight / 2;

    for (const section of sections.value) {
      if (checkY >= section.startY && checkY < section.endY) {
        return section.category.id;
      }
    }

    // Default to first section
    return sections.value[0]?.category.id;
  });

  // Scroll handler with RAF throttling
  let rafId: number | null = null;

  const onScroll = (event: Event) => {
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      const target = event.target as HTMLElement;
      scrollTop.value = target.scrollTop;
      rafId = null;
    });
  };

  // Scroll to a specific section
  const scrollToSection = (categoryId: CategoryId, behavior: ScrollBehavior = 'smooth') => {
    const section = sections.value.find(s => s.category.id === categoryId);
    if (!section || !containerRef.value) return;

    containerRef.value.scrollTo({
      top: section.startY,
      behavior,
    });
  };

  // Scroll to specific Y position
  const scrollToY = (y: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.value) return;
    
    containerRef.value.scrollTo({
      top: y,
      behavior,
    });
  };

  // Scroll to top
  const scrollToTop = () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0;
    }
  };

  // Reset scroll when sections change significantly
  watch(
    () => sections.value.length,
    (newLen, oldLen) => {
      // Only reset if significant change (e.g., loading new data)
      if (oldLen === 0 && newLen > 0) {
        scrollToTop();
      }
    }
  );

  // Cleanup
  onUnmounted(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });

  return {
    visibleRows,
    scrollTop,
    currentCategory,
    onScroll,
    containerRef,
    scrollToSection,
    scrollToY,
    scrollToTop,
  };
}
