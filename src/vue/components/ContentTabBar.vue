<script setup lang="ts">
/**
 * ContentTabBar - Top-level content type tabs (Emoji, GIF, etc.)
 * Shown above the search bar when multiple content tabs are configured.
 */
import type { ContentTab } from '../../core';

const props = defineProps<{
  tabs: ContentTab[];
  activeTab: string;
}>();

const emit = defineEmits<{
  select: [tabId: string];
}>();
</script>

<template>
  <div class="emojix-content-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="emojix-content-tab"
      :class="{ 'emojix-content-tab--active': activeTab === tab.id }"
      @click="emit('select', tab.id)"
    >
      <span class="emojix-content-tab-icon">{{ tab.icon }}</span>
      <span class="emojix-content-tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.emojix-content-tabs {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--emojix-border, #e5e7eb);
  background: var(--emojix-bg, #ffffff);
}

.emojix-content-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: transparent;
  border-radius: var(--emojix-radius, 6px);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--emojix-text-muted, #9ca3af);
  transition: background-color 0.15s ease, color 0.15s ease;
  line-height: 1.4;
}

.emojix-content-tab:hover {
  background: var(--emojix-bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--emojix-text, #1f2937);
}

.emojix-content-tab--active {
  background: var(--emojix-bg-active, rgba(59, 130, 246, 0.1));
  color: var(--emojix-text, #1f2937);
}

.emojix-content-tab-icon {
  font-size: 16px;
  line-height: 1;
}

.emojix-content-tab-label {
  font-size: 12px;
}
</style>
