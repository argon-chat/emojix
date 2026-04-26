<script setup lang="ts">
/**
 * EmojiInput - Rich text input with inline emoji rendering
 * 
 * Based on Telegram Web approach:
 * - Uses contenteditable div
 * - Renders emoji as <img> elements or synced canvas for video
 * - Exports plaintext with unicode emoji for copying/sending
 * - Video emoji are synchronized via VideoSyncManager
 * 
 * Headless-friendly: exposes cursor position API in plaintext coordinates
 * so parent components can implement mentions, slash commands, auto-replace etc.
 */
import { 
  ref, 
  computed, 
  watch, 
  onMounted,
  onUnmounted,
  nextTick,
} from 'vue';
import type { EmojiEntry, RenderMode } from '@/core';
import { 
  spriteResolver, 
  customEmojiStore, 
  codepointsToString,
  splitTextAndEmoji,
  videoSyncManager,
} from '@/core';

const props = withDefaults(defineProps<{
  /** v-model value (plaintext with unicode emoji) */
  modelValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Render mode for emoji */
  renderMode?: RenderMode;
  /** Emoji size in pixels */
  emojiSize?: number;
  /** Max length (unicode chars) */
  maxLength?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Autofocus on mount */
  autofocus?: boolean;
  /** Single line mode (no enter) */
  singleLine?: boolean;
  /** Unstyled mode — no wrapper border/bg, for embedding in custom containers */
  unstyled?: boolean;
}>(), {
  modelValue: '',
  placeholder: '',
  renderMode: 'atlas',
  emojiSize: 20,
  disabled: false,
  autofocus: false,
  singleLine: false,
  unstyled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'submit': [value: string];
  'focus': [];
  'blur': [];
  'keydown': [event: KeyboardEvent];
  'input': [];
  'paste': [event: ClipboardEvent];
}>();

// Refs
const editorRef = ref<HTMLDivElement | null>(null);
const isFocused = ref(false);

// Internal HTML content
const internalHtml = ref('');

// Track if we're programmatically updating to avoid loops
let isUpdating = false;

// Video sync tracking: spanId -> { url, syncId }
const videoSyncMap = new Map<string, { url: string; syncId: string }>();
let videoIdCounter = 0;

// MutationObserver for tracking video emoji spans
let mutationObserver: MutationObserver | null = null;

/**
 * Generate unique ID for video spans
 */
const generateVideoSpanId = () => `emojix-video-${++videoIdCounter}`;

/**
 * Convert emoji to inline image HTML
 */
const emojiToHtml = (emoji: string, entry?: EmojiEntry): string => {
  const size = props.emojiSize;
  
  // Check if it's a custom emoji
  if (entry?.isCustom) {
    const customId = entry.id.replace(/^custom:/, '');
    const customData = customEmojiStore.get(customId)?.input;
    
    if (customData?.url) {
      // Use fallbackEmoji for copy/paste, or original emoji if not set
      const copyEmoji = customData.fallbackEmoji || emoji;
      const isVideo = customData.url.toLowerCase().match(/\.(webm|mp4|gif)$/);
      
      if (isVideo) {
        // Use data-video-url for synced rendering
        const spanId = generateVideoSpanId();
        return `<span class="emojix-inline-emoji emojix-inline-video" data-emoji="${copyEmoji}" data-video-url="${customData.url}" data-video-id="${spanId}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;" contenteditable="false" title="${customData.name || customData.shortcode}"></span>`;
      }
      
      return `<img class="emojix-inline-emoji" src="${customData.url}" alt="${copyEmoji}" data-emoji="${copyEmoji}" width="${size}" height="${size}" draggable="false" title="${customData.name || customData.shortcode}" />`;
    }
  }
  
  // Standard emoji - use atlas sprite as background
  if (props.renderMode === 'atlas' && entry) {
    const style = spriteResolver.getStyle(entry, size);
    if (style) {
      const cssText = Object.entries(style)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
        .join(';');
      return `<span class="emojix-inline-emoji emojix-inline-sprite" style="${cssText}" data-emoji="${emoji}" contenteditable="false" title="${entry.name}"></span>`;
    }
  }
  
  // Fallback - render as image from Twemoji CDN
  const codepoints = [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(cp => cp !== 'fe0f') // Remove VS16
    .join('-');
  
  return `<img class="emojix-inline-emoji" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codepoints}.png" alt="${emoji}" data-emoji="${emoji}" width="${size}" height="${size}" draggable="false" />`;
};

/**
 * Scan editor for video spans and setup sync
 */
const syncVideoSpans = () => {
  if (!editorRef.value) return;
  
  const currentSpanIds = new Set<string>();
  const videoSpans = editorRef.value.querySelectorAll<HTMLSpanElement>('[data-video-url]');
  
  for (const span of videoSpans) {
    const url = span.getAttribute('data-video-url');
    const spanId = span.getAttribute('data-video-id');
    
    if (!url || !spanId) continue;
    
    currentSpanIds.add(spanId);
    
    // Already registered?
    if (videoSyncMap.has(spanId)) continue;
    
    // Register with VideoSyncManager
    try {
      const { id: syncId, canvas } = videoSyncManager.register(url, props.emojiSize, props.emojiSize);
      videoSyncMap.set(spanId, { url, syncId });
      
      // Clear span and insert canvas
      span.innerHTML = '';
      span.appendChild(canvas);
    } catch (e) {
      console.error('[EmojiInput] Failed to register video sync:', e);
    }
  }
  
  // Cleanup removed spans
  for (const [spanId, { url, syncId }] of videoSyncMap) {
    if (!currentSpanIds.has(spanId)) {
      videoSyncManager.unregister(url, syncId);
      videoSyncMap.delete(spanId);
    }
  }
};

/**
 * Cleanup all video syncs
 */
const cleanupAllVideoSyncs = () => {
  for (const [, { url, syncId }] of videoSyncMap) {
    videoSyncManager.unregister(url, syncId);
  }
  videoSyncMap.clear();
};

/**
 * Convert plaintext to rich HTML
 */
const textToHtml = (text: string): string => {
  if (!text) return '';
  
  const segments = splitTextAndEmoji(text);
  let html = '';
  
  for (const segment of segments) {
    if (segment.type === 'emoji') {
      html += emojiToHtml(segment.content);
    } else {
      // Escape HTML and preserve whitespace
      html += segment.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  }
  
  return html;
};

/**
 * Convert rich HTML back to plaintext (from a DOM node tree).
 * Used internally to extract plaintext from the contenteditable.
 */
const htmlToTextFromNode = (root: Node): string => {
  let text = '';
  
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      
      // BR = newline
      if (el.tagName === 'BR') {
        text += '\n';
        return;
      }
      
      // Check for emoji marker
      const emoji = el.getAttribute('data-emoji');
      if (emoji) {
        text += emoji;
        return;
      }
      
      // Recurse children
      for (const child of el.childNodes) {
        walk(child);
      }
      
      // Block elements add newline
      if (['P', 'DIV'].includes(el.tagName) && text && !text.endsWith('\n')) {
        text += '\n';
      }
    }
  };
  
  walk(root);
  
  // Trim trailing newlines from block elements
  return text.replace(/\n+$/, '');
};

/**
 * Convert rich HTML string back to plaintext
 */
const htmlToText = (html: string): string => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return htmlToTextFromNode(temp);
};

