<script setup lang="ts">
/**
 * EmojiGrid - Virtualized grid of emoji sprites
 * Only renders visible items for performance
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { EmojiEntry, RenderMode } from '../../core';
import { useVirtualScroll } from '../composables/useVirtualScroll';
import EmojiSprite from './EmojiSprite.vue';

const props = withDefaults(defineProps<{
  /** Emoji to display */
  emojis: EmojiEntry[];
  /** Number of columns */
  columns?: number;
  /** Emoji size in pixels */
  emojiSize?: number;
  /** Gap between items */
  gap?: number;
  /** Container height */
  height?: number;
  /** Render mode: atlas, native, twemoji, noto */
  renderMode?: RenderMode;
}>(), {
  columns: 8,
  emojiSize: 32,
  gap: 4,
  height: 300,
  renderMode: 'atlas',
});

const emit = defineEmits<{
  select: [emoji: EmojiEntry];
}>();

// Container ref for height measurement
const containerRef = ref<HTMLElement | null>(null);
const containerHeight = ref(props.height);

// Update container height on resize
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// Emoji list ref for virtual scroll
const emojiList = computed(() => props.emojis);

// Virtual scroll
const {
  visibleItems,
  totalHeight,
  onScroll,
} = useVirtualScroll({
  items: emojiList,
  itemHeight: props.emojiSize,
  columns: props.columns,
  containerHeight,
  bufferRows: 3,
  gap: props.gap,
});

// Grid width
const gridWidth = computed(() => {
  return props.columns * (props.emojiSize + props.gap) - props.gap;
});

// Handle selection
const handleSelect = (emoji: EmojiEntry) => {
  emit('select', emoji);
};
</script>

<template>
  <div
    ref="containerRef"
    class="emojix-grid"
    :style="{ height: `${height}px` }"
    @scroll="onScroll"
  >
    <div
      class="emojix-grid-content"
      :style="{
        height: `${totalHeight}px`,
        width: `${gridWidth}px`,
      }"
    >
      <EmojiSprite
        v-for="{ item, style } in visibleItems"
        :key="item.id"
        :emoji="item"
        :size="emojiSize"
        :render-mode="renderMode"
        :style="style"
        @click="handleSelect"
      />
    </div>
    
    <!-- Empty state -->
    <div v-if="emojis.length === 0" class="emojix-grid-empty">
      <slot name="empty">
        <span>No emoji found</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.emojix-grid {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: var(--emojix-scrollbar, #ccc) transparent;
}

.emojix-grid::-webkit-scrollbar {
  width: 6px;
}

.emojix-grid::-webkit-scrollbar-track {
  background: transparent;
}

.emojix-grid::-webkit-scrollbar-thumb {
  background-color: var(--emojix-scrollbar, #ccc);
  border-radius: 3px;
}

.emojix-grid-content {
  position: relative;
  margin: 0 auto;
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
