/**
 * Auto-generated emoji data loader
 * Generated at: 2026-04-08T01:50:42.716Z
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

import smileysManifest from '../assets/atlases/smileys.json';
import smileysAtlas from '../assets/atlases/smileys.webp';
import peopleManifest from '../assets/atlases/people.json';
import peopleAtlas from '../assets/atlases/people.webp';
import animalsManifest from '../assets/atlases/animals.json';
import animalsAtlas from '../assets/atlases/animals.webp';
import foodManifest from '../assets/atlases/food.json';
import foodAtlas from '../assets/atlases/food.webp';
import travelManifest from '../assets/atlases/travel.json';
import travelAtlas from '../assets/atlases/travel.webp';
import activitiesManifest from '../assets/atlases/activities.json';
import activitiesAtlas from '../assets/atlases/activities.webp';
import objectsManifest from '../assets/atlases/objects.json';
import objectsAtlas from '../assets/atlases/objects.webp';
import symbolsManifest from '../assets/atlases/symbols.json';
import symbolsAtlas from '../assets/atlases/symbols.webp';
import flagsManifest from '../assets/atlases/flags.json';
import flagsAtlas from '../assets/atlases/flags.webp';

// Import emoji data
import emojiData from './emoji-data.json';

/**
 * Initialize emoji registry with bundled data.
 *
 * Cheap by design: atlases are registered by manifest and URL only (the browser fetches an atlas
 * when a sprite from it is first shown) and the search trie is built on the first search.
 */
export async function initializeEmojix(): Promise<void> {
  // Register atlases (cast to AtlasManifest since JSON imports lose literal types)
  await atlasLoader.register(smileysManifest as unknown as import('../core/types/Atlas').AtlasManifest, smileysAtlas);
  await atlasLoader.register(peopleManifest as unknown as import('../core/types/Atlas').AtlasManifest, peopleAtlas);
  await atlasLoader.register(animalsManifest as unknown as import('../core/types/Atlas').AtlasManifest, animalsAtlas);
  await atlasLoader.register(foodManifest as unknown as import('../core/types/Atlas').AtlasManifest, foodAtlas);
  await atlasLoader.register(travelManifest as unknown as import('../core/types/Atlas').AtlasManifest, travelAtlas);
  await atlasLoader.register(activitiesManifest as unknown as import('../core/types/Atlas').AtlasManifest, activitiesAtlas);
  await atlasLoader.register(objectsManifest as unknown as import('../core/types/Atlas').AtlasManifest, objectsAtlas);
  await atlasLoader.register(symbolsManifest as unknown as import('../core/types/Atlas').AtlasManifest, symbolsAtlas);
  await atlasLoader.register(flagsManifest as unknown as import('../core/types/Atlas').AtlasManifest, flagsAtlas);
  
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
    'smileys': smileysManifest,
    'people': peopleManifest,
    'animals': animalsManifest,
    'food': foodManifest,
    'travel': travelManifest,
    'activities': activitiesManifest,
    'objects': objectsManifest,
    'symbols': symbolsManifest,
    'flags': flagsManifest
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
