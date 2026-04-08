<script setup lang="ts">
/**
 * EmojiSprite - Renders a single emoji
 * Supports multiple render modes: atlas (sprites), native, twemoji font, noto font
 * Supports video/WebM for animated custom emoji
 * Supports placeholder state while loading
 * Videos are synchronized via VideoSyncManager
 */
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { EmojiEntry, CustomEmojiInput, RenderMode } from '@/core';
import { spriteResolver, customEmojiStore, codepointsToString, videoSyncManager } from '@/core';
import type { LoadedEmoji } from '@/core/registry/CustomEmojiQueue';

const props = withDefaults(defineProps<{
  /** Emoji entry to render */
  emoji: EmojiEntry;
  /** Display size in pixels */
  size?: number;
  /** Render mode */
  renderMode?: RenderMode;
  /** Custom emoji data (optional override, otherwise fetched from store) */
  customData?: CustomEmojiInput;
  /** Show placeholder while loading */
  showPlaceholder?: boolean;
  /** Pause video playback */
  paused?: boolean;
  /** Use document ID for lazy loading from queue */
  documentId?: string;
  /** Is colorable (single-color emoji) */
  colorable?: boolean;
}>(), {
  size: 32,
  renderMode: 'atlas',
  showPlaceholder: true,
  paused: false,
  colorable: false,
});

const emit = defineEmits<{
  click: [emoji: EmojiEntry];
  load: [emoji: EmojiEntry];
}>();

/**
 * Loading state for dynamic emoji
 */
const isLoading = ref(false);
const loadedData = ref<LoadedEmoji | null>(null);

/**
 * Unsubscribe from load events
 */
let unsubscribe: (() => void) | null = null;

/**
 * Get custom data from store if not provided
 */
const resolvedCustomData = computed((): CustomEmojiInput | undefined => {
  if (props.customData) return props.customData;
  if (!props.emoji.isCustom) return undefined;
  
  // Extract custom ID from emoji.id (format: "custom:customId")
  const customId = props.emoji.id.replace(/^custom:/, '');
  const stored = customEmojiStore.get(customId);
  return stored?.input;
});

/**
 * Determine if this is a video emoji
 */
const isVideo = computed(() => {
  const data = loadedData.value;
  if (data?.isVideo) return true;
  
  const customData = resolvedCustomData.value;
  if (!customData?.url) return false;
  
  const url = customData.url.toLowerCase();
  return url.endsWith('.webm') || url.endsWith('.mp4') || url.endsWith('.gif');
});

/**
 * Get the URL to render
 */
const renderUrl = computed(() => {
  if (loadedData.value?.url) return loadedData.value.url;
  return resolvedCustomData.value?.url;
});

/**
 * Should use font-based rendering?
 */
const useFontMode = computed(() => {
  // Custom emoji always use atlas/image mode
  if (props.emoji.isCustom) return false;
  return props.renderMode !== 'atlas';
});

/**
 * Unicode text for font rendering
 */
const emojiText = computed(() => {
  return codepointsToString(props.emoji.codepoints);
});

/**
 * Font family based on render mode
 */
const fontFamily = computed(() => {
  switch (props.renderMode) {
    case 'twemoji':
      return '"Twemoji Mozilla", "Twemoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    case 'noto':
      return '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    case 'native':
    default:
      return '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiOne Color", sans-serif';
  }
});

/**
 * Computed sprite styles (for atlas mode)
 */
const spriteStyle = computed(() => {
  if (useFontMode.value) return null;
  if (isVideo.value) return null;
  if (isLoading.value && props.showPlaceholder) return null;
  
  const { emoji, size } = props;
  const customData = resolvedCustomData.value;
  
  // Loaded from queue
  if (loadedData.value?.url && !loadedData.value.isVideo) {
    return spriteResolver.getCustomSingleStyle(loadedData.value.url, size);
  }
  
  // Custom emoji with single image
  if (emoji.isCustom && customData?.url && !isVideo.value) {
    return spriteResolver.getCustomSingleStyle(customData.url, size);
  }
  
  // Custom emoji with atlas
  if (emoji.isCustom && customData?.atlasUrl && customData?.atlasPosition) {
    return spriteResolver.getCustomAtlasStyle(
      customData.atlasUrl,
      customData.atlasPosition,
      size
    );
  }
  
  // Standard emoji from bundled atlas
  return spriteResolver.getStyle(emoji, size);
});

/**
 * Font mode styles
 */
