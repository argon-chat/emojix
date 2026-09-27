/**
 * Builds the sprite atlases and the emoji data from Apple's emoji art — the set Telegram Web ships.
 *
 *   bun run scripts/build-atlases.ts [--apple <dir>] [--quality <0-100>]
 *
 * Source images: `img-apple-64` of https://github.com/iamcal/emoji-data (64×64 PNGs named by their
 * unified codepoints: `1f600.png`, `2764-fe0f.png`, `1f469-200d-1f4bb.png`). Names with `-fe0f`
 * stripped, as tweb keeps them (see its EMOJI.md), work as well. Default directory:
 * `scripts/.cache/apple-64` (gitignored). The artwork is Apple's; see src/assets/atlases/README.md.
 *
 * Emoji list: emojibase-data 17 (`en/data.json`). An emoji is listed only when there is art for it,
 * so the picker never offers a blank cell; text that holds one without art keeps the system font.
 *
 * Output, checked in like any other asset:
 *   src/assets/atlases/<id>.webp + <id>.json   one atlas per category; skin-tone variants in
 *                                              tone1…tone5 (by their first tone), so a message with
 *                                              one toned hand does not fetch every toned person
 *   src/assets/atlases/index.json              every manifest, for tooling
 *   src/data/emoji-data.json (+ .pretty.json)  the registry data (see CompactEmoji)
 *   src/data/atlases.ts                        imports of every atlas: manifest + image URL
 *
 * Manifest keys are the unified hexcode without `fe0f` (unifiedHexcode()), which is also how
 * the loader and EmojiRegistry look sprites up.
 */

import sharp from 'sharp';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { AtlasManifest, SpritePosition } from '../src/core/types/Atlas';
import type { CategoryId } from '../src/core/types/Category';
import type { CompactEmoji } from '../src/data/compact';
import { unifiedHexcode } from '../src/core/encoding/CodepointUtils';

const argv = process.argv.slice(2);
const arg = (flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

const ROOT = join(import.meta.dir, '..');
const APPLE_DIR = arg('--apple') ?? process.env.EMOJIX_APPLE_DIR ?? join(ROOT, 'scripts/.cache/apple-64');
const ATLAS_DIR = join(ROOT, 'src/assets/atlases');
const DATA_DIR = join(ROOT, 'src/data');

/** The art is 64 px; each sits in a 68 px cell with 2 px of transparent margin around it. */
const ART = 64;
const PAD = 2;
/**
 * The manifest's spriteSize: what a sprite shows is the whole cell. Without the margin a sprite
 * drawn at a fractional scale (1.25em of a 14 px font) filters in a sliver of its neighbour, and
 * some Apple art touches its edge.
 */
const CELL = ART + 2 * PAD;
/** 30 × 68 px = 2040 px wide; no atlas grows past 2040 px tall (see MAX_SPRITES). */
const COLUMNS = 30;
const MAX_SPRITES = COLUMNS * COLUMNS;
const QUALITY = Number(arg('--quality') ?? 85);

/** emojibase group → emojix category. Group 2 (components: skin tones, hair) has no category. */
const GROUP_TO_CATEGORY: Record<number, CategoryId> = {
  0: 'smileys',
  1: 'people',
  3: 'animals',
  4: 'food',
  5: 'travel',
  6: 'activities',
  7: 'objects',
  8: 'symbols',
  9: 'flags',
};
const COMPONENT_GROUP = 2;
/** Components are drawn (a lone 🏽 in text) but not listed; their sprites sit with the people. */
const COMPONENT_ATLAS = 'people';

const CATEGORY_ATLASES: CategoryId[] = ['smileys', 'people', 'animals', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'];
const TONE_ATLASES = ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'];

interface EmojibaseEntry {
  hexcode: string;
  label: string;
  tags?: string[];
  group?: number;
  order?: number;
  tone?: number | number[];
  skins?: EmojibaseEntry[];
}

function shortcodeOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 32);
}


async function loadArt(): Promise<Map<string, string>> {
  if (!existsSync(APPLE_DIR)) {
    console.error(
      `No emoji art in ${APPLE_DIR}.\n` +
        'Put the PNGs of https://github.com/iamcal/emoji-data/tree/master/img-apple-64 there, or pass --apple <dir>.',
    );
    process.exit(2);
  }
  const art = new Map<string, string>();
  for (const file of await readdir(APPLE_DIR)) {
    if (!file.endsWith('.png')) continue;
    art.set(unifiedHexcode(file.slice(0, -4)), join(APPLE_DIR, file));
  }
  return art;
}

interface Sprite {
  key: string;
  file: string;
}

async function buildAtlas(id: string, category: string, sprites: Sprite[]): Promise<AtlasManifest> {
  if (sprites.length > MAX_SPRITES) throw new Error(`atlas ${id} has ${sprites.length} sprites, more than ${MAX_SPRITES}`);
  const columns = Math.min(COLUMNS, sprites.length);
  const rows = Math.ceil(sprites.length / columns);
  const width = columns * CELL;
  const height = rows * CELL;

  const positions: Record<string, SpritePosition> = {};
  const layers: sharp.OverlayOptions[] = [];
  for (const [index, sprite] of sprites.entries()) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions[sprite.key] = { col, row };
    // Every source is 64×64 already; resize only guards against a stray odd one.
    const input = await sharp(sprite.file).resize(ART, ART, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    layers.push({ input, left: col * CELL + PAD, top: row * CELL + PAD });
  }

  const image = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toBuffer();
  await writeFile(join(ATLAS_DIR, `${id}.webp`), image);

  const manifest: AtlasManifest = {
    id,
    category,
    resolution: 1,
    format: 'webp',
    dimensions: { width, height },
    spriteSize: CELL,
    columns,
    sprites: positions,
  };
  await writeFile(join(ATLAS_DIR, `${id}.json`), JSON.stringify(manifest, null, 2));
  console.log(`  ${id.padEnd(11)} ${String(sprites.length).padStart(4)} sprites  ${width}×${height}  ${(image.length / 1024).toFixed(0)} KB`);
  return manifest;
}

