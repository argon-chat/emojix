<script setup lang="ts">
/**
 * CategoryHeader - Section header for unified scroll
 * Shows category icon and name, supports sticky positioning
 */
import type { Category } from '@/core';

withDefaults(defineProps<{
  /** Category metadata */
  category: Category;
  /** Is this header sticky (pinned at top) */
  sticky?: boolean;
  /** Header height in pixels */
  height?: number;
}>(), {
  sticky: false,
  height: 32,
});
</script>

<template>
  <div
    class="emojix-category-header"
    :class="{ 'is-sticky': sticky }"
    :style="{ height: `${height}px` }"
  >
    <span class="emojix-category-icon">{{ category.icon }}</span>
    <span class="emojix-category-name">{{ category.name }}</span>
    <span class="emojix-category-count">{{ category.count }}</span>
  </div>
</template>

<style scoped>
.emojix-category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--emojix-text-muted, #666);
  background: var(--emojix-bg, #fff);
  user-select: none;
}

.emojix-category-header.is-sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
  background: var(--emojix-bg-sticky, rgba(255, 255, 255, 0.9));
  border-bottom: 1px solid var(--emojix-border, #e5e5e5);
}

.dark .emojix-category-header.is-sticky {
  background: var(--emojix-bg-sticky, rgba(30, 30, 30, 0.9));
}

.emojix-category-icon {
  font-size: 16px;
  line-height: 1;
}

.emojix-category-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.emojix-category-count {
  font-size: 11px;
  color: var(--emojix-text-muted, #999);
  opacity: 0.7;
}
</style>