// ── Plaintext cursor position API ──
// These methods convert between DOM Selection/Range (contenteditable world)
// and integer offsets in the plaintext string (what the consumer works with).

/**
 * Get plaintext offset of the current cursor position.
 * Walks the DOM tree and counts text chars + data-emoji lengths up to the cursor.
 */
const getCursorOffset = (): number => {
  const el = editorRef.value;
  if (!el) return 0;
  
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  
  const range = sel.getRangeAt(0);
  
  // Create a range from start of editor to cursor
  const preRange = document.createRange();
  preRange.setStart(el, 0);
  preRange.setEnd(range.startContainer, range.startOffset);
  
  // Clone contents and measure plaintext length
  const fragment = preRange.cloneContents();
  const temp = document.createElement('div');
  temp.appendChild(fragment);
  
  return htmlToTextFromNode(temp).length;
};

/**
 * Get plaintext before the cursor.
 */
const getTextBeforeCursor = (): string => {
  const text = getText();
  const offset = getCursorOffset();
  return text.slice(0, offset);
};

/**
 * Get the full plaintext value.
 */
const getText = (): string => {
  return htmlToTextFromNode(editorRef.value ?? document.createElement('div'));
};

/**
 * Set cursor to a plaintext offset.
 * Walks DOM nodes counting plaintext chars until the target offset, then places the cursor.
 */
