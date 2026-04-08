<script setup lang="ts">
/**
 * CategoryTabs - Bottom navigation tabs
 * Shows: Recent | Emoji | Custom packs
 */
import { computed, ref } from 'vue';

/** Custom pack info for tabs */
export interface CustomPack {
  id: string;
  name: string;
  icon: string;
}

/** Tab item for display */
interface TabItem {
  id: string;
  name: string;
  icon: string;
  type: 'recent' | 'emoji' | 'custom-pack';
}

const props = withDefaults(defineProps<{
  /** Currently active tab */
  activeTab: string;
  /** Show recent tab */
  showRecent?: boolean;
  /** Has recent emoji */
  hasRecents?: boolean;
  /** Custom emoji packs */
  customPacks?: CustomPack[];
}>(), {
  showRecent: true,
  hasRecents: false,
  customPacks: () => [],
});

const emit = defineEmits<{
  select: [tabId: string, type: 'recent' | 'emoji' | 'custom-pack'];
}>();

// Ref for horizontal wheel scroll
const tabsRef = ref<HTMLElement | null>(null);

// Convert vertical wheel to horizontal scroll
const handleWheel = (event: WheelEvent) => {
  if (!tabsRef.value) return;
  event.preventDefault();
  tabsRef.value.scrollLeft += event.deltaY;
};

// Build tab list: Recent | Emoji | Custom packs
const tabs = computed<TabItem[]>(() => {
  const result: TabItem[] = [];
  
  // Recent tab
  if (props.showRecent) {
    result.push({
      id: 'recent',
      name: 'Recent',
      icon: '🕐',
      type: 'recent',
    });
  }
  
  // Emoji tab (all standard emoji)
  result.push({
    id: 'emoji',
    name: 'Emoji',
    icon: '😀',
    type: 'emoji',
  });
  
  // Custom packs
  for (const pack of props.customPacks) {
    result.push({
      id: `pack:${pack.id}`,
      name: pack.name,
      icon: pack.icon,
      type: 'custom-pack',
    });
  }
  
  return result;
});

const handleSelect = (tab: TabItem) => {
  emit('select', tab.id, tab.type);
};
</script>

<template>
  <div class="emojix-tabs-wrapper">
    <div 
      ref="tabsRef"
      class="emojix-tabs"
      @wheel="handleWheel"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="emojix-tab"
        :class="{ 'emojix-tab--active': activeTab === tab.id }"
        :title="tab.name"
        @click="handleSelect(tab)"
      >
        <span class="emojix-tab-icon">{{ tab.icon }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.emojix-tabs-wrapper {
  position: relative;
  border-top: 1px solid var(--emojix-border, #e5e7eb);
  background: var(--emojix-bg-secondary, #f9fafb);
}

.emojix-tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--emojix-scrollbar, #ccc) transparent;
  -webkit-overflow-scrolling: touch;
}

.emojix-tabs::-webkit-scrollbar {
  height: 4px;
}

.emojix-tabs::-webkit-scrollbar-track {
  background: transparent;
}

.emojix-tabs::-webkit-scrollbar-thumb {
  background-color: var(--emojix-scrollbar, #ccc);
  border-radius: 2px;
}

.emojix-tab {
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--emojix-radius, 6px);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.emojix-tab:hover {
  background: var(--emojix-bg-hover, rgba(0, 0, 0, 0.05));
}

.emojix-tab--active {
  background: var(--emojix-bg-active, rgba(59, 130, 246, 0.1));
}

.emojix-tab--active .emojix-tab-icon {
  transform: scale(1.1);
}

.emojix-tab-icon {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.15s ease;
}
</style>
