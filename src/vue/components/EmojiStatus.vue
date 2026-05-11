<script setup lang="ts">
/**
 * EmojiStatus - Universal emoji renderer for arbitrary placement
 * 
 * Simple component for rendering a single emoji (including animated) anywhere in UI.
 * Perfect for user status icons, profile badges, inline decorations, etc.
 * 
 * @example
 * ```vue
 * <!-- Unicode emoji -->
 * <EmojiStatus emoji="😀" :size="24" />
 * 
 * <!-- By ID (including custom) -->
 * <EmojiStatus emoji-id="custom:fire" :size="24" />
 * 
 * <!-- Direct URL (auto-detects video) -->
 * <EmojiStatus url="https://example.com/sticker.webm" :size="32" fallback="🔥" />
 * 
 * <!-- Full custom emoji input -->
 * <EmojiStatus :custom="{ url: '...', fallbackEmoji: '❤️' }" :size="24" />
 * ```
 */
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { EmojiEntry, CustomEmojiInput, RenderMode } from '../../core';
import { 
  emojiRegistry, 
  customEmojiStore, 
  spriteResolver, 
  codepointsToString,
  stringToCodepoints,
  codepointsToHexcode,
  videoSyncManager,
} from '../../core';

const props = withDefaults(defineProps<{
  /** Unicode emoji string (e.g., "😀") */
  emoji?: string;
  /** Emoji ID from registry (e.g., "1f600" or "custom:my-emoji") */
  emojiId?: string;
  /** EmojiEntry object */
  entry?: EmojiEntry;
  /** Direct URL to image/video */
  url?: string;
  /** Full custom emoji configuration */
  custom?: CustomEmojiInput;
  /** Display size in pixels */
  size?: number;
  /** Render mode for standard emoji */
  renderMode?: RenderMode;
  /** Fallback emoji if URL fails or while loading */
  fallback?: string;
  /** Show loading placeholder */
  showPlaceholder?: boolean;
  /** Pause video playback */
  paused?: boolean;
  /** Additional CSS class */
  class?: string;
  /** Inline display (default) or block */
  inline?: boolean;
  /** Alt text for accessibility */
  alt?: string;
}>(), {
  size: 20,
  renderMode: 'atlas',
  showPlaceholder: true,
  paused: false,
  inline: true,
});

const emit = defineEmits<{
  load: [];
  error: [error: Error];
  click: [];
}>();

// Loading state
const isLoading = ref(false);
const hasError = ref(false);

/**
 * Resolve emoji entry from various input formats
 */
const resolvedEntry = computed((): EmojiEntry | null => {
  // Direct entry
  if (props.entry) return props.entry;
  
  // By ID
  if (props.emojiId) {
    // Custom emoji ID
    if (props.emojiId.startsWith('custom:')) {
      const customId = props.emojiId.slice(7);
      const stored = customEmojiStore.get(customId);
      return stored?.entry ?? null;
    }
    // Standard emoji by hexcode
    return emojiRegistry.getByHexcode(props.emojiId) ?? null;
  }
  
  // Unicode emoji string
  if (props.emoji && !props.url && !props.custom) {
    const codepoints = stringToCodepoints(props.emoji);
    if (codepoints.length) {
      const hexcode = codepointsToHexcode(codepoints);
      return emojiRegistry.getByHexcode(hexcode) ?? null;
    }
  }
  
  return null;
});

/**
 * Resolve custom emoji data
 */
const resolvedCustom = computed((): CustomEmojiInput | null => {
  // Direct custom input
  if (props.custom) return props.custom;
  
  // From URL (create minimal custom input)
  if (props.url) {
    return {
      id: `url-${props.url}`,
      shortcode: 'custom',
      url: props.url,
      fallbackEmoji: props.fallback,
    };
  }
  
  // From resolved entry if it's custom
  if (resolvedEntry.value?.isCustom) {
    const customId = resolvedEntry.value.id.replace(/^custom:/, '');
    return customEmojiStore.get(customId)?.input ?? null;
  }
  
  return null;
});

/**
 * Determine render URL
 */
const renderUrl = computed(() => {
  return resolvedCustom.value?.url ?? null;
});

/**
 * Is this a video emoji?
 */
const isVideo = computed(() => {
  const url = renderUrl.value;
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.webm') || lower.endsWith('.mp4') || lower.endsWith('.gif');
});

/**
 * Get fallback text
 */
const fallbackText = computed(() => {
  if (props.fallback) return props.fallback;
  if (resolvedCustom.value?.fallbackEmoji) return resolvedCustom.value.fallbackEmoji;
  if (props.emoji) return props.emoji;
  if (resolvedEntry.value) return codepointsToString(resolvedEntry.value.codepoints);
  return '❓';
});

/**
 * Sprite styles for atlas rendering
 */
const spriteStyle = computed(() => {
  const entry = resolvedEntry.value;
  const custom = resolvedCustom.value;
  
  // Video uses canvas, not sprite
  if (isVideo.value) return null;
  
  // Custom with direct URL (static image)
  if (custom?.url && !isVideo.value) {
    return spriteResolver.getCustomSingleStyle(custom.url, props.size);
  }
  
  // Custom with atlas
  if (custom?.atlasUrl && custom?.atlasPosition) {
    return spriteResolver.getCustomAtlasStyle(
      custom.atlasUrl,
      custom.atlasPosition,
      props.size
    );
  }
  
  // Standard emoji from bundled atlas
  if (entry && !entry.isCustom) {
    return spriteResolver.getStyle(entry, props.size);
  }
  
  return null;
});