const setCursorOffset = (targetOffset: number) => {
  const el = editorRef.value;
  if (!el) return;
  
  let remaining = targetOffset;
  
  const findPosition = (node: Node): { node: Node; offset: number } | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) {
        return { node, offset: remaining };
      }
      remaining -= len;
      return null;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      
      // BR = 1 char (\n)
      if (el.tagName === 'BR') {
        if (remaining <= 0) {
          return { node: el.parentNode!, offset: Array.from(el.parentNode!.childNodes).indexOf(el) };
        }
        remaining -= 1;
        return null;
      }
      
      // Emoji element = N chars of the emoji unicode
      const emojiAttr = el.getAttribute('data-emoji');
      if (emojiAttr) {
        const len = emojiAttr.length;
        if (remaining <= 0) {
          return { node: el.parentNode!, offset: Array.from(el.parentNode!.childNodes).indexOf(el) };
        }
        if (remaining <= len) {
          // Place cursor after this emoji element
          const parent = el.parentNode!;
          const idx = Array.from(parent.childNodes).indexOf(el);
          remaining = 0;
          return { node: parent, offset: idx + 1 };
        }
        remaining -= len;
        return null;
      }
      
      // Recurse children
      for (const child of el.childNodes) {
        const result = findPosition(child);
        if (result) return result;
      }
      
      // Block elements contribute a newline
      if (['P', 'DIV'].includes(el.tagName)) {
        if (remaining <= 0) return null;
        remaining -= 1; // The implicit \n
      }
    }
    
    return null;
  };
  
  const pos = findPosition(el);
  
  if (pos) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(pos.node, pos.offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    // Offset is past end — place cursor at end
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
};

/**
 * Replace a plaintext range [start, end) with new text.
 * Converts to full plaintext, does the splice, then re-renders.
 * Cursor is placed at start + replacement.length.
 */
const replaceRange = (start: number, end: number, replacement: string) => {
  const text = getText();
  const before = text.slice(0, start);
  const after = text.slice(end);
  const newText = before + replacement + after;
  
  isUpdating = true;
  cleanupAllVideoSyncs();
  internalHtml.value = textToHtml(newText);
  if (editorRef.value) {
    editorRef.value.innerHTML = internalHtml.value;
  }
  isUpdating = false;
  
  emit('update:modelValue', newText);
  
  // Place cursor after the replacement
  nextTick(() => {
    setCursorOffset(start + replacement.length);
    syncVideoSpans();
  });
};

/**
 * Insert text at current cursor position.
 */
const insertTextAtCursor = (text: string) => {
  const offset = getCursorOffset();
  replaceRange(offset, offset, text);
};

/**
 * Insert emoji at cursor position
 */
const insertEmoji = (entry: EmojiEntry) => {
  if (!editorRef.value || props.disabled) return;
  
  editorRef.value.focus();
  
  const emoji = codepointsToString(entry.codepoints);
  const html = emojiToHtml(emoji, entry);
  
  // Insert at cursor
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  range.deleteContents();
  
  // Create fragment from HTML
  const fragment = document.createRange().createContextualFragment(html);
  range.insertNode(fragment);
  
  // Move cursor after inserted content
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Trigger update and sync videos
  handleInput();
  nextTick(() => syncVideoSpans());
};

/**
 * Handle input changes
 */
