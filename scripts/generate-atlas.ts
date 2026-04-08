/**
 * Atlas Generator - Generates sprite atlases from Twemoji SVG files
 * 
 * Usage: bun run scripts/generate-atlas.ts
 * 
 * This script:
 * 1. Downloads Twemoji SVGs (or uses local cache)
 * 2. Converts SVGs to PNGs at multiple resolutions
 * 3. Packs PNGs into sprite atlases per category
 * 4. Generates JSON manifests for each atlas
 */

import sharp from 'sharp';
import { mkdir, readdir, readFile, writeFile, access } from 'fs/promises';
import { join, basename } from 'path';
import type { AtlasManifest, SpritePosition } from '../src/core/types/Atlas';
import type { CategoryId } from '../src/core/types/Category';

// Configuration
const CONFIG = {
  // Twemoji SVG source
  twemojiUrl: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/',
  
  // Output directories
  outputDir: './src/assets/atlases',
  cacheDir: './scripts/.cache/twemoji',
  
  // Sprite sizes
  spriteSize: 64,
  
  // Atlas dimensions (max 4096x4096 for WebGL compatibility)
  atlasMaxWidth: 2048,
  atlasMaxHeight: 2048,
  
  // Output format
  format: 'webp' as const,
  quality: 90,
};

// Category mapping based on Unicode emoji categories
const CATEGORY_RANGES: Record<CategoryId, [number, number][]> = {
  recent: [], // Virtual category
  smileys: [
    [0x1F600, 0x1F64F], // Emoticons
    [0x1F910, 0x1F92F], // Additional faces
    [0x1F970, 0x1F97F], // More faces
    [0x1F9D0, 0x1F9D0], // Face with monocle
    [0x1FAE0, 0x1FAE8], // New faces
  ],
  people: [
    [0x1F466, 0x1F487], // People
    [0x1F48F, 0x1F48F], // Kiss
    [0x1F491, 0x1F491], // Couple with heart
    [0x1F4AA, 0x1F4AA], // Flexed biceps
    [0x1F645, 0x1F64F], // Gestures
    [0x1F6B4, 0x1F6C0], // Person activities
    [0x1F9B0, 0x1F9B9], // Body parts, heroes
    [0x1F9CD, 0x1F9CF], // Accessibility
    [0x1F9D1, 0x1F9DF], // People
    [0x1FAC0, 0x1FAC5], // People parts
  ],
  animals: [
    [0x1F400, 0x1F43F], // Animals
    [0x1F980, 0x1F9AE], // More animals
    [0x1F330, 0x1F335], // Plants
    [0x1F337, 0x1F343], // Flowers
    [0x1FAB0, 0x1FABE], // More animals/plants
  ],
  food: [
    [0x1F345, 0x1F37F], // Food
    [0x1F950, 0x1F96F], // More food
    [0x1F9C0, 0x1F9CB], // Food items
    [0x1FAD0, 0x1FADE], // More food
  ],
  travel: [
    [0x1F680, 0x1F6C5], // Transport and places
    [0x1F6CC, 0x1F6FF], // More transport
    [0x1F30D, 0x1F321], // Globe, maps, weather
    [0x26F0, 0x26FA],   // Misc places
    [0x1F3D4, 0x1F3DF], // Buildings
  ],
  activities: [
    [0x1F380, 0x1F393], // Celebration
    [0x1F3A0, 0x1F3CA], // Entertainment
    [0x1F3CF, 0x1F3D3], // Sports
    [0x26BD, 0x26BD],   // Soccer
    [0x26BE, 0x26BE],   // Baseball
    [0x1F94A, 0x1F94F], // Martial arts
    [0x1F9E7, 0x1F9FF], // Games
    [0x1FA80, 0x1FA86], // More activities
  ],
  objects: [
    [0x1F4A0, 0x1F4A9], // Abstract shapes
    [0x1F4AB, 0x1F4FF], // Objects
    [0x1F500, 0x1F53D], // Symbols/UI
    [0x1F5A4, 0x1F5FF], // Hand signs, objects
    [0x1F6E0, 0x1F6EC], // Tools
    [0x1F9F0, 0x1F9FF], // More objects
    [0x1FA70, 0x1FA7C], // Objects
  ],
  symbols: [
    [0x2600, 0x26FF],   // Misc symbols
    [0x2700, 0x27BF],   // Dingbats
    [0x2300, 0x23FF],   // Technical symbols
    [0x25A0, 0x25FF],   // Geometric shapes
    [0x2B50, 0x2B55],   // Stars
    [0x3030, 0x3030],   // Wavy dash
    [0x303D, 0x303D],   // Part alternation
  ],
  flags: [
    [0x1F1E0, 0x1F1FF], // Regional indicators
    [0x1F3C1, 0x1F3C1], // Chequered flag
    [0x1F3F3, 0x1F3F4], // White/Black flag
    [0x1F38C, 0x1F38C], // Crossed flags
  ],
  custom: [], // User-provided custom emoji
};

/**
 * Determine category for a codepoint
 */
function getCategory(codepoint: number): CategoryId | null {
  for (const [category, ranges] of Object.entries(CATEGORY_RANGES)) {
    for (const [start, end] of ranges) {
      if (codepoint >= start && codepoint <= end) {
        return category as CategoryId;
      }
    }
  }
  return null;
}

/**
 * Parse hexcode filename to codepoints
 */
function parseHexcode(filename: string): number[] {
  const hex = basename(filename, '.svg');
  return hex.split('-').map(h => parseInt(h, 16));
}

/**
 * Download Twemoji SVGs to cache
 */
