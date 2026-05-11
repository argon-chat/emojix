/**
 * useEmojiRenderer - Composable for rendering emoji in custom inputs
 * 
 * Provides utilities for integrating emoji rendering into any text input,
 * including video sync, fallback emoji, and clipboard handling.
 * 
 * @example
 * ```ts
 * const renderer = useEmojiRenderer({
 *   emojiSize: 20,
 *   renderMode: 'atlas',
 * });
 * 
 * // Convert emoji to HTML for contenteditable
 * const html = renderer.emojiToHtml('😀');
 * 
 * // Setup video sync for animated emoji
 * renderer.setupVideoSync(containerElement);
 * 
 * // Convert HTML back to plaintext
 * const text = renderer.htmlToPlaintext(html);
 * ```
 */

import { ref, onUnmounted } from 'vue';
import type { EmojiEntry, RenderMode } from '../../core';
import { 
  spriteResolver, 
  customEmojiStore, 
  codepointsToString,
  stringToCodepoints,
  codepointsToHexcode,
  splitTextAndEmoji,
  videoSyncManager,
  emojiRegistry,
} from '../../core';

/**
 * Get emoji entry by emoji character
 */
function getEntryByEmoji(emoji: string): EmojiEntry | undefined {
  const codepoints = stringToCodepoints(emoji);
  if (!codepoints.length) return undefined;
  const hexcode = codepointsToHexcode(codepoints);
  return emojiRegistry.getByHexcode(hexcode);
}

export interface UseEmojiRendererOptions {
  /** Emoji size in pixels (default: 20) */
  emojiSize?: number;
  /** Render mode for standard emoji */
  renderMode?: RenderMode;
  /** Twemoji CDN base URL */
  twemojiBaseUrl?: string;
}

export interface VideoSyncHandle {
  id: string;
  url: string;
  canvas: HTMLCanvasElement;
}

export interface EmojiRendererResult {
  /** Convert single emoji or EmojiEntry to inline HTML */
  emojiToHtml: (emoji: string | EmojiEntry, options?: { size?: number }) => string;
  
  /** Convert plaintext to rich HTML with emoji rendering */
  textToHtml: (text: string) => string;
  
  /** Convert rich HTML back to plaintext (extracts data-emoji values) */
  htmlToPlaintext: (html: string) => string;
  
  /** Register a video element for synchronized playback */
  registerVideoSync: (url: string, size: number) => VideoSyncHandle;
  
  /** Unregister a video sync */
  unregisterVideoSync: (handle: VideoSyncHandle) => void;
  
  /** Scan container for video spans and setup sync */
  setupVideoSyncForContainer: (container: HTMLElement) => void;
  
  /** Cleanup all video syncs */
  cleanupVideoSyncs: () => void;
  
  /** Get emoji entry by unicode string */
  getEmojiEntry: (emoji: string) => EmojiEntry | undefined;
  
  /** Parse text into segments of text and emoji */
  parseText: typeof splitTextAndEmoji;
  
  /** Get unicode string from EmojiEntry */
  entryToString: typeof codepointsToString;
}

/**
 * Composable for rendering emoji in custom inputs
 */