const fontStyle = computed(() => {
  if (!useFontMode.value) return null;
  
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${props.size * 0.8}px`,
    lineHeight: `${props.size}px`,
    fontFamily: fontFamily.value,
  };
});

/**
 * Video styles
 */
const videoStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

/**
 * Placeholder styles
 */
const placeholderStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

/**
 * Load custom emoji from queue if documentId provided
 */
const loadFromQueue = () => {
  if (!props.documentId) return;
  
  isLoading.value = true;
  
  const cached = customEmojiStore.ensureLoaded(props.documentId, (loaded) => {
    const found = loaded.find(e => e.documentId === props.documentId);
    if (found) {
      loadedData.value = found;
      isLoading.value = false;
      emit('load', props.emoji);
    }
  });
  
  if (cached) {
    loadedData.value = cached;
    isLoading.value = false;
  }
};

/**
 * Control video playback
 */
watch(() => props.paused, (paused) => {
  const url = renderUrl.value;
  if (!url) return;
  videoSyncManager.setPaused(url, paused);
});

// Video sync state
let videoSyncId: string | null = null;
let videoSyncUrl: string | null = null;
const canvasRef = ref<HTMLCanvasElement | null>(null);

/**
 * Register with sync manager - get synced canvas
 */
const setupVideoSync = () => {
  const url = renderUrl.value;
  if (!url || !isVideo.value) return;
  
  // Cleanup previous registration
  cleanupVideoSync();
  
  try {
    const { id, canvas } = videoSyncManager.register(url, props.size, props.size);
    videoSyncId = id;
    videoSyncUrl = url;
    canvasRef.value = canvas;
  } catch (e) {
    console.error('[EmojiSprite] Failed to register video sync:', e);
  }
};

/**
 * Cleanup video sync registration
 */
const cleanupVideoSync = () => {
  if (videoSyncId && videoSyncUrl) {
    videoSyncManager.unregister(videoSyncUrl, videoSyncId);
    videoSyncId = null;
    videoSyncUrl = null;
    canvasRef.value = null;
  }
};

// Setup sync when URL or size changes
watch([renderUrl, () => props.size, isVideo], () => {
  const url = renderUrl.value;
  const isVid = isVideo.value;
  
  if (url && isVid) {
    nextTick(() => setupVideoSync());
  } else {
    cleanupVideoSync();
  }
}, { immediate: true });

onMounted(() => {
  if (props.documentId) {
    loadFromQueue();
  }
  
  // Setup video sync after mount
  if (renderUrl.value && isVideo.value) {
    nextTick(() => setupVideoSync());
  }
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  
  cleanupVideoSync();
});

const handleClick = () => {
  emit('click', props.emoji);
};

// Container ref for mounting synced canvas
const videoContainerRef = ref<HTMLElement | null>(null);

// Mount canvas when container is ready
watch([videoContainerRef, canvasRef], ([container, canvas]) => {
  if (container && canvas) {
    // Clear previous content
    container.innerHTML = '';
    container.appendChild(canvas);
  }
});
</script>

<template>
  <!-- Placeholder while loading -->
  <button
    v-if="isLoading && showPlaceholder"
    type="button"
    class="emojix-sprite emojix-sprite--placeholder"
    :style="placeholderStyle"
    :title="emoji.name"
    disabled
  >
    <span class="emojix-placeholder-pulse" />
  </button>
  
  <!-- Video mode: synced canvas from VideoSyncManager -->
  <button
    v-else-if="isVideo && renderUrl"
    ref="videoContainerRef"
    type="button"
    class="emojix-sprite emojix-sprite--video"
    :class="{ 'emojix-sprite--colorable': colorable }"
    :style="videoStyle"
    :title="emoji.name"
    :data-shortcode="emoji.shortcode"
    @click="handleClick"
  />
  
  <!-- Font mode: render as text -->
  <button
    v-else-if="useFontMode"
    type="button"
    class="emojix-sprite emojix-sprite--font"
    :style="fontStyle ?? undefined"
    :title="emoji.name"
    :data-shortcode="emoji.shortcode"
    @click="handleClick"
  >
    {{ emojiText }}
  </button>
  
  <!-- Atlas mode: render as CSS sprite -->
  <button
    v-else
    type="button"
    class="emojix-sprite emojix-sprite--atlas"
    :class="{ 'emojix-sprite--colorable': colorable }"
    :style="spriteStyle ?? undefined"
    :title="emoji.name"
    :data-shortcode="emoji.shortcode"
    @click="handleClick"
  >
    <span class="sr-only">{{ emoji.name }}</span>
  </button>
</template>

<style scoped>
.emojix-sprite {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
  margin: 0;
  background-color: transparent;
  cursor: pointer;
  border-radius: var(--emojix-sprite-radius, 4px);
  transition: transform 0.1s ease, background-color 0.1s ease;
  flex-shrink: 0;
}

.emojix-sprite--atlas {
  background-repeat: no-repeat;
}

.emojix-sprite--font {
  text-align: center;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.emojix-sprite--video {
  overflow: hidden;
}

.emojix-sprite--video video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.emojix-sprite--placeholder {
  cursor: default;
  overflow: hidden;
}

.emojix-placeholder-pulse {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: var(--emojix-sprite-radius, 4px);
  background: linear-gradient(
    90deg,
    var(--emojix-placeholder-bg, rgba(128, 128, 128, 0.1)) 25%,
    var(--emojix-placeholder-shine, rgba(128, 128, 128, 0.2)) 50%,
    var(--emojix-placeholder-bg, rgba(128, 128, 128, 0.1)) 75%
  );
  background-size: 200% 100%;
  animation: emojix-placeholder-shimmer 1.5s ease-in-out infinite;
}

@keyframes emojix-placeholder-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Colorable emoji - can be tinted via CSS filter */
.emojix-sprite--colorable {
  filter: var(--emojix-colorable-filter, none);
}

.emojix-sprite:hover:not(.emojix-sprite--placeholder) {
  background-color: var(--emojix-bg-hover, rgba(0, 0, 0, 0.05));
  transform: scale(1.15);
}

.emojix-sprite:active:not(.emojix-sprite--placeholder) {
  transform: scale(0.95);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
