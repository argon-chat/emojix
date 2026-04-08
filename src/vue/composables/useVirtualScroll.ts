/**
 * useVirtualScroll - High-performance virtual scrolling composable
 * Only renders visible items + buffer for smooth scrolling
 */

import { 
  ref, 
  computed, 
  watch,
  onUnmounted,
  type Ref,
  type ComputedRef 
} from 'vue';

export interface VirtualScrollOptions<T> {
  /** All items to virtualize */
  items: Ref<T[]> | ComputedRef<T[]>;
  
  /** Item height in pixels */
  itemHeight: number;
  
  /** Number of columns in grid */
  columns: number;
  
  /** Container height in pixels */
  containerHeight: Ref<number>;
  
  /** Buffer rows above/below viewport */
  bufferRows?: number;
  
  /** Gap between items in pixels */
  gap?: number;
}

export interface VirtualScrollResult<T> {
  /** Items to actually render */
  visibleItems: ComputedRef<{ item: T; index: number; style: Record<string, string> }[]>;
  
  /** Total scroll height (for spacer) */
  totalHeight: ComputedRef<number>;
  
  /** Current scroll position */
  scrollTop: Ref<number>;
  
  /** Handle scroll event */
  onScroll: (event: Event) => void;
  
  /** Container ref to attach */
  containerRef: Ref<HTMLElement | null>;
  
  /** Scroll to specific index */
  scrollToIndex: (index: number) => void;
  
  /** Scroll to top */
  scrollToTop: () => void;
}

export function useVirtualScroll<T>(
  options: VirtualScrollOptions<T>
): VirtualScrollResult<T> {
  const { 
    items, 
    itemHeight, 
    columns, 
    containerHeight, 
    bufferRows = 3,
    gap = 0
  } = options;
  
  const scrollTop = ref(0);
  const containerRef = ref<HTMLElement | null>(null);
  
  // Row height including gap
  const rowHeight = computed(() => itemHeight + gap);
  
  // Total number of rows
  const totalRows = computed(() => Math.ceil(items.value.length / columns));
  
  // Total scroll height
  const totalHeight = computed(() => {
    return totalRows.value * rowHeight.value - gap; // Remove gap from last row
  });
  
  // Visible row range
  const visibleRange = computed(() => {
    const startRow = Math.floor(scrollTop.value / rowHeight.value);
    const endRow = Math.ceil((scrollTop.value + containerHeight.value) / rowHeight.value);
    
    // Add buffer
    const bufferedStart = Math.max(0, startRow - bufferRows);
    const bufferedEnd = Math.min(totalRows.value, endRow + bufferRows);
    
    return { start: bufferedStart, end: bufferedEnd };
  });
  
  // Visible items with positioning
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value;
    const result: { item: T; index: number; style: Record<string, string> }[] = [];
    
    for (let row = start; row < end; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index >= items.value.length) break;
        
        const item = items.value[index];
        if (item === undefined) continue;
        
        const top = row * rowHeight.value;
        const left = col * (itemHeight + gap);
        
        result.push({
          item,
          index,
          style: {
            position: 'absolute',
            top: `${top}px`,
            left: `${left}px`,
            width: `${itemHeight}px`,
            height: `${itemHeight}px`,
          },
        });
      }
    }
    
    return result;
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
  
  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    const row = Math.floor(index / columns);
    const top = row * rowHeight.value;
    
    if (containerRef.value) {
      containerRef.value.scrollTop = top;
    }
  };
  
  // Scroll to top
  const scrollToTop = () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0;
    }
  };
  
  // Reset scroll when items change significantly
  watch(
    () => items.value.length,
    (newLen, oldLen) => {
      if (Math.abs(newLen - oldLen) > columns * 3) {
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
    visibleItems,
    totalHeight,
    scrollTop,
    onScroll,
    containerRef,
    scrollToIndex,
    scrollToTop,
  };
}