/**
 * Should use native font rendering?
 */
const useFontMode = computed(() => {
  if (props.url || props.custom || resolvedEntry.value?.isCustom) return false;
  return props.renderMode !== 'atlas';
});

/**
 * Font rendering styles
 */
const fontStyle = computed(() => {
  if (!useFontMode.value) return null;
  
  const fontFamily = (() => {
    switch (props.renderMode) {
      case 'twemoji':
        return '"Twemoji Mozilla", "Twemoji", "Apple Color Emoji", sans-serif';
      case 'noto':
        return '"Noto Color Emoji", "Apple Color Emoji", sans-serif';
      default:
        return '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    }
  })();
  
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${props.size * 0.85}px`,
    lineHeight: `${props.size}px`,
    fontFamily,
  };
});

/**
 * Unicode text for font rendering
 */
const emojiText = computed(() => {
  if (props.emoji) return props.emoji;
  if (resolvedEntry.value) return codepointsToString(resolvedEntry.value.codepoints);
  return fallbackText.value;
});

// Video sync state
let videoSyncId: string | null = null;
let videoSyncUrl: string | null = null;
const canvasRef = ref<HTMLCanvasElement | null>(null);
const videoContainerRef = ref<HTMLElement | null>(null);

/**
 * Setup video synchronization
 */
const setupVideoSync = () => {
  const url = renderUrl.value;
  if (!url || !isVideo.value) return;
  
  cleanupVideoSync();
  
  try {
    isLoading.value = true;
    const { id, canvas } = videoSyncManager.register(url, props.size, props.size);
    videoSyncId = id;
    videoSyncUrl = url;
    canvasRef.value = canvas;
    
    // Consider loaded once we have canvas
    isLoading.value = false;
    hasError.value = false;
    emit('load');
  } catch (e) {
    console.error('[EmojiStatus] Failed to setup video:', e);
    hasError.value = true;
    isLoading.value = false;
    emit('error', e instanceof Error ? e : new Error(String(e)));
  }
};

/**
 * Cleanup video sync
 */
const cleanupVideoSync = () => {
  if (videoSyncId && videoSyncUrl) {
    videoSyncManager.unregister(videoSyncUrl, videoSyncId);
    videoSyncId = null;
    videoSyncUrl = null;
    canvasRef.value = null;
  }
};

// Mount canvas to container
watch([videoContainerRef, canvasRef], ([container, canvas]) => {
  if (container && canvas) {
    container.innerHTML = '';
    container.appendChild(canvas);
  }
});

// Sync URL/size changes
watch([renderUrl, () => props.size, isVideo], () => {
  if (renderUrl.value && isVideo.value) {
    nextTick(() => setupVideoSync());
  } else {
    cleanupVideoSync();
  }
}, { immediate: true });

// Pause control
watch(() => props.paused, (paused) => {
  const url = renderUrl.value;
  if (url) {
    videoSyncManager.setPaused(url, paused);
  }
});

onMounted(() => {
  if (renderUrl.value && isVideo.value) {
    nextTick(() => setupVideoSync());
  }
});

onUnmounted(() => {
  cleanupVideoSync();
});

const handleClick = () => {
  emit('click');
};
</script>

<template>
  <span
    class="emojix-status"
    :class="[
      props.class,
      {
        'emojix-status--inline': inline,
        'emojix-status--block': !inline,
        'emojix-status--loading': isLoading,
        'emojix-status--error': hasError,
      }
    ]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="alt"
    @click="handleClick"
  >
    <!-- Video/Animated emoji -->
    <span
      v-if="isVideo && !hasError"
      ref="videoContainerRef"
      class="emojix-status__video"
      :style="{ width: `${size}px`, height: `${size}px` }"
    />
    
    <!-- Loading placeholder -->
    <span
      v-else-if="isLoading && showPlaceholder"
      class="emojix-status__placeholder"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      {{ fallbackText }}
    </span>
    
    <!-- Error fallback -->
    <span
      v-else-if="hasError"
      class="emojix-status__fallback"
      :style="fontStyle"
    >
      {{ fallbackText }}
    </span>
    
    <!-- Font-based rendering -->
    <span
      v-else-if="useFontMode"
      class="emojix-status__font"
      :style="fontStyle"
    >
      {{ emojiText }}
    </span>
    
    <!-- Atlas/sprite rendering -->
    <span
      v-else-if="spriteStyle"
      class="emojix-status__sprite"
      :style="spriteStyle"
    />
    
    <!-- Ultimate fallback -->
    <span
      v-else
      class="emojix-status__fallback"
      :style="fontStyle"
    >
      {{ fallbackText }}
    </span>
  </span>
</template>

<style scoped>
.emojix-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  flex-shrink: 0;
  cursor: default;
  user-select: none;
}

.emojix-status--block {
  display: flex;
}

.emojix-status__video {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--emojix-sprite-radius, 4px);
}

.emojix-status__video :deep(canvas) {
  display: block;
  object-fit: contain;
}

.emojix-status__sprite {
  display: block;
  background-repeat: no-repeat;
  border-radius: var(--emojix-sprite-radius, 4px);
}

.emojix-status__font {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.emojix-status__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  animation: emojix-pulse 1.5s ease-in-out infinite;
}

.emojix-status__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
}

@keyframes emojix-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}
</style>
