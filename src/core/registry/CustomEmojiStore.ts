/**
 * CustomEmojiStore - Runtime management of custom emoji
 */

import type { CustomEmojiInput, EmojiEntry, AtlasRef, CustomPack } from '../types';
import { puaMapper } from '../encoding';
import { emojiRegistry } from '../registry';
import { customAtlasLoader } from '../atlas';
import { codepointsToHexcode } from '../encoding';
import { 
  CustomEmojiQueue, 
  type LoaderFunction, 
  type LoadedEmoji, 
  type CustomEmojiQueueOptions 
} from './CustomEmojiQueue';

/** Callback for when emoji are loaded */
export type EmojiLoadedCallback = (emojis: LoadedEmoji[]) => void;

/** Callback for store changes */
export type StoreChangeCallback = () => void;

/**
 * Custom emoji store for runtime registration
 */
export class CustomEmojiStore {
  /** Custom emoji by ID */
  private customs = new Map<string, { entry: EmojiEntry; input: CustomEmojiInput }>();
  
  /** Custom packs by ID */
  private packs = new Map<string, CustomPack>();
  
  /** Loading queue for batched emoji loading */
  private loadingQueue: CustomEmojiQueue | null = null;
  
  /** Global load callbacks */
  private loadCallbacks = new Set<EmojiLoadedCallback>();
  
  /** Store change callbacks (for reactivity) */
  private changeCallbacks = new Set<StoreChangeCallback>();
  
  /** Version counter for reactivity */
  private _version = 0;
  
  /** Get current version (for reactivity tracking) */
  get version(): number {
    return this._version;
  }
  
  /**
   * Subscribe to store changes (packs/emoji added/removed)
   */
  onChange(callback: StoreChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }
  
  /**
   * Notify all change listeners
   */
  private notifyChange(): void {
    this._version++;
    for (const cb of this.changeCallbacks) {
      try {
        cb();
      } catch (e) {
        console.error('[CustomEmojiStore] Change callback error:', e);
      }
    }
  }
  
  /**
   * Initialize the loading queue for batched emoji loading
   * Call this once with your API loader function
   */
  initLoadingQueue(loader: LoaderFunction, options?: CustomEmojiQueueOptions): void {
    this.loadingQueue = new CustomEmojiQueue(loader, options);
  }
  
  /**
   * Get the loading queue instance
   */
  getLoadingQueue(): CustomEmojiQueue | null {
    return this.loadingQueue;
  }
  
  /**
   * Ensure emoji is loaded (uses batched queue if available)
   * Returns cached emoji immediately if already loaded
   */
  ensureLoaded(documentId: string, callback?: EmojiLoadedCallback): LoadedEmoji | null {
    if (!this.loadingQueue) {
      console.warn('[CustomEmojiStore] Loading queue not initialized');
      return null;
    }
    
    return this.loadingQueue.request(documentId, (loaded) => {
      // Notify global callbacks
      for (const cb of this.loadCallbacks) {
        try {
          cb(loaded);
        } catch (e) {
          console.error('[CustomEmojiStore] Load callback error:', e);
        }
      }
      // Notify specific callback
      callback?.(loaded);
    });
  }
  
  /**
   * Ensure multiple emojis are loaded
   */
  ensureLoadedMany(documentIds: string[], callback?: EmojiLoadedCallback): LoadedEmoji[] {
    if (!this.loadingQueue) {
      console.warn('[CustomEmojiStore] Loading queue not initialized');
      return [];
    }
    
    return this.loadingQueue.requestMany(documentIds, callback);
  }
  
  /**
   * Subscribe to emoji load events
   */
  onLoaded(callback: EmojiLoadedCallback): () => void {
    this.loadCallbacks.add(callback);
    return () => this.loadCallbacks.delete(callback);
  }
  
  /**
   * Preload emojis without waiting
   */
  preload(documentIds: string[]): void {
    this.loadingQueue?.preload(documentIds);
  }
  
  /**
   * Check if emoji is already loaded in queue
   */
  isQueueLoaded(documentId: string): boolean {
    return this.loadingQueue?.isLoaded(documentId) ?? false;
  }
  
  /**
   * Get loading stats
   */
  getLoadingStats() {
    return this.loadingQueue?.getStats() ?? null;
  }
  
