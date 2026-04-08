/**
 * Emoji Data Generator - Generates emoji registry data from emojibase
 * 
 * Usage: bun run scripts/generate-data.ts
 * 
 * This script:
 * 1. Loads emoji data from emojibase
 * 2. Maps emoji to categories and atlas positions
 * 3. Generates compact JSON data for the registry
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { EmojiEntry, AtlasRef } from '../src/core/types/Emoji';
import type { AtlasManifest } from '../src/core/types/Atlas';
import type { CategoryId } from '../src/core/types/Category';

const ATLASES_DIR = './src/assets/atlases';
const OUTPUT_DIR = './src/data';

// Category mapping based on emojibase group IDs
const GROUP_TO_CATEGORY: Record<number, CategoryId> = {
  0: 'smileys',    // Smileys & Emotion
  1: 'people',     // People & Body
  2: 'animals',    // Component (skin tones) - skip
  3: 'animals',    // Animals & Nature
  4: 'food',       // Food & Drink
  5: 'travel',     // Travel & Places
  6: 'activities', // Activities
  7: 'objects',    // Objects
  8: 'symbols',    // Symbols
  9: 'flags',      // Flags
};

interface EmojibaseEntry {
  hexcode: string;
  unicode: string;
  label: string;
  tags?: string[];
  group: number;
  order: number;
  skins?: EmojibaseEntry[];
}

interface CompactEmoji {
  /** ID (hexcode) */
  i: string;
  /** Codepoints */
  c: number[];
  /** Shortcode */
  s: string;
  /** Category */
  g: CategoryId;
  /** Keywords */
  k: string[];
  /** Name */
  n: string;
  /** Has skin tones */
  t?: boolean;
}

/**
 * Load atlas manifests
 */
async function loadAtlases(): Promise<Map<string, AtlasManifest>> {
  const atlases = new Map<string, AtlasManifest>();
  
  try {
    const indexJson = await readFile(join(ATLASES_DIR, 'index.json'), 'utf-8');
    const index = JSON.parse(indexJson) as Record<string, AtlasManifest>;
    
    for (const [id, manifest] of Object.entries(index)) {
      atlases.set(id, manifest);
    }
  } catch (error) {
    console.warn('Warning: No atlas index found. Run generate-atlas.ts first.');
  }
  
  return atlases;
}

/**
 * Find atlas ref for hexcode
 */
function findAtlasRef(
  hexcode: string,
  category: CategoryId,
  atlases: Map<string, AtlasManifest>
): AtlasRef | null {
  const manifest = atlases.get(category);
  if (!manifest) return null;
  
  const normalizedHex = hexcode.toLowerCase().replace(/-fe0f/g, '');
  
  // Try exact match first
  let sprite = manifest.sprites[normalizedHex];
  
  // Try without fe0f variations
  if (!sprite) {
    sprite = manifest.sprites[hexcode.toLowerCase()];
  }
  
  // Try with different separators
  if (!sprite) {
    const altHex = hexcode.toLowerCase().replace(/ /g, '-');
    sprite = manifest.sprites[altHex];
  }
  
  if (!sprite) return null;
  
  return {
    atlasId: manifest.id,
    x: sprite.col * manifest.spriteSize,
    y: sprite.row * manifest.spriteSize,
    size: manifest.spriteSize,
  };
}

/**
 * Generate shortcode from label
 */
function generateShortcode(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 32);
}

/**
 * Parse hexcode to codepoints
 */
function hexToCodepoints(hexcode: string): number[] {
  return hexcode.split(/[-\s]/).map(h => parseInt(h, 16));
}

/**
 * Main function
 */
