/**
 * Emojix - High-performance Emoji Picker for Vue 3
 * 
 * @packageDocumentation
 */

// Core exports
export * from './core';

// Vue exports  
export * from './vue';

// Theme exports
export { emojixPlugin } from './themes';

// Data exports
export { initializeEmojix } from './data/loader';

// Convenience re-exports
export { 
  EmojixPicker, 
  EmojiSprite, 
  EmojiGrid,
  EmojiInput,
} from './vue/components';

export { 
  useEmojix, 
  useSearch, 
  useRecents,
  useEmojiParsing,
  useEmojiRenderer,
  useCustomEmojiLoader,
  renderEmojiToHtml,
  parseMessage,
  setupCustomEmojiLoader,
} from './vue/composables';

export { createEmojix } from './vue/plugin';