function atlasModule(ids: string[]): string {
  const name = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');
  return [
    '// Generated by scripts/build-atlases.ts. Do not edit.',
    '',
    "import type { AtlasManifest } from '../core/types/Atlas';",
    ...ids.flatMap((id) => [
      `import ${name(id)}Manifest from '../assets/atlases/${id}.json';`,
      `import ${name(id)}Url from '../assets/atlases/${id}.webp';`,
    ]),
    '',
    '/** Every bundled atlas. The image is only a URL: the browser fetches it when one of its sprites is first shown. */',
    'export const BUNDLED_ATLASES: ReadonlyArray<{ manifest: AtlasManifest; url: string }> = [',
    ...ids.map((id) => `  { manifest: ${name(id)}Manifest as unknown as AtlasManifest, url: ${name(id)}Url },`),
    '];',
    '',
  ].join('\n');
}

async function main() {
  const art = await loadArt();
  const { default: emojibase } = (await import('emojibase-data/en/data.json', { with: { type: 'json' } })) as {
    default: EmojibaseEntry[];
  };
  console.log(`${art.size} images in ${APPLE_DIR}, ${emojibase.length} emojibase entries`);

  const atlases = new Map<string, Sprite[]>([...CATEGORY_ATLASES, ...TONE_ATLASES].map((id) => [id, []]));
  const data: CompactEmoji[] = [];
  const missing: string[] = [];
  const used = new Set<string>();

  const place = (atlas: string, hexcode: string): boolean => {
    const key = unifiedHexcode(hexcode);
    const file = art.get(key);
    if (!file) return false;
    if (!used.has(key)) {
      used.add(key);
      atlases.get(atlas)!.push({ key, file });
    }
    return true;
  };

  for (const emoji of emojibase) {
    const hexcode = emoji.hexcode.toLowerCase();
    const component = emoji.group === COMPONENT_GROUP;
    const category = component ? COMPONENT_ATLAS : GROUP_TO_CATEGORY[emoji.group ?? -1];
    // Regional indicator letters have no group: they are only halves of a flag.
    if (!category) continue;
    if (!place(category, hexcode)) {
      missing.push(`${emoji.hexcode} ${emoji.label}`);
      continue;
    }

    const entry: CompactEmoji = {
      i: hexcode,
      s: shortcodeOf(emoji.label),
      g: category as CategoryId,
      k: emoji.tags ?? [],
      n: emoji.label,
    };
    if (component) entry.h = 1;

    const variants: string[] = [];
    let noArt = 0;
    for (const skin of emoji.skins ?? []) {
      const tone = Array.isArray(skin.tone) ? skin.tone[0] : skin.tone;
      const atlas = TONE_ATLASES[(tone ?? 1) - 1] ?? TONE_ATLASES[0]!;
      if (place(atlas, skin.hexcode)) variants.push(skin.hexcode.toLowerCase());
      else noArt++;
    }
    if (noArt) missing.push(`${emoji.hexcode} ${emoji.label}: ${noArt} of ${emoji.skins!.length} skin tones`);
    if (variants.length) {
      entry.t = true;
      entry.v = variants;
    }
    data.push(entry);
  }

  const unused = [...art.keys()].filter((key) => !used.has(key));

  // Atlases of an earlier build go (a split or renamed one must not linger); the README stays.
  await mkdir(ATLAS_DIR, { recursive: true });
  for (const file of await readdir(ATLAS_DIR)) {
    if (file.endsWith('.webp') || file.endsWith('.json')) await rm(join(ATLAS_DIR, file));
  }

  console.log('atlases:');
  const manifests: Record<string, AtlasManifest> = {};
  let bytes = 0;
  for (const [id, sprites] of atlases) {
    if (!sprites.length) continue;
    const category = TONE_ATLASES.includes(id) ? 'people' : id;
    manifests[id] = await buildAtlas(id, category, sprites);
  }
  for (const id of Object.keys(manifests)) bytes += (await readFile(join(ATLAS_DIR, `${id}.webp`))).length;
  await writeFile(join(ATLAS_DIR, 'index.json'), JSON.stringify(manifests, null, 2));
  await writeFile(join(DATA_DIR, 'atlases.ts'), atlasModule(Object.keys(manifests)));
  await writeFile(join(DATA_DIR, 'emoji-data.json'), JSON.stringify(data));
  await writeFile(join(DATA_DIR, 'emoji-data.pretty.json'), JSON.stringify(data, null, 2));

  const listed = data.filter((e) => !e.h).length;
  const variants = data.reduce((n, e) => n + (e.v?.length ?? 0), 0);
  console.log(
    `\n${listed} emoji listed, ${data.length - listed} components, ${variants} skin-tone variants: ${used.size} sprites in ` +
      `${Object.keys(manifests).length} atlases, ${(bytes / 1024).toFixed(0)} KB`,
  );
  console.log(`emoji-data.json: ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
  if (missing.length) console.log(`\nno art for ${missing.length} (left out):\n  ${missing.join('\n  ')}`);
  if (unused.length) console.log(`\nart for no emojibase entry (left out): ${unused.join(' ')}`);
}

await main();