export function useEmojiRenderer(
  options: UseEmojiRendererOptions = {}
): EmojiRendererResult {
  const {
    emojiSize = 20,
    renderMode = 'atlas',
    twemojiBaseUrl = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72',
  } = options;

  // Track video syncs for cleanup
  const videoSyncs = ref<VideoSyncHandle[]>([]);
  let videoIdCounter = 0;

  /**
   * Generate unique ID for video elements
   */
  const generateVideoId = () => `renderer-video-${++videoIdCounter}`;

  /**
   * Convert emoji to inline HTML
   */
  const emojiToHtml = (emoji: string | EmojiEntry, opts?: { size?: number }): string => {
    const size = opts?.size ?? emojiSize;
    
    // If it's an EmojiEntry
    const entry = typeof emoji === 'string' 
      ? getEntryByEmoji(emoji) 
      : emoji;
    
    const emojiString = typeof emoji === 'string' 
      ? emoji 
      : codepointsToString(emoji.codepoints);

    // Custom emoji
    if (entry?.isCustom) {
      const customId = entry.id.replace(/^custom:/, '');
      const customData = customEmojiStore.get(customId)?.input;

      if (customData?.url) {
        const copyEmoji = customData.fallbackEmoji || emojiString;
        const isVideo = customData.url.toLowerCase().match(/\.(webm|mp4|gif)$/);

        if (isVideo) {
          const spanId = generateVideoId();
          return `<span class="emojix-inline-emoji emojix-inline-video" data-emoji="${copyEmoji}" data-video-url="${customData.url}" data-video-id="${spanId}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;" contenteditable="false" title="${customData.name || customData.shortcode}"></span>`;
        }

        return `<img class="emojix-inline-emoji" src="${customData.url}" alt="${copyEmoji}" data-emoji="${copyEmoji}" width="${size}" height="${size}" draggable="false" title="${customData.name || customData.shortcode}" />`;
      }
    }

    // Standard emoji with atlas
    if (renderMode === 'atlas' && entry) {
      const style = spriteResolver.getStyle(entry, size);
      if (style) {
        const cssText = Object.entries(style)
          .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
          .join(';');
        return `<span class="emojix-inline-emoji emojix-inline-sprite" style="${cssText}" data-emoji="${emojiString}" contenteditable="false" title="${entry?.name || ''}"></span>`;
      }
    }

    // Fallback - Twemoji CDN
    const codepoints = [...emojiString]
      .map(c => c.codePointAt(0)!.toString(16))
      .filter(cp => cp !== 'fe0f')
      .join('-');

    return `<img class="emojix-inline-emoji" src="${twemojiBaseUrl}/${codepoints}.png" alt="${emojiString}" data-emoji="${emojiString}" width="${size}" height="${size}" draggable="false" />`;
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
   * Convert HTML back to plaintext
   */
  const htmlToPlaintext = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    let text = '';

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;

        if (el.tagName === 'BR') {
          text += '\n';
          return;
        }

        const emoji = el.getAttribute('data-emoji');
        if (emoji) {
          text += emoji;
          return;
        }

        for (const child of el.childNodes) {
          walk(child);
        }

        if (['P', 'DIV'].includes(el.tagName) && text && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    };

    walk(temp);
    return text.replace(/\n+$/, '');
  };

  /**
   * Register video for sync
   */
  const registerVideoSync = (url: string, size: number): VideoSyncHandle => {
    const { id, canvas } = videoSyncManager.register(url, size, size);
    const handle: VideoSyncHandle = { id, url, canvas };
    videoSyncs.value.push(handle);
    return handle;
  };

  /**
   * Unregister video sync
   */
  const unregisterVideoSync = (handle: VideoSyncHandle): void => {
    videoSyncManager.unregister(handle.url, handle.id);
    const idx = videoSyncs.value.findIndex(h => h.id === handle.id);
    if (idx !== -1) {
      videoSyncs.value.splice(idx, 1);
    }
  };

  /**
   * Setup video sync for all video spans in container
   */
  const setupVideoSyncForContainer = (container: HTMLElement): void => {
    const videoSpans = container.querySelectorAll<HTMLSpanElement>('[data-video-url]');

    for (const span of videoSpans) {
      const url = span.getAttribute('data-video-url');

      if (!url) continue;

      // Already has canvas?
      if (span.querySelector('canvas')) continue;

      const handle = registerVideoSync(url, emojiSize);
      span.setAttribute('data-video-id', handle.id);
      span.innerHTML = '';
      span.appendChild(handle.canvas);
    }
  };

  /**
   * Cleanup all video syncs
   */
  const cleanupVideoSyncs = (): void => {
    for (const handle of videoSyncs.value) {
      videoSyncManager.unregister(handle.url, handle.id);
    }
    videoSyncs.value = [];
  };

  /**
   * Get emoji entry from unicode string
   */
  const getEmojiEntry = (emoji: string): EmojiEntry | undefined => {
    return getEntryByEmoji(emoji);
  };

  // Cleanup on unmount
  onUnmounted(() => {
    cleanupVideoSyncs();
  });

  return {
    emojiToHtml,
    textToHtml,
    htmlToPlaintext,
    registerVideoSync,
    unregisterVideoSync,
    setupVideoSyncForContainer,
    cleanupVideoSyncs,
    getEmojiEntry,
    parseText: splitTextAndEmoji,
    entryToString: codepointsToString,
  };
}

/**
 * Standalone function (non-reactive) for emoji to HTML conversion
 */
export function renderEmojiToHtml(
  emoji: string,
  options: {
    size?: number;
    renderMode?: RenderMode;
    twemojiBaseUrl?: string;
  } = {}
): string {
  const {
    size = 20,
    renderMode = 'atlas',
    twemojiBaseUrl = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72',
  } = options;

  const entry = getEntryByEmoji(emoji);

  if (renderMode === 'atlas' && entry) {
    const style = spriteResolver.getStyle(entry, size);
    if (style) {
      const cssText = Object.entries(style)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
        .join(';');
      return `<span class="emojix-inline-emoji emojix-inline-sprite" style="${cssText}" data-emoji="${emoji}" contenteditable="false"></span>`;
    }
  }

  const codepoints = [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(cp => cp !== 'fe0f')
    .join('-');

  return `<img class="emojix-inline-emoji" src="${twemojiBaseUrl}/${codepoints}.png" alt="${emoji}" data-emoji="${emoji}" width="${size}" height="${size}" draggable="false" />`;
}
