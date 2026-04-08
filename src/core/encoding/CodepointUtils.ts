/**
 * Utility functions for working with Unicode codepoints
 */

/**
 * Zero Width Joiner - used in emoji sequences
 */
export const ZWJ = 0x200D;

/**
 * Variation Selector 16 - forces emoji presentation
 */
export const VS16 = 0xFE0F;

/**
 * Variation Selector 15 - forces text presentation
 */
export const VS15 = 0xFE0E;

/**
 * Convert codepoints array to string
 */
export function codepointsToString(codepoints: number[]): string {
  return String.fromCodePoint(...codepoints);
}

/**
 * Convert string to codepoints array
 */
export function stringToCodepoints(str: string): number[] {
  const codepoints: number[] = [];
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) {
      codepoints.push(cp);
    }
  }
  return codepoints;
}

/**
 * Convert codepoints to hexcode string (e.g., "1f600" or "1f469-200d-1f4bb")
 */
export function codepointsToHexcode(codepoints: number[]): string {
  return codepoints
    .filter(cp => cp !== VS16) // Exclude VS16 from hexcode
    .map(cp => cp.toString(16).toLowerCase())
    .join('-');
}

/**
 * Parse hexcode string to codepoints array
 */
export function hexcodeToCodepoints(hexcode: string): number[] {
  return hexcode.split('-').map(hex => parseInt(hex, 16));
}

/**
 * Check if a codepoint is in the Basic Multilingual Plane (BMP)
 */
export function isBMP(codepoint: number): boolean {
  return codepoint <= 0xFFFF;
}

/**
 * Check if codepoint is a skin tone modifier
 */
export function isSkinToneModifier(codepoint: number): boolean {
  return codepoint >= 0x1F3FB && codepoint <= 0x1F3FF;
}

/**
 * Check if codepoint is a regional indicator (for flags)
 */
export function isRegionalIndicator(codepoint: number): boolean {
  return codepoint >= 0x1F1E6 && codepoint <= 0x1F1FF;
}

/**
 * Check if codepoint is in Private Use Area (for custom emoji)
 */
export function isPrivateUse(codepoint: number): boolean {
  // BMP Private Use Area
  if (codepoint >= 0xE000 && codepoint <= 0xF8FF) return true;
  // Supplementary Private Use Area-A
  if (codepoint >= 0xF0000 && codepoint <= 0xFFFFD) return true;
  // Supplementary Private Use Area-B
  if (codepoint >= 0x100000 && codepoint <= 0x10FFFD) return true;
  return false;
}

/**
 * Remove variation selectors from codepoints
 */
export function stripVariationSelectors(codepoints: number[]): number[] {
  return codepoints.filter(cp => cp !== VS15 && cp !== VS16);
}

/**
 * Get base emoji codepoints (without skin tone modifiers)
 */
export function getBaseEmoji(codepoints: number[]): number[] {
  return codepoints.filter(cp => !isSkinToneModifier(cp));
}

/**
 * Apply skin tone modifier to emoji codepoints
 * Only works for emoji that support skin tones
 */
export function applySkinTone(codepoints: number[], skinTone: number): number[] {
  // For simple emoji, add modifier after base
  // For ZWJ sequences, this is more complex - simplified version:
  const result: number[] = [];
  let appliedTone = false;
  
  for (let i = 0; i < codepoints.length; i++) {
    const cp = codepoints[i]!;
    result.push(cp);
    
    // Apply skin tone after human-related emoji codepoints
    if (!appliedTone && isHumanEmoji(cp) && !isSkinToneModifier(codepoints[i + 1] ?? 0)) {
      result.push(skinTone);
      appliedTone = true;
    }
  }
  
  return result;
}

/**
 * Check if codepoint represents a human-related emoji that can have skin tones
 */
function isHumanEmoji(codepoint: number): boolean {
  // Common ranges for human emoji
  // This is a simplified check - full implementation would need emoji data
  return (
    (codepoint >= 0x1F466 && codepoint <= 0x1F487) || // Faces and people
    (codepoint >= 0x1F4AA && codepoint <= 0x1F4AA) || // Flexed biceps
    (codepoint >= 0x1F590 && codepoint <= 0x1F5FF) || // Hand gestures
    (codepoint >= 0x1F645 && codepoint <= 0x1F64F) || // Gestures
    (codepoint >= 0x1F6B4 && codepoint <= 0x1F6C0) || // Activities
    (codepoint >= 0x1F9B5 && codepoint <= 0x1F9B6) || // Body parts
    (codepoint >= 0x1F9D1 && codepoint <= 0x1F9DD) || // People
    codepoint === 0x261D ||  // Index pointing up
    codepoint === 0x270A ||  // Raised fist
    codepoint === 0x270B ||  // Raised hand
    codepoint === 0x270C ||  // Victory hand
    codepoint === 0x270D     // Writing hand
  );
}