async function downloadTwemoji(): Promise<string[]> {
  const cacheDir = CONFIG.cacheDir;
  
  // Check if cache exists
  try {
    await access(cacheDir);
    const files = await readdir(cacheDir);
    if (files.length > 1000) {
      console.log(`Using cached Twemoji (${files.length} files)`);
      return files.filter(f => f.endsWith('.svg')).map(f => join(cacheDir, f));
    }
  } catch {
    // Cache doesn't exist
  }
  
  console.log('Downloading Twemoji SVGs...');
  await mkdir(cacheDir, { recursive: true });
  
  // Get list of emoji from emojibase
  const { default: emojibaseData } = await import('emojibase-data/en/compact.json', {
    with: { type: 'json' }
  });
  
  const downloaded: string[] = [];
  let count = 0;
  
  for (const emoji of emojibaseData) {
    const hexcode = emoji.hexcode.toLowerCase().replace(/ /g, '-');
    const url = `${CONFIG.twemojiUrl}${hexcode}.svg`;
    const filepath = join(cacheDir, `${hexcode}.svg`);
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const svg = await response.text();
        await writeFile(filepath, svg);
        downloaded.push(filepath);
        count++;
        
        if (count % 100 === 0) {
          console.log(`Downloaded ${count} SVGs...`);
        }
      }
    } catch (error) {
      // Skip missing files
    }
  }
  
  console.log(`Downloaded ${count} Twemoji SVGs`);
  return downloaded;
}

/**
 * Convert SVG to PNG buffer
 */
async function svgToPng(svgPath: string, size: number): Promise<Buffer> {
  const svg = await readFile(svgPath);
  
  return sharp(svg)
    .resize(size, size)
    .png()
    .toBuffer();
}

/**
 * Generate atlas for a category
 */
async function generateAtlas(
  category: CategoryId,
  svgFiles: string[]
): Promise<{ manifest: AtlasManifest; imageBuffer: Buffer } | null> {
  if (svgFiles.length === 0) return null;
  
  const spriteSize = CONFIG.spriteSize;
  const maxCols = Math.floor(CONFIG.atlasMaxWidth / spriteSize);
  const maxRows = Math.floor(CONFIG.atlasMaxHeight / spriteSize);
  const maxSprites = maxCols * maxRows;
  
  // Limit sprites per atlas
  const files = svgFiles.slice(0, maxSprites);
  
  // Calculate atlas dimensions
  const cols = Math.min(files.length, maxCols);
  const rows = Math.ceil(files.length / cols);
  
  const atlasWidth = cols * spriteSize;
  const atlasHeight = rows * spriteSize;
  
  console.log(`Generating ${category} atlas: ${cols}x${rows} (${files.length} sprites)`);
  
  // Convert all SVGs to PNG buffers
  const pngBuffers: { buffer: Buffer; hexcode: string; col: number; row: number }[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const hexcode = basename(file, '.svg');
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    try {
      const buffer = await svgToPng(file, spriteSize);
      pngBuffers.push({ buffer, hexcode, col, row });
    } catch (error) {
      console.warn(`Failed to convert ${hexcode}: ${error}`);
    }
  }
  
  // Composite all sprites into atlas
  const compositeInputs = pngBuffers.map(({ buffer, col, row }) => ({
    input: buffer,
    left: col * spriteSize,
    top: row * spriteSize,
  }));
  
  // Create atlas image
  const atlasBuffer = await sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .webp({ quality: CONFIG.quality })
    .toBuffer();
  
  // Build manifest
  const sprites: Record<string, SpritePosition> = {};
  for (const { hexcode, col, row } of pngBuffers) {
    sprites[hexcode] = { col, row };
  }
  
  const manifest: AtlasManifest = {
    id: category,
    category,
    resolution: 1,
    format: 'webp',
    dimensions: { width: atlasWidth, height: atlasHeight },
    spriteSize,
    columns: cols,
    sprites,
  };
  
  return { manifest, imageBuffer: atlasBuffer };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Emojix Atlas Generator ===\n');
  
  // Download/cache Twemoji
  const svgFiles = await downloadTwemoji();
  
  // Group files by category
  const byCategory = new Map<CategoryId, string[]>();
  
  for (const category of Object.keys(CATEGORY_RANGES) as CategoryId[]) {
    byCategory.set(category, []);
  }
  
  for (const file of svgFiles) {
    const codepoints = parseHexcode(file);
    const primaryCodepoint = codepoints[0];
    if (primaryCodepoint === undefined) continue;
    
    const category = getCategory(primaryCodepoint);
    if (category && byCategory.has(category)) {
      byCategory.get(category)!.push(file);
    }
  }
  
  // Create output directory
  await mkdir(CONFIG.outputDir, { recursive: true });
  
  // Generate atlases
  const manifests: Record<string, AtlasManifest> = {};
  
  for (const [category, files] of byCategory) {
    if (files.length === 0) continue;
    
    const result = await generateAtlas(category, files);
    if (result) {
      // Write atlas image
      const imagePath = join(CONFIG.outputDir, `${category}.webp`);
      await writeFile(imagePath, result.imageBuffer);
      
      // Write manifest
      const manifestPath = join(CONFIG.outputDir, `${category}.json`);
      await writeFile(manifestPath, JSON.stringify(result.manifest, null, 2));
      
      manifests[category] = result.manifest;
      
      console.log(`  ✓ ${category}: ${Object.keys(result.manifest.sprites).length} sprites`);
    }
  }
  
  // Write combined manifest index
  const indexPath = join(CONFIG.outputDir, 'index.json');
  await writeFile(indexPath, JSON.stringify(manifests, null, 2));
  
  console.log(`\n✓ Generated ${Object.keys(manifests).length} atlases`);
  console.log(`  Output: ${CONFIG.outputDir}`);
}

main().catch(console.error);
