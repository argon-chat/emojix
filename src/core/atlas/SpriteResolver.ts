/**
 * SpriteResolver - Resolves emoji to their sprite positions in atlases
 */

import type { EmojiEntry, AtlasRef, AtlasManifest, SpritePosition } from '../types';
import { atlasLoader, customAtlasLoader } from './AtlasLoader';

/**
 * CSS background-position style for a sprite
 */
export interface SpriteStyle {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  width: string;
  height: string;
  [key: string]: string; // Allow indexing for Vue style binding
}

/**
 * Resolve sprite information for emoji rendering
 */
export class SpriteResolver {
  /**
   * Get CSS styles for rendering an emoji sprite
   */
  getStyle(emoji: EmojiEntry, size = 32): SpriteStyle | null {
    const atlas = atlasLoader.get(emoji.atlasRef.atlasId);
    if (!atlas) return null;
    
    return this.computeStyle(
      atlas.url,
      emoji.atlasRef,
      atlas.manifest,
      size
    );
  }
  
  /**
   * Get CSS styles for a custom emoji (single image)
   */
  getCustomSingleStyle(imageUrl: string, size = 32): SpriteStyle {
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundPosition: '0 0',
      backgroundSize: 'contain',
      width: `${size}px`,
      height: `${size}px`,
    };
  }
  
  /**
   * Get CSS styles for a custom emoji from atlas
   */
  getCustomAtlasStyle(
    atlasUrl: string,
    position: { x: number; y: number; size: number },
    displaySize = 32
  ): SpriteStyle | null {
    const image = customAtlasLoader.get(atlasUrl);
    if (!image) return null;
    
    const scale = displaySize / position.size;
    
    return {
      backgroundImage: `url(${atlasUrl})`,
      backgroundPosition: `-${position.x * scale}px -${position.y * scale}px`,
      backgroundSize: `${image.width * scale}px ${image.height * scale}px`,
      width: `${displaySize}px`,
      height: `${displaySize}px`,
    };
  }
  
  /**
   * Compute sprite position from atlas manifest
   */
  getSpritePosition(manifest: AtlasManifest, hexcode: string): SpritePosition | null {
    return manifest.sprites[hexcode] ?? null;
  }
  
  /**
   * Get AtlasRef for an emoji hexcode
   */
  getAtlasRef(manifest: AtlasManifest, hexcode: string): AtlasRef | null {
    const pos = this.getSpritePosition(manifest, hexcode);
    if (!pos) return null;
    
    return {
      atlasId: manifest.id,
      x: pos.col * manifest.spriteSize,
      y: pos.row * manifest.spriteSize,
      size: manifest.spriteSize,
    };
  }
  
  /**
   * Compute CSS style from atlas and position
   */
  private computeStyle(
    atlasUrl: string,
    atlasRef: AtlasRef,
    manifest: AtlasManifest,
    displaySize: number
  ): SpriteStyle {
    const scale = displaySize / atlasRef.size;
    const atlasWidth = manifest.dimensions.width * scale;
    const atlasHeight = manifest.dimensions.height * scale;
    
    return {
      backgroundImage: `url(${atlasUrl})`,
      backgroundPosition: `-${atlasRef.x * scale}px -${atlasRef.y * scale}px`,
      backgroundSize: `${atlasWidth}px ${atlasHeight}px`,
      width: `${displaySize}px`,
      height: `${displaySize}px`,
    };
  }
}

/**
 * Global singleton
 */
export const spriteResolver = new SpriteResolver();
