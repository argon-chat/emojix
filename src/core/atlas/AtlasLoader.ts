/**
 * AtlasLoader - Manages loading and caching of sprite atlases
 * Atlases are bundled with the package, so loading is synchronous/instant
 */

import type { AtlasManifest, LoadedAtlas, AtlasLoadState } from '../types';

/**
 * Atlas loading and caching manager
 */
export class AtlasLoader {
  /** Loaded atlases by ID */
  private cache = new Map<string, LoadedAtlas>();
  
  /** Loading state for reactive UI */
  private states = new Map<string, AtlasLoadState>();
  
  /** State change listeners */
  private listeners = new Set<(atlasId: string, state: AtlasLoadState) => void>();
  
  /**
   * Register a bundled atlas (called during initialization)
   * @param manifest Atlas manifest data
   * @param imageUrl URL to the atlas image (imported asset)
   */
  async register(manifest: AtlasManifest, imageUrl: string): Promise<void> {
    const atlasId = manifest.id;
    
    // Already loaded
    if (this.cache.has(atlasId)) return;
    
    this.setState(atlasId, { status: 'loading' });
    
    try {
      const image = await this.loadImage(imageUrl);
      
      const loadedAtlas: LoadedAtlas = {
        manifest,
        image,
        url: imageUrl,
      };
      
      this.cache.set(atlasId, loadedAtlas);
      this.setState(atlasId, { status: 'loaded', atlas: loadedAtlas });
    } catch (error) {
      this.setState(atlasId, { 
        status: 'error', 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    }
  }
  
  /**
   * Get a loaded atlas by ID
   */
  get(atlasId: string): LoadedAtlas | undefined {
    return this.cache.get(atlasId);
  }
  
  /**
   * Get loading state for an atlas
   */
  getState(atlasId: string): AtlasLoadState {
    return this.states.get(atlasId) ?? { status: 'idle' };
  }
  
  /**
   * Check if an atlas is loaded
   */
  isLoaded(atlasId: string): boolean {
    return this.cache.has(atlasId);
  }
  
  /**
   * Get all loaded atlases
   */
  getAll(): LoadedAtlas[] {
    return Array.from(this.cache.values());
  }
  
  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (atlasId: string, state: AtlasLoadState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  /**
   * Preload all registered atlases (force decode)
   */
  async preloadAll(): Promise<void> {
    const promises = Array.from(this.cache.values()).map(atlas => {
      // Force decode for instant rendering later
      if ('decode' in atlas.image) {
        return atlas.image.decode?.();
      }
      return Promise.resolve();
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.states.clear();
  }
  
  /**
   * Load an image from URL
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load atlas image: ${url}`));
      img.src = url;
    });
  }
  
  /**
   * Update state and notify listeners
   */
  private setState(atlasId: string, state: AtlasLoadState): void {
    this.states.set(atlasId, state);
    for (const listener of this.listeners) {
      listener(atlasId, state);
    }
  }
}

/**
 * Custom atlas loader for user-provided emoji
 * Separate from bundled atlases
 */
export class CustomAtlasLoader {
  private cache = new Map<string, { image: HTMLImageElement; url: string }>();
  private loading = new Map<string, Promise<HTMLImageElement>>();
  
  /**
   * Load a custom atlas from URL
   */
  async load(url: string): Promise<HTMLImageElement> {
    // Check cache
    const cached = this.cache.get(url);
    if (cached) return cached.image;
    
    // Check if already loading
    const existing = this.loading.get(url);
    if (existing) return existing;
    
    // Start loading
    const promise = this.loadImage(url);
    this.loading.set(url, promise);
    
    try {
      const image = await promise;
      this.cache.set(url, { image, url });
      return image;
    } finally {
      this.loading.delete(url);
    }
  }
  
  /**
   * Get cached image
   */
  get(url: string): HTMLImageElement | undefined {
    return this.cache.get(url)?.image;
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }
  
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load custom atlas: ${url}`));
      img.src = url;
    });
  }
}

/**
 * Global instances
 */
export const atlasLoader = new AtlasLoader();
export const customAtlasLoader = new CustomAtlasLoader();
