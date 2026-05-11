<script setup lang="ts">
/**
 * EmojixPicker - Main emoji picker component
 * Telegram-style unified scroll with categories and search
 * Supports extension content tabs (e.g. GIF, Stickers) via slots
 */
import { ref, computed } from 'vue';
import type { EmojiEntry, CategoryId, EmojiSelection, SkinTone, RenderMode, ContentTab } from '../../core';
import { codepointsToString } from '../../core';
import { useSearch } from '../composables/useSearch';
import { useRecents } from '../composables/useRecents';
import { useSectionedEmoji } from '../composables/useSectionedEmoji';
import SearchBar from './SearchBar.vue';
import CategoryTabs from './CategoryTabs.vue';
import ContentTabBar from './ContentTabBar.vue';
import SectionedEmojiGrid from './SectionedEmojiGrid.vue';
import EmojiGrid from './EmojiGrid.vue';

const props = withDefaults(defineProps<{
  /** Excluded category IDs */
  excludeCategories?: CategoryId[];
  /** Picker width */
  width?: number | string;
  /** Picker height */
  height?: number;
  /** Number of grid columns */
  columns?: number;
  /** Emoji size */
  emojiSize?: number;
  /** Gap between emoji */
  gap?: number;
  /** Section header height */
  headerHeight?: number;
  /** Max recent emoji */
  maxRecents?: number;
  /** Show search bar */
  showSearch?: boolean;
  /** Show category tabs */
  showTabs?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Auto focus search on open */
  autofocusSearch?: boolean;
  /** Current skin tone */
  skinTone?: SkinTone;
  /** Theme: light, dark, or auto */
  theme?: 'light' | 'dark' | 'auto';
  /** Render mode: atlas (sprites), native, twemoji, noto */
  renderMode?: RenderMode;
  /** Additional content tabs (e.g. GIF, Stickers). Emoji tab is always first. */
  contentTabs?: ContentTab[];
}>(), {
  excludeCategories: () => [],
  width: 352,
  height: 400,
  columns: 8,
  emojiSize: 32,
  gap: 4,
  headerHeight: 32,
  maxRecents: 36,
  showSearch: true,
  showTabs: true,
  searchPlaceholder: 'Search emoji...',
  autofocusSearch: false,
  skinTone: 'default',
  theme: 'auto',
  renderMode: 'atlas',
  contentTabs: () => [],
});

const emit = defineEmits<{
  select: [selection: EmojiSelection];
  skinToneChange: [skinTone: SkinTone];
  tabChange: [tabId: string];
}>();

// Content tabs: built-in emoji + user-provided extension tabs
const emojiTab: ContentTab = { id: 'emoji', label: 'Emoji', icon: '😀' };
const allContentTabs = computed(() => [emojiTab, ...props.contentTabs]);
const hasMultipleTabs = computed(() => allContentTabs.value.length > 1);

// Active content tab (top-level: emoji vs gif vs ...)
const activeContentTab = ref<string>('emoji');
const isEmojiTab = computed(() => activeContentTab.value === 'emoji');

// Current search placeholder based on active content tab
const currentPlaceholder = computed(() => {
  if (isEmojiTab.value) return props.searchPlaceholder;
  const tab = props.contentTabs.find(t => t.id === activeContentTab.value);
  return tab?.placeholder ?? props.searchPlaceholder;
});

// Handle content tab switch
const handleContentTabSelect = (tabId: string) => {
  activeContentTab.value = tabId;
  query.value = '';
  emit('tabChange', tabId);
};

// Search
const { query, results, isSearching } = useSearch();

// Recents
const { recentIds, addRecent } = useRecents({ maxRecents: props.maxRecents });

// Active tab (synced from scroll position)
const activeTab = ref<string>('emoji');

// Sectioned emoji for unified scroll
const { sections, totalHeight, customPacks, getEmojiSectionY } = useSectionedEmoji({
  recentIds,
  excludeCategories: props.excludeCategories,
  emojiSize: props.emojiSize,
  columns: props.columns,
  gap: props.gap,
  headerHeight: props.headerHeight,
});

// Has recent emoji
const hasRecents = computed(() => recentIds.value.length > 0);

// Grid height (minus search, tabs, content tab bar)
const gridHeight = computed(() => {
  let h = props.height;
  if (hasMultipleTabs.value) h -= 36; // Content tab bar height
  if (props.showSearch) h -= 48;     // Search bar height
  if (props.showTabs && isEmojiTab.value) h -= 44; // Category tabs (emoji only)
  return Math.max(h, 100);
});

// Search results as flat list
const searchEmoji = computed((): EmojiEntry[] => {
  return results.value.map(r => r.emoji);
});

// Is searching mode
const isSearchMode = computed(() => query.value.trim().length > 0);

// Sectioned grid ref for scroll methods
const sectionedGridRef = ref<InstanceType<typeof SectionedEmojiGrid> | null>(null);

// Handle emoji selection
const handleSelect = (emoji: EmojiEntry) => {
  // Add to recents
  addRecent(emoji);
  
  // Build selection
  const selection: EmojiSelection = {
    emoji,
    text: codepointsToString(emoji.codepoints),
    skinTone: props.skinTone !== 'default' ? props.skinTone : undefined,
  };
  
  emit('select', selection);
};

