<script setup lang="ts">
/**
 * SectionedEmojiGrid - Virtualized grid with category sections
 * Telegram-style unified scroll with sticky headers
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { EmojiEntry, CategoryId, CategorySection, RenderMode, Category } from '../../core';
import { useSectionedVirtualScroll } from '../composables/useSectionedVirtualScroll';
import EmojiSprite from './EmojiSprite.vue';
import CategoryHeader from './CategoryHeader.vue';

const props = withDefaults(defineProps<{
  /** Sections to display */
  sections: CategorySection[];
  /** Total content height */
  totalHeight: number;
  /** Number of columns */
  columns?: number;
  /** Emoji size in pixels */
  emojiSize?: number;
  /** Gap between items */
  gap?: number;
  /** Container height */
  height?: number;
  /** Header height in pixels */
  headerHeight?: number;
  /** Render mode: atlas, native, twemoji, noto */
  renderMode?: RenderMode;
}>(), {
  columns: 8,
  emojiSize: 32,
  gap: 4,
  height: 300,
  headerHeight: 32,
  renderMode: 'atlas',
});

const emit = defineEmits<{
  /** Emoji selected */
  select: [emoji: EmojiEntry];
  /** Current category changed (for tab sync) */
  categoryChange: [categoryId: CategoryId];
}>();

// Container ref for height measurement
const gridContainerRef = ref<HTMLElement | null>(null);
const containerHeight = ref(props.height);

// Update container height on resize
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (gridContainerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(gridContainerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// Computed sections ref for reactivity
const sectionsRef = computed(() => props.sections);

// Virtual scroll
const {
  visibleRows,
  scrollTop,
  currentCategory,
  onScroll,
  containerRef,
  scrollToSection,
  scrollToY,
  scrollToTop,
} = useSectionedVirtualScroll({
  sections: sectionsRef,
  containerHeight,
  emojiSize: props.emojiSize,
  columns: props.columns,
  gap: props.gap,
  headerHeight: props.headerHeight,
  bufferRows: 3,
});

// Sync container ref
onMounted(() => {
  containerRef.value = gridContainerRef.value;
});

// Emit category change
watch(currentCategory, (categoryId) => {
  if (categoryId) {
    emit('categoryChange', categoryId);
  }
});

// Grid width
const gridWidth = computed(() => {
  return props.columns * (props.emojiSize + props.gap) - props.gap;
});

// Sticky header - show current category at top when scrolling
const stickyCategory = computed<Category | undefined>(() => {
  if (!currentCategory.value || props.sections.length === 0) return undefined;
  const section = props.sections.find(s => s.category.id === currentCategory.value);
  return section?.category;
});

// Should show sticky header (only when scrolled past first header)
const showStickyHeader = computed(() => {
  if (!stickyCategory.value || props.sections.length === 0) return false;
  const firstSection = props.sections[0];
  if (!firstSection) return false;
  // Show sticky when scrolled past first section's header
  return scrollTop.value > firstSection.startY + props.headerHeight;
});

// Handle selection
const handleSelect = (emoji: EmojiEntry) => {
  emit('select', emoji);
};

// Expose scroll methods
defineExpose({
  scrollToSection,
  scrollToY,
  scrollToTop,
});
</script>

<template>
  <div
    ref="gridContainerRef"
    class="emojix-sectioned-grid"
    :style="{ height: `${height}px` }"
    @scroll="onScroll"
  >
    <!-- Sticky header overlay -->
    <CategoryHeader
      v-if="showStickyHeader && stickyCategory"
      :category="stickyCategory"
      :height="headerHeight"
      sticky
      class="emojix-sticky-header"
    />

    <!-- Scrollable content -->
    <div
      class="emojix-grid-content"
      :style="{
        height: `${totalHeight}px`,
        width: `${gridWidth}px`,
      }"
    >
      <!-- Render visible rows -->
      <template v-for="row in visibleRows" :key="row.type === 'header' ? `h-${row.category.id}` : `r-${row.y}`">
        <!-- Category header -->
        <CategoryHeader
          v-if="row.type === 'header'"
          :category="row.category"
          :height="headerHeight"
          :style="{
            position: 'absolute',
            top: `${row.y}px`,
            left: 0,
            right: 0,
          }"
        />

        <!-- Emoji row -->
        <template v-else>
          <EmojiSprite
            v-for="(emoji, colIdx) in row.emojis"
            :key="emoji.id"
            :emoji="emoji"
            :size="emojiSize"
            :render-mode="renderMode"
            :style="{
              position: 'absolute',
              top: `${row.y}px`,
              left: `${colIdx * (emojiSize + gap)}px`,
              width: `${emojiSize}px`,
              height: `${emojiSize}px`,
            }"
            @click="handleSelect"
          />
        </template>
      </template>
    </div>

    <!-- Empty state -->
    <div v-if="sections.length === 0" class="emojix-grid-empty">
      <slot name="empty">
        <span>No emoji found</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.emojix-sectioned-grid {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: var(--emojix-scrollbar, #ccc) transparent;
}

.emojix-sectioned-grid::-webkit-scrollbar {
  width: 6px;
}

.emojix-sectioned-grid::-webkit-scrollbar-track {
  background: transparent;
}

.emojix-sectioned-grid::-webkit-scrollbar-thumb {
  background-color: var(--emojix-scrollbar, #ccc);
  border-radius: 3px;
}

.emojix-grid-content {
  position: relative;
  margin: 0 auto;
}

.emojix-sticky-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
}

.emojix-grid-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--emojix-text-muted, #999);
  font-size: 14px;
}
</style>