async function main() {
  console.log('=== Emojix Data Generator ===\n');
  
  // Load emojibase data
  console.log('Loading emojibase data...');
  const { default: emojibaseData } = await import('emojibase-data/en/data.json', {
    with: { type: 'json' }
  }) as { default: EmojibaseEntry[] };
  
  console.log(`Loaded ${emojibaseData.length} emoji from emojibase`);
  
  // Load atlas manifests
  const atlases = await loadAtlases();
  console.log(`Loaded ${atlases.size} atlas manifests`);
  
  // Process emoji
  const compactData: CompactEmoji[] = [];
  let matched = 0;
  let skipped = 0;
  
  for (const emoji of emojibaseData) {
    // Skip component emoji (skin tones, etc.)
    if (emoji.group === 2) {
      skipped++;
      continue;
    }
    
    const category = GROUP_TO_CATEGORY[emoji.group];
    if (!category) {
      skipped++;
      continue;
    }
    
    const hexcode = emoji.hexcode.toLowerCase();
    const codepoints = hexToCodepoints(emoji.hexcode);
    const shortcode = generateShortcode(emoji.label);
    
    // Find atlas reference
    const atlasRef = findAtlasRef(hexcode, category, atlases);
    
    // Only include if we have atlas data (or if no atlases exist yet)
    if (atlases.size > 0 && !atlasRef) {
      skipped++;
      continue;
    }
    
    const entry: CompactEmoji = {
      i: hexcode,
      c: codepoints,
      s: shortcode,
      g: category,
      k: emoji.tags ?? [],
      n: emoji.label,
    };
    
    // Add skin tone flag if applicable
    if (emoji.skins && emoji.skins.length > 0) {
      entry.t = true;
    }
    
    compactData.push(entry);
    matched++;
  }
  
  console.log(`\nProcessed: ${matched} matched, ${skipped} skipped`);
  
  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  // Write compact data
  const outputPath = join(OUTPUT_DIR, 'emoji-data.json');
  await writeFile(outputPath, JSON.stringify(compactData));
  
  // Also write a pretty version for debugging
  const prettyPath = join(OUTPUT_DIR, 'emoji-data.pretty.json');
  await writeFile(prettyPath, JSON.stringify(compactData, null, 2));
  
  // Calculate sizes
  const compactSize = JSON.stringify(compactData).length;
  console.log(`\n✓ Generated emoji data`);
  console.log(`  Entries: ${compactData.length}`);
  console.log(`  Size: ${(compactSize / 1024).toFixed(1)} KB`);
  console.log(`  Output: ${outputPath}`);
  
  // Generate TypeScript loader
  const loaderCode = `/**
 * Auto-generated emoji data loader
 * Generated at: ${new Date().toISOString()}
 */

import type { EmojiEntry, AtlasRef } from '../core/types/Emoji';
import type { CategoryId } from '../core/types/Category';
import { emojiRegistry } from '../core/registry/EmojiRegistry';
import { atlasLoader } from '../core/atlas/AtlasLoader';

interface CompactEmoji {
  i: string;
  c: number[];
  s: string;
  g: CategoryId;
  k: string[];
  n: string;
  t?: boolean;
}

// Import atlas manifests and images
${Array.from(atlases.keys()).map(cat => `
import ${cat}Manifest from '../assets/atlases/${cat}.json';
import ${cat}Atlas from '../assets/atlases/${cat}.webp';`).join('')}

// Import emoji data
import emojiData from './emoji-data.json';

/**
 * Initialize emoji registry with bundled data
 */
export async function initializeEmojix(): Promise<void> {
  // Register atlases
  ${Array.from(atlases.keys()).map(cat => `
  await atlasLoader.register(${cat}Manifest, ${cat}Atlas);`).join('')}
  
  // Register emoji
  const entries: EmojiEntry[] = (emojiData as CompactEmoji[]).map((e) => {
    // Find atlas ref
    const atlasRef: AtlasRef = findAtlasRef(e.i, e.g);
    
    return {
      id: e.i,
      codepoints: e.c,
      hexcode: e.i,
      shortcode: e.s,
      category: e.g,
      keywords: e.k,
      name: e.n,
      atlasRef,
      hasSkinTones: e.t ?? false,
    };
  });
  
  emojiRegistry.registerBulk(entries);
}

function findAtlasRef(hexcode: string, category: CategoryId): AtlasRef {
  // Get manifest for category
  const manifests: Record<string, any> = {
    ${Array.from(atlases.keys()).map(cat => `'${cat}': ${cat}Manifest`).join(',\n    ')}
  };
  
  const manifest = manifests[category];
  if (!manifest) {
    return { atlasId: category, x: 0, y: 0, size: 64 };
  }
  
  const sprite = manifest.sprites[hexcode];
  if (!sprite) {
    return { atlasId: category, x: 0, y: 0, size: manifest.spriteSize };
  }
  
  return {
    atlasId: manifest.id,
    x: sprite.col * manifest.spriteSize,
    y: sprite.row * manifest.spriteSize,
    size: manifest.spriteSize,
  };
}
`;
  
  const loaderPath = join(OUTPUT_DIR, 'loader.ts');
  await writeFile(loaderPath, loaderCode);
  console.log(`  Loader: ${loaderPath}`);
}

main().catch(console.error);