// Handle tab click - scroll to section
const handleTabClick = (tabId: string, type: 'recent' | 'emoji' | 'custom-pack') => {
  // Clear search when clicking tabs
  query.value = '';
  
  if (type === 'recent') {
    // Scroll to recent section
    sectionedGridRef.value?.scrollToSection('recent');
  } else if (type === 'emoji') {
    // Scroll to first standard emoji category
    const emojiY = getEmojiSectionY();
    sectionedGridRef.value?.scrollToY(emojiY);
  } else {
    // Scroll to custom pack section
    const packId = tabId.replace('pack:', '');
    if (packId === '__unassigned__') {
      sectionedGridRef.value?.scrollToSection('custom');
    } else {
      sectionedGridRef.value?.scrollToSection(`pack:${packId}` as CategoryId);
    }
  }
  
  activeTab.value = tabId;
};

// Handle category change from scroll
const handleCategoryChange = (categoryId: CategoryId) => {
  // Map category to tab
  if (categoryId === 'recent') {
    activeTab.value = 'recent';
  } else if (categoryId.startsWith('pack:')) {
    activeTab.value = categoryId;
  } else if (categoryId === 'custom') {
    activeTab.value = 'pack:__unassigned__';
  } else {
    // Standard emoji category
    activeTab.value = 'emoji';
  }
};

// Computed styles
const pickerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: `${props.height}px`,
}));

// Theme class
const themeClass = computed(() => {
  if (props.theme === 'auto') return '';
  return `emojix-theme-${props.theme}`;
});
</script>

<template>
  <div
    class="emojix-picker"
    :class="themeClass"
    :style="pickerStyle"
  >
    <!-- Top-level content tabs (Emoji | GIF | ...) -->
    <ContentTabBar
      v-if="hasMultipleTabs"
      :tabs="allContentTabs"
      :active-tab="activeContentTab"
      @select="handleContentTabSelect"
    />

    <!-- Search -->
    <SearchBar
      v-if="showSearch"
      v-model="query"
      :placeholder="currentPlaceholder"
      :autofocus="autofocusSearch"
    />
    
    <!-- Extension tab content (GIF, Stickers, etc.) -->
    <template v-if="!isEmojiTab">
      <div class="emojix-extension-pane" :style="{ height: gridHeight + 'px' }">
        <slot name="tab-content" :tab-id="activeContentTab" :search-query="query" />
      </div>
    </template>

    <!-- Emoji content -->
    <template v-else>
      <!-- Search results (flat grid) -->
      <EmojiGrid
        v-if="isSearchMode"
        :emojis="searchEmoji"
        :columns="columns"
        :emoji-size="emojiSize"
        :gap="gap"
        :height="gridHeight"
        :render-mode="renderMode"
        @select="handleSelect"
      >
        <template #empty>
          <span v-if="isSearching">Searching...</span>
          <span v-else>No emoji found for "{{ query }}"</span>
        </template>
      </EmojiGrid>
      
      <!-- Unified scroll sections (Telegram-style) -->
      <SectionedEmojiGrid
        v-else
        ref="sectionedGridRef"
        :sections="sections"
        :total-height="totalHeight"
        :columns="columns"
        :emoji-size="emojiSize"
        :gap="gap"
        :height="gridHeight"
        :header-height="headerHeight"
        :render-mode="renderMode"
        @select="handleSelect"
        @category-change="handleCategoryChange"
      >
        <template #empty>
          <span>No emoji available</span>
        </template>
      </SectionedEmojiGrid>
      
      <!-- Bottom navigation tabs: Recent | Emoji | Custom packs -->
      <CategoryTabs
        v-if="showTabs"
        :active-tab="activeTab"
        :show-recent="maxRecents > 0"
        :has-recents="hasRecents"
        :custom-packs="customPacks"
        @select="handleTabClick"
      />
    </template>
  </div>
</template>

<style scoped>
.emojix-picker {
  display: flex;
  flex-direction: column;
  background: var(--emojix-bg, #ffffff);
  border: 1px solid var(--emojix-border, #e5e7eb);
  border-radius: var(--emojix-radius, 8px);
  overflow: hidden;
  font-family: var(--emojix-font, system-ui, -apple-system, sans-serif);
}

.emojix-extension-pane {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Dark theme */
.emojix-theme-dark {
  --emojix-bg: #1f2937;
  --emojix-bg-secondary: #111827;
  --emojix-bg-hover: rgba(255, 255, 255, 0.1);
  --emojix-bg-active: rgba(59, 130, 246, 0.2);
  --emojix-border: #374151;
  --emojix-text: #f9fafb;
  --emojix-text-muted: #9ca3af;
  --emojix-scrollbar: #4b5563;
}

/* Light theme (explicit) */
.emojix-theme-light {
  --emojix-bg: #ffffff;
  --emojix-bg-secondary: #f9fafb;
  --emojix-bg-hover: rgba(0, 0, 0, 0.05);
  --emojix-bg-active: rgba(59, 130, 246, 0.1);
  --emojix-border: #e5e7eb;
  --emojix-text: #1f2937;
  --emojix-text-muted: #9ca3af;
  --emojix-scrollbar: #d1d5db;
}
</style>
