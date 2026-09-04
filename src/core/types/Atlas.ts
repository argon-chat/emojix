/**
 * Atlas image format
 */
export type AtlasFormat = 'webp' | 'avif' | 'png';

/**
 * Atlas manifest - metadata for a sprite atlas
 */
export interface AtlasManifest {
  /** Unique atlas identifier */
  id: string;
  
  /** Category this atlas covers */
  category: string;
  
  /** Resolution multiplier (1x, 2x, 3x) */
  resolution: 1 | 2 | 3;
  
  /** Image format */
  format: AtlasFormat;
  
  /** Atlas image dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  
  /** Individual sprite size (square) */
  spriteSize: number;
  
  /** Number of columns in the atlas */
  columns: number;
  
  /** Sprite positions indexed by hexcode */
  sprites: Record<string, SpritePosition>;
}

/**
 * Sprite position within an atlas
 */
export interface SpritePosition {
  /** Column index (0-based) */
  col: number;
  /** Row index (0-based) */
  row: number;
}

/**
 * Loaded atlas with image data
 */
export interface LoadedAtlas {
  manifest: AtlasManifest;
  /**
   * Only set once preloadAll() has been asked to warm the atlas up. Sprites are CSS background
   * images, so the browser fetches and decodes an atlas the first time one of its sprites is shown
   * and may drop the decoded bitmap under memory pressure; nothing else needs the pixels.
   */
  image?: HTMLImageElement;
  /** Data URL or blob URL for the image */
  url: string;
}

/**
 * Atlas loading state
 */
export type AtlasLoadState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; atlas: LoadedAtlas }
  | { status: 'error'; error: Error };

/**
 * Custom atlas configuration for user-provided emoji
 */
export interface CustomAtlasConfig {
  /** URL to the atlas image */
  url: string;
  
  /** Sprite size in the atlas */
  spriteSize: number;
  
  /** Sprites mapping: customId -> position */
  sprites: Record<string, { x: number; y: number }>;
}
