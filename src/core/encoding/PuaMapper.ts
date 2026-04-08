/**
 * PuaMapper - Maps custom emoji IDs to Private Use Area codepoints
 * 
 * Uses Unicode Private Use Areas:
 * - BMP PUA: U+E000–U+F8FF (6,400 codepoints)
 * - Plane 15 PUA: U+F0000–U+FFFFD (65,534 codepoints)
 * - Plane 16 PUA: U+100000–U+10FFFD (65,534 codepoints)
 */

/** BMP Private Use Area range */
const BMP_PUA_START = 0xE000;
const BMP_PUA_END = 0xF8FF;

/** Supplementary Private Use Area-A range */
const SPUA_A_START = 0xF0000;
const SPUA_A_END = 0xFFFFD;

/** Supplementary Private Use Area-B range */
const SPUA_B_START = 0x100000;
const SPUA_B_END = 0x10FFFD;

/**
 * Singleton mapper for custom emoji codepoints
 */
export class PuaMapper {
  /** Custom ID -> PUA codepoint */
  private idToCodepoint = new Map<string, number>();
  
  /** PUA codepoint -> Custom ID (reverse lookup) */
  private codepointToId = new Map<number, string>();
  
  /** Next available codepoint */
  private nextCodepoint = BMP_PUA_START;
  
  /**
   * Register a custom emoji and get its PUA codepoint
   * Returns existing codepoint if already registered
   */
  register(customId: string): number {
    const existing = this.idToCodepoint.get(customId);
    if (existing !== undefined) {
      return existing;
    }
    
    const codepoint = this.allocateCodepoint();
    this.idToCodepoint.set(customId, codepoint);
    this.codepointToId.set(codepoint, customId);
    
    return codepoint;
  }
  
  /**
   * Get PUA codepoint for a custom emoji ID
   * Returns undefined if not registered
   */
  getCodepoint(customId: string): number | undefined {
    return this.idToCodepoint.get(customId);
  }
  
  /**
   * Get custom emoji ID from PUA codepoint
   * Returns undefined if not a registered custom emoji
   */
  getCustomId(codepoint: number): string | undefined {
    return this.codepointToId.get(codepoint);
  }
  
  /**
   * Check if a codepoint is a registered custom emoji
   */
  isCustomEmoji(codepoint: number): boolean {
    return this.codepointToId.has(codepoint);
  }
  
  /**
   * Convert custom emoji codepoint to display string
   */
  toText(codepoint: number): string {
    return String.fromCodePoint(codepoint);
  }
  
  /**
   * Unregister a custom emoji
   */
  unregister(customId: string): boolean {
    const codepoint = this.idToCodepoint.get(customId);
    if (codepoint === undefined) {
      return false;
    }
    
    this.idToCodepoint.delete(customId);
    this.codepointToId.delete(codepoint);
    return true;
  }
  
  /**
   * Clear all registrations
   */
  clear(): void {
    this.idToCodepoint.clear();
    this.codepointToId.clear();
    this.nextCodepoint = BMP_PUA_START;
  }
  
  /**
   * Get all registered custom emoji
   */
  getAll(): Map<string, number> {
    return new Map(this.idToCodepoint);
  }
  
  /**
   * Allocate the next available codepoint
   */
  private allocateCodepoint(): number {
    const cp = this.nextCodepoint;
    
    // Move to next codepoint, handling overflow between PUA ranges
    if (this.nextCodepoint < BMP_PUA_END) {
      this.nextCodepoint++;
    } else if (this.nextCodepoint === BMP_PUA_END) {
      this.nextCodepoint = SPUA_A_START;
    } else if (this.nextCodepoint < SPUA_A_END) {
      this.nextCodepoint++;
    } else if (this.nextCodepoint === SPUA_A_END) {
      this.nextCodepoint = SPUA_B_START;
    } else if (this.nextCodepoint < SPUA_B_END) {
      this.nextCodepoint++;
    } else {
      throw new Error('PUA exhausted: too many custom emoji registered');
    }
    
    return cp;
  }
  
  /**
   * Export state for serialization
   */
  export(): { mapping: [string, number][] } {
    return {
      mapping: Array.from(this.idToCodepoint.entries()),
    };
  }
  
  /**
   * Import state from serialized data
   */
  import(data: { mapping: [string, number][] }): void {
    this.clear();
    
    let maxCodepoint = BMP_PUA_START;
    
    for (const [id, codepoint] of data.mapping) {
      this.idToCodepoint.set(id, codepoint);
      this.codepointToId.set(codepoint, id);
      
      if (codepoint >= maxCodepoint) {
        maxCodepoint = codepoint + 1;
      }
    }
    
    this.nextCodepoint = maxCodepoint;
  }
}

/**
 * Global singleton instance
 */
export const puaMapper = new PuaMapper();