  /**
   * Register a custom emoji pack
   */
  registerPack(pack: CustomPack): void {
    this.packs.set(pack.id, pack);
    this.notifyChange();
  }
  
  /**
   * Get all registered packs
   */
  getPacks(): CustomPack[] {
    return Array.from(this.packs.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  
  /**
   * Get pack by ID
   */
  getPack(packId: string): CustomPack | undefined {
    return this.packs.get(packId);
  }
  
  /**
   * Get emoji by pack ID
   */
  getByPack(packId: string): EmojiEntry[] {
    return Array.from(this.customs.values())
      .filter(c => c.input.packId === packId)
      .map(c => c.entry);
  }
  
  /**
   * Get emoji without pack (unassigned)
   */
  getUnassigned(): EmojiEntry[] {
    return Array.from(this.customs.values())
      .filter(c => !c.input.packId)
      .map(c => c.entry);
  }
  
  /**
   * Add a custom emoji
   */
  async add(input: CustomEmojiInput): Promise<EmojiEntry> {
    // Validate input
    if (!input.id || !input.shortcode) {
      throw new Error('Custom emoji requires id and shortcode');
    }
    
    if (!input.url && !input.atlasUrl) {
      throw new Error('Custom emoji requires url or atlasUrl');
    }
    
    if (input.atlasUrl && !input.atlasPosition) {
      throw new Error('atlasPosition required when using atlasUrl');
    }
    
    // Check if already exists
    if (this.customs.has(input.id)) {
      throw new Error(`Custom emoji with id "${input.id}" already exists`);
    }
    
    // Get PUA codepoint
    const codepoint = puaMapper.register(input.id);
    
    // Build atlas ref
    let atlasRef: AtlasRef;
    
    if (input.url) {
      // Single image - create virtual atlas ref
      atlasRef = {
        atlasId: `custom:${input.id}`,
        x: 0,
        y: 0,
        size: 64, // Default size for single images
      };
    } else if (input.atlasUrl && input.atlasPosition) {
      // Preload atlas
      await customAtlasLoader.load(input.atlasUrl);
      
      atlasRef = {
        atlasId: `custom-atlas:${input.atlasUrl}`,
        x: input.atlasPosition.x,
        y: input.atlasPosition.y,
        size: input.atlasPosition.size,
      };
    } else {
      throw new Error('Invalid custom emoji configuration');
    }
    
    // Build emoji entry
    const entry: EmojiEntry = {
      id: `custom:${input.id}`,
      codepoints: [codepoint],
      hexcode: codepointsToHexcode([codepoint]),
      shortcode: input.shortcode,
      category: 'custom',
      keywords: input.keywords ?? [],
      name: input.name ?? input.shortcode,
      atlasRef,
      isCustom: true,
    };
    
    // Register in emoji registry
    emojiRegistry.register(entry);
    
    // Store locally
    this.customs.set(input.id, { entry, input });
    
    // Notify listeners
    this.notifyChange();
    
    return entry;
  }
  
  /**
   * Remove a custom emoji
   */
  remove(customId: string): boolean {
    const custom = this.customs.get(customId);
    if (!custom) return false;
    
    // Unregister from registry
    emojiRegistry.unregister(custom.entry.id);
    
    // Unregister PUA
    puaMapper.unregister(customId);
    
    // Remove from store
    this.customs.delete(customId);
    
    // Notify listeners
    this.notifyChange();
    
    return true;
  }
  
  /**
   * Get a custom emoji by ID
   */
  get(customId: string): { entry: EmojiEntry; input: CustomEmojiInput } | undefined {
    return this.customs.get(customId);
  }
  
  /**
   * Get all custom emoji
   */
  getAll(): { entry: EmojiEntry; input: CustomEmojiInput }[] {
    return Array.from(this.customs.values());
  }
  
  /**
   * Check if custom emoji exists
   */
  has(customId: string): boolean {
    return this.customs.has(customId);
  }
  
  /**
   * Clear all custom emoji
   */
  clear(): void {
    for (const [id] of this.customs) {
      this.remove(id);
    }
    this.loadingQueue?.clear();
    this.notifyChange();
  }
  
  /**
   * Get count of custom emoji
   */
  get size(): number {
    return this.customs.size;
  }
}

/**
 * Global singleton
 */
export const customEmojiStore = new CustomEmojiStore();