const handleInput = () => {
  if (!editorRef.value || isUpdating) return;
  
  const html = editorRef.value.innerHTML;
  const text = htmlToText(html);
  
  // Check max length
  if (props.maxLength && [...text].length > props.maxLength) {
    // Truncate and restore
    const truncated = [...text].slice(0, props.maxLength).join('');
    isUpdating = true;
    internalHtml.value = textToHtml(truncated);
    editorRef.value.innerHTML = internalHtml.value;
    isUpdating = false;
    emit('update:modelValue', truncated);
    nextTick(() => syncVideoSpans());
    return;
  }
  
  internalHtml.value = html;
  emit('update:modelValue', text);
  
  // Notify parent
  emit('input');
  
  // Sync video spans after DOM updates
  nextTick(() => syncVideoSpans());
};

/**
 * Handle keydown — emit to parent, only intercept submit shortcuts
 */
const handleKeydown = (event: KeyboardEvent) => {
  // Always emit to parent so it can handle mentions, slash commands, etc.
  emit('keydown', event);
  
  // If parent called preventDefault, respect it
  if (event.defaultPrevented) return;
  
  // Enter to submit in single-line mode
  if (event.key === 'Enter' && props.singleLine) {
    event.preventDefault();
    const text = getText();
    emit('submit', text);
    return;
  }
  
  // Ctrl/Cmd + Enter to submit
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const text = getText();
    emit('submit', text);
    return;
  }
};

/**
 * Handle paste - emit to parent first, then do default emoji conversion if not prevented
 */
const handlePaste = (event: ClipboardEvent) => {
  // Emit to parent (for file paste interception)
  emit('paste', event);
  
  // If parent already prevented default, don't do anything
  if (event.defaultPrevented) return;
  
  event.preventDefault();
  
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (!text) return;
  
  // Convert to rich HTML
  const html = textToHtml(text);
  
  // Insert at cursor
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  range.deleteContents();
  
  const fragment = document.createRange().createContextualFragment(html);
  range.insertNode(fragment);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  
  handleInput();
};

/**
 * Handle copy - ensure fallback emoji are used in clipboard
 */
const handleCopy = (event: ClipboardEvent) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  
  // Create temp container
  const temp = document.createElement('div');
  temp.appendChild(fragment);
  
  // Convert to plaintext with fallback emojis
  const plaintext = htmlToTextFromNode(temp);
  
  // Set clipboard data
  event.preventDefault();
  event.clipboardData?.setData('text/plain', plaintext);
  event.clipboardData?.setData('text/html', temp.innerHTML);
};

/**
 * Handle cut - copy with fallback emoji, then delete
 */
const handleCut = (event: ClipboardEvent) => {
  // First, copy to clipboard
  handleCopy(event);
  
  // Then delete selected content
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  range.deleteContents();
  
  // Trigger update
  handleInput();
};

/**
 * Focus the editor
 */
const focus = () => {
  editorRef.value?.focus();
};

/**
 * Blur the editor
 */
const blur = () => {
  editorRef.value?.blur();
};

/**
 * Clear the editor
 */
const clear = () => {
  if (editorRef.value) {
    editorRef.value.innerHTML = '';
    internalHtml.value = '';
    cleanupAllVideoSyncs();
    emit('update:modelValue', '');
  }
};

// Watch external value changes
watch(() => props.modelValue, (newVal) => {
  if (isUpdating) return;
  
  const currentText = getText();
  if (currentText === newVal) return;
  
  isUpdating = true;
  cleanupAllVideoSyncs();
  internalHtml.value = textToHtml(newVal);
  if (editorRef.value) {
    editorRef.value.innerHTML = internalHtml.value;
  }
  isUpdating = false;
  nextTick(() => syncVideoSpans());
});

// Setup MutationObserver to track video span changes
const setupMutationObserver = () => {
  if (!editorRef.value || mutationObserver) return;
  
  mutationObserver = new MutationObserver(() => {
    // Debounce sync
    nextTick(() => syncVideoSpans());
  });
  
  mutationObserver.observe(editorRef.value, {
    childList: true,
    subtree: true,
  });
};

