/**
 * Emojix Vue Plugin
 * Provides global configuration and components
 */

import type { App } from 'vue';
import type { AtlasManifest } from '@/core';
import { atlasLoader, emojiRegistry } from '@/core';
import type { EmojiEntry } from '@/core';

// Components
import { 
  EmojixPicker, 
  EmojiSprite, 
  EmojiGrid, 
  CategoryTabs, 
  SearchBar 
} from './components';

export interface EmojixPluginOptions {
  /** Register components globally */
  registerComponents?: boolean;
  /** Component prefix (default: '') */
  componentPrefix?: string;
  /** Atlas manifests to preload */
  atlases?: { manifest: AtlasManifest; imageUrl: string }[];
  /** Initial emoji data to register */
  emojiData?: EmojiEntry[];
}

/**
 * Create the Emojix plugin
 */
export function createEmojix(options: EmojixPluginOptions = {}): { install: (app: App) => Promise<void> } {
  const {
    registerComponents = true,
    componentPrefix = '',
    atlases = [],
    emojiData = [],
  } = options;
  
  return {
    async install(app: App) {
      // Register atlases
      for (const { manifest, imageUrl } of atlases) {
        await atlasLoader.register(manifest, imageUrl);
      }
      
      // Register emoji data
      if (emojiData.length > 0) {
        emojiRegistry.registerBulk(emojiData);
      }
      
      // Register components globally
      if (registerComponents) {
        const prefix = componentPrefix;
        app.component(`${prefix}EmojixPicker`, EmojixPicker);
        app.component(`${prefix}EmojiSprite`, EmojiSprite);
        app.component(`${prefix}EmojiGrid`, EmojiGrid);
        app.component(`${prefix}CategoryTabs`, CategoryTabs);
        app.component(`${prefix}SearchBar`, SearchBar);
      }
      
      // Provide global instance (optional usage)
      app.provide('emojix', {
        registry: emojiRegistry,
        atlasLoader,
      });
    },
  };
}

// Default export for simple usage
export default createEmojix;