// Initial setup
onMounted(() => {
  if (props.modelValue) {
    internalHtml.value = textToHtml(props.modelValue);
    if (editorRef.value) {
      editorRef.value.innerHTML = internalHtml.value;
    }
  }
  
  setupMutationObserver();
  nextTick(() => syncVideoSpans());
  
  if (props.autofocus) {
    nextTick(() => focus());
  }
});

// Cleanup
onUnmounted(() => {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  cleanupAllVideoSyncs();
});

// Expose methods
defineExpose({
  insertEmoji,
  insertTextAtCursor,
  replaceRange,
  getCursorOffset,
  setCursorOffset,
  getTextBeforeCursor,
  focus,
  blur,
  clear,
  getText,
  el: editorRef,
});

// Computed placeholder visibility
const showPlaceholder = computed(() => {
  return !internalHtml.value || internalHtml.value === '<br>';
});
</script>

<template>
  <div 
    :class="[
      unstyled ? 'emojix-input-container--unstyled' : 'emojix-input-wrapper',
      !unstyled && isFocused && 'emojix-input--focused',
      !unstyled && disabled && 'emojix-input--disabled',
      !unstyled && singleLine && 'emojix-input--single-line',
    ]"
  >
    <div
      ref="editorRef"
      :class="unstyled ? 'emojix-input--unstyled' : 'emojix-input'"
      :contenteditable="!disabled"
      role="textbox"
      :aria-placeholder="placeholder"
      :aria-disabled="disabled"
      @input="handleInput"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @copy="handleCopy"
      @cut="handleCut"
      @focus="isFocused = true; emit('focus')"
      @blur="isFocused = false; emit('blur')"
    />
    
    <div 
      v-if="showPlaceholder && placeholder" 
      :class="unstyled ? 'emojix-input-placeholder--unstyled' : 'emojix-input-placeholder'"
      @click="focus"
    >
      {{ placeholder }}
    </div>
  </div>
</template>

<style scoped>
.emojix-input-wrapper {
  position: relative;
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--emojix-border, #e0e0e0);
  border-radius: var(--emojix-input-radius, 8px);
  background: var(--emojix-input-bg, #fff);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.emojix-input-wrapper:hover:not(.emojix-input--disabled) {
  border-color: var(--emojix-border-hover, #bbb);
}

.emojix-input--focused {
  border-color: var(--emojix-primary, #3b82f6);
  box-shadow: 0 0 0 2px var(--emojix-primary-alpha, rgba(59, 130, 246, 0.2));
}

.emojix-input--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.emojix-input--disabled .emojix-input {
  pointer-events: none;
}

.emojix-input {
  width: 100%;
  min-height: 38px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--emojix-text, #333);
  outline: none;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.emojix-input--single-line .emojix-input {
  max-height: 38px;
  overflow-y: hidden;
  white-space: nowrap;
  overflow-x: auto;
}

.emojix-input-placeholder {
  position: absolute;
  top: 8px;
  left: 12px;
  color: var(--emojix-placeholder, #999);
  font-size: 14px;
  pointer-events: none;
  user-select: none;
}

/* Unstyled mode — minimal container, inherits from parent */
.emojix-input-container--unstyled {
  position: relative;
  width: 100%;
}

.emojix-input--unstyled {
  width: 100%;
  outline: none;
  word-wrap: break-word;
  white-space: pre-wrap;
  color: inherit;
  font: inherit;
  background: transparent;
  padding: 0;
  min-height: 0;
  max-height: none;
}

.emojix-input-placeholder--unstyled {
  padding-top: 5px;
  position: absolute;
  top: 0;
  left: 0;
  color: inherit;
  opacity: 0.5;
  font: inherit;
  pointer-events: none;
  user-select: none;
}

/* Inline emoji styles */
:deep(.emojix-inline-emoji) {
  display: inline-block;
  vertical-align: middle;
  margin: 0 1px;
  user-select: text;
}

:deep(.emojix-inline-emoji img),
:deep(.emojix-inline-emoji video) {
  vertical-align: middle;
  pointer-events: none;
}

:deep(.emojix-inline-video) {
  overflow: hidden;
}

:deep(.emojix-inline-video canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

:deep(.emojix-inline-sprite) {
  background-repeat: no-repeat;
}
</style>
