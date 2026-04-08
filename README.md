# @argon-chat/emojix

High-performance emoji picker for Vue 3 with atlas-based sprite rendering, custom animated emoji, synchronized video playback, and rich text input support.

## Features

- **🚀 High Performance** — Virtual scrolling, CSS sprite atlases (9 atlases, 1221 emoji), minimal DOM operations
- **🎬 Animated Emoji** — WebM/MP4/GIF support with synchronized playback via shared canvas
- **🎨 Themeable** — Tailwind CSS v4 integration, CSS variables, light/dark/auto modes
- **🔧 Custom Emoji** — Runtime registration API with PUA (Private Use Area) mapping
- **📦 Custom Packs** — Group custom emoji into packs with separate tabs
- **✏️ Rich Input** — `EmojiInput` component with inline emoji rendering and clipboard support
- **📋 Smart Clipboard** — Custom emoji copy as fallback unicode for cross-app compatibility
- **🔍 Fast Search** — Trie-based search with keyword matching
- **📝 TypeScript** — Full type coverage

## Installation

```bash
bun add @argon-chat/emojix
# or
npm install @argon-chat/emojix
```

## Quick Start

```vue
<script setup lang="ts">
import { EmojixPicker } from '@argon-chat/emojix';
import '@argon-chat/emojix/style.css';

const handleSelect = (selection) => {
  console.log('Selected:', selection.text, selection.emoji.shortcode);
};
</script>

<template>
  <EmojixPicker @select="handleSelect" />
</template>
```

## Components

### EmojixPicker

Main emoji picker with search, categories, and custom emoji support.

```vue
<EmojixPicker
  :theme="'dark'"
  :columns="8"
  :emoji-size="32"
  :height="400"
  :render-mode="'atlas'"
  @select="handleSelect"
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `columns` | `number` | `8` | Grid columns |
| `emojiSize` | `number` | `32` | Emoji size in pixels |
| `height` | `number` | `400` | Picker height |
| `width` | `number` | `auto` | Picker width |
| `renderMode` | `RenderMode` | `'atlas'` | Rendering mode |
| `showSearch` | `boolean` | `true` | Show search bar |
| `showTabs` | `boolean` | `true` | Show category tabs |

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `select` | `EmojiSelection` | Fired when emoji is selected |

### EmojiInput

Rich text input with inline emoji rendering, video sync, and clipboard support.

```vue
<script setup>
import { ref } from 'vue';
import { EmojiInput } from '@argon-chat/emojix';

const message = ref('');
const inputRef = ref();

// Insert emoji programmatically
const insertEmoji = (entry) => {
  inputRef.value?.insertEmoji(entry);
};
</script>

<template>
  <EmojiInput
    ref="inputRef"
    v-model="message"
    placeholder="Type a message..."
    :emoji-size="20"
    @submit="sendMessage"
  />
</template>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string` | `''` | v-model binding (plaintext) |
| `placeholder` | `string` | `''` | Placeholder text |
| `emojiSize` | `number` | `20` | Inline emoji size |
| `renderMode` | `RenderMode` | `'atlas'` | Rendering mode |
| `maxLength` | `number` | - | Max character length |
| `disabled` | `boolean` | `false` | Disabled state |
| `singleLine` | `boolean` | `false` | Single line mode |
| `autofocus` | `boolean` | `false` | Autofocus on mount |

**Methods (via ref):**

| Method | Description |
|--------|-------------|
| `insertEmoji(entry)` | Insert emoji at cursor |
| `focus()` | Focus the input |
| `blur()` | Blur the input |
| `clear()` | Clear the input |
| `getText()` | Get plaintext value |

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string` | v-model update |
| `submit` | `string` | Ctrl+Enter or Enter (single line) |
| `focus` | - | Input focused |
| `blur` | - | Input blurred |

### EmojiSprite

Render a single emoji with atlas sprites or video.

```vue
<EmojiSprite
  :emoji="emojiEntry"
  :size="32"
  :render-mode="'atlas'"
  @click="handleClick"
/>
```

### EmojiStatus

Universal emoji renderer for arbitrary placement — user status, profile badges, inline decorations.

```vue
<script setup>
import { EmojiStatus } from '@argon-chat/emojix';
</script>

<template>
  <!-- Unicode emoji -->
  <span class="username">
    John Doe <EmojiStatus emoji="😀" :size="18" />
  </span>
  
  <!-- Animated status from URL -->
  <EmojiStatus
    url="https://example.com/premium-badge.webm"
    :size="24"
    fallback="⭐"
  />
  
  <!-- Custom emoji by ID -->
  <EmojiStatus emoji-id="custom:verified" :size="20" />
  
  <!-- Full custom config -->
  <EmojiStatus
    :custom="{
      url: 'https://cdn.example.com/animated-heart.webm',
      fallbackEmoji: '❤️'
    }"
    :size="24"
  />
</template>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `emoji` | `string` | - | Unicode emoji (e.g., "😀") |
| `emojiId` | `string` | - | Registry ID (e.g., "custom:fire") |
| `entry` | `EmojiEntry` | - | Direct EmojiEntry object |
| `url` | `string` | - | Direct URL to image/video |
| `custom` | `CustomEmojiInput` | - | Full custom emoji config |
| `size` | `number` | `20` | Size in pixels |
| `renderMode` | `RenderMode` | `'atlas'` | Render mode |
| `fallback` | `string` | - | Fallback emoji if load fails |
| `paused` | `boolean` | `false` | Pause video playback |
| `inline` | `boolean` | `true` | Display inline or block |
| `alt` | `string` | - | Accessibility title |

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `load` | - | Emoji loaded |
| `error` | `Error` | Load failed |
| `click` | - | Clicked |

## Composables

### useEmojix

Main composable for emoji operations.

```ts
import { useEmojix } from '@argon-chat/emojix';

const {
  search,           // (query, limit?) => SearchResult[]
  getEmoji,         // (id) => EmojiEntry | undefined
  getAllEmoji,      // () => EmojiEntry[]
  getByCategory,    // (categoryId) => EmojiEntry[]
  addCustomEmoji,   // (input) => Promise<EmojiEntry>
  removeCustomEmoji,// (id) => boolean
  registerPack,     // (pack) => void
  getCustomEmoji,   // (id) => { entry, input } | undefined
} = useEmojix();
```

### useEmojiRenderer

**For integrating emoji rendering into custom inputs.**

```ts
import { useEmojiRenderer } from '@argon-chat/emojix';

const renderer = useEmojiRenderer({
  emojiSize: 20,
  renderMode: 'atlas',
});

// Convert emoji to HTML for contenteditable
const html = renderer.emojiToHtml('😀');

// Convert full text with emoji to HTML
const richHtml = renderer.textToHtml('Hello 😀 World!');

// Convert HTML back to plaintext
const plaintext = renderer.htmlToPlaintext(richHtml);

// Setup video sync for animated emoji in a container
renderer.setupVideoSyncForContainer(editorElement);

// Register video for synchronized playback
const handle = renderer.registerVideoSync(videoUrl, 32);
container.appendChild(handle.canvas);

// Cleanup
renderer.unregisterVideoSync(handle);
renderer.cleanupVideoSyncs();
```

### useEmojiParsing

Parse and analyze emoji in text (for chat display).

```ts
import { useEmojiParsing } from '@argon-chat/emojix';

const {
  text,           // Ref<string> - input text
  processedText,  // ComputedRef - normalized text
  emojiOnly,      // ComputedRef<EmojiOnlyResult>
  isLargeEmoji,   // ComputedRef<boolean> - render enlarged?
  sizeMultiplier, // ComputedRef<number> - 1x, 1.5x, 2x, 3x
  emojis,         // ComputedRef<string[]> - extracted emoji
  segments,       // ComputedRef<TextSegment[]>
  setText,        // (value) => void
} = useEmojiParsing('Hello 😀');

// Non-reactive version
import { parseMessage } from '@argon-chat/emojix';
const result = parseMessage('Hello 😀');
```

### useCustomEmojiLoader

Batched loading for custom emoji from API.

```ts
import { useCustomEmojiLoader, setupCustomEmojiLoader } from '@argon-chat/emojix';

// Setup once at app init
setupCustomEmojiLoader(async (documentIds) => {
  const response = await api.getCustomEmoji(documentIds);
  return response.map(e => ({
    id: e.id,
    documentId: e.documentId,
    url: e.url,
    isVideo: e.url.endsWith('.webm'),
  }));
}, {
  batchDelay: 200,  // Batch window in ms
  maxBatchSize: 100,
});

// In components
const loader = useCustomEmojiLoader();
const emoji = loader.request(documentId); // Batched request
```

## Custom Emoji

### Registering Custom Emoji

```ts
import { useEmojix } from '@argon-chat/emojix';

const { addCustomEmoji, registerPack } = useEmojix();

// Register a pack first (optional)
registerPack({
  id: 'my-pack',
  name: 'My Custom Pack',
  icon: '🎨',
  order: 0,
});

// Add custom emoji
await addCustomEmoji({
  id: 'my-emoji-1',
  shortcode: 'custom_fire',
  name: 'Custom Fire',
  keywords: ['fire', 'hot', 'burn'],
  url: 'https://example.com/fire.png',
  packId: 'my-pack',
  fallbackEmoji: '🔥', // Used when copied to clipboard
});

// Animated emoji (WebM/MP4/GIF)
await addCustomEmoji({
  id: 'animated-heart',
  shortcode: 'animated_heart',
  name: 'Animated Heart',
  url: 'https://example.com/heart.webm',
  packId: 'my-pack',
  fallbackEmoji: '❤️',
});
```

### CustomEmojiInput Interface

```ts
interface CustomEmojiInput {
  id: string;              // Unique identifier
  shortcode: string;       // Without colons
  name?: string;           // Display name
  keywords?: string[];     // Search keywords
  packId?: string;         // Pack to assign to
  fallbackEmoji?: string;  // Unicode for clipboard copy
  url?: string;            // Single image URL
  atlasUrl?: string;       // Sprite atlas URL
  atlasPosition?: {        // Position in atlas
    x: number;
    y: number;
    size: number;
  };
}
```

## Video Synchronization

All instances of the same animated emoji are synchronized:

```ts
import { videoSyncManager } from '@argon-chat/emojix';

// Stats
const stats = videoSyncManager.getStats();
console.log(`${stats.masters} unique videos, ${stats.totalTargets} instances`);

// Pause all
videoSyncManager.pauseAll();

// Resume all
videoSyncManager.resumeAll();
```

## Theming

### CSS Variables

```css
:root {
  --emojix-bg: #ffffff;
  --emojix-bg-secondary: #f5f5f5;
  --emojix-bg-hover: rgba(0, 0, 0, 0.05);
  --emojix-text: #333333;
  --emojix-text-secondary: #666666;
  --emojix-border: #e0e0e0;
  --emojix-primary: #3b82f6;
  --emojix-primary-alpha: rgba(59, 130, 246, 0.2);
  --emojix-radius: 8px;
  --emojix-sprite-radius: 4px;
  --emojix-input-bg: #ffffff;
  --emojix-input-radius: 8px;
  --emojix-placeholder: #999999;
}

/* Dark theme */
[data-theme="dark"] {
  --emojix-bg: #1a1a1a;
  --emojix-bg-secondary: #2a2a2a;
  --emojix-text: #ffffff;
  /* ... */
}
```

## Render Modes

| Mode | Description |
|------|-------------|
| `atlas` | CSS sprite atlases (recommended, consistent across platforms) |
| `native` | Native OS emoji font (lightest, varies by platform) |
| `twemoji` | Twemoji font (requires font to be loaded) |
| `noto` | Noto Color Emoji font (requires font to be loaded) |

## API Reference

### Core Types

```ts
// Emoji entry in registry
interface EmojiEntry {
  id: string;
  codepoints: number[];
  hexcode: string;
  shortcode: string;
  category: CategoryId;
  keywords: string[];
  name: string;
  atlasRef: AtlasRef;
  isCustom?: boolean;
}

// Selection event payload
interface EmojiSelection {
  emoji: EmojiEntry;
  text: string;
  skinTone?: SkinTone;
  customData?: CustomEmojiInput;
}

// Categories
type CategoryId = 
  | 'recent' | 'smileys' | 'people' | 'animals' 
  | 'food' | 'travel' | 'activities' | 'objects' 
  | 'symbols' | 'flags' | 'custom';
```

### Utility Functions

```ts
import {
  // Emoji parsing
  extractEmojis,      // (text) => string[]
  countEmojis,        // (text) => number
  isEmojiOnly,        // (text) => EmojiOnlyResult
  splitTextAndEmoji,  // (text) => TextSegment[]
  
  // Emoji normalization
  fixNonStandardEmoji, // (text) => string
  normalizeEmoji,      // (text) => string
  hasEmoji,            // (text) => boolean
  
  // Codepoint utilities
  codepointsToString,  // (codepoints) => string
  stringToCodepoints,  // (str) => number[]
  codepointsToHexcode, // (codepoints) => string
} from '@argon-chat/emojix';
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## License

MIT

## Custom Emoji

```ts
import { useEmojix } from '@argon-chat/emojix';

const { addCustomEmoji, removeCustomEmoji } = useEmojix();

// Add custom emoji with single image
await addCustomEmoji({
  id: 'company-logo',
  shortcode: 'logo',
  name: 'Company Logo',
  url: 'https://example.com/logo.png',
  keywords: ['brand', 'company'],
});

// Or with atlas (sprite sheet)
await addCustomEmoji({
  id: 'custom-1',
  shortcode: 'custom1',
  atlasUrl: 'https://example.com/custom-atlas.webp',
  atlasPosition: { x: 0, y: 0, size: 64 },
});

// Remove
removeCustomEmoji('company-logo');
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number \| string` | `352` | Picker width |
| `height` | `number` | `400` | Picker height |
| `columns` | `number` | `8` | Grid columns |
| `emojiSize` | `number` | `32` | Emoji sprite size (px) |
| `gap` | `number` | `4` | Gap between emoji |
| `maxRecents` | `number` | `36` | Max recent emoji to store |
| `showSearch` | `boolean` | `true` | Show search bar |
| `showTabs` | `boolean` | `true` | Show category tabs |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `skinTone` | `SkinTone` | `'default'` | Default skin tone |
| `excludeCategories` | `CategoryId[]` | `[]` | Categories to hide |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `select` | `EmojiSelection` | Emoji selected |
| `skinToneChange` | `SkinTone` | Skin tone changed |

## Composables

### `useEmojix(options?)`

Main composable for programmatic control.

```ts
const {
  skinTone,           // Ref<SkinTone>
  currentCategory,    // Ref<CategoryId>
  categories,         // Readonly<Ref<Category[]>>
  setSkinTone,        // (tone: SkinTone) => void
  setCategory,        // (id: CategoryId) => void
  search,             // (query: string) => EmojiEntry[]
  addCustomEmoji,     // (input: CustomEmojiInput) => Promise<EmojiEntry>
  removeCustomEmoji,  // (id: string) => boolean
} = useEmojix();
```

### `useSearch(options?)`

Debounced search.

```ts
const { query, results, isSearching, clear } = useSearch({ debounce: 150 });
```

### `useRecents(options?)`

Recent emoji with localStorage persistence.

```ts
const { recentIds, addRecent, clearRecents } = useRecents({ maxRecents: 36 });
```

## Tailwind Integration

```ts
// tailwind.config.ts
import { emojixPlugin } from '@argon-chat/emojix/themes';

export default {
  plugins: [emojixPlugin],
};
```

This adds `emojix-*` color tokens and CSS variables that sync with your theme.

## CSS Variables

Override these for custom theming:

```css
:root {
  --emojix-bg: #ffffff;
  --emojix-bg-secondary: #f9fafb;
  --emojix-bg-hover: rgba(0, 0, 0, 0.05);
  --emojix-border: #e5e7eb;
  --emojix-text: #1f2937;
  --emojix-text-muted: #9ca3af;
  --emojix-radius: 8px;
}
```

## Architecture

```
src/
├── core/           # Framework-agnostic
│   ├── types/      # TypeScript interfaces
│   ├── encoding/   # PuaMapper, UTF utils
│   ├── registry/   # EmojiRegistry, SearchIndex
│   └── atlas/      # AtlasLoader, SpriteResolver
├── vue/            # Vue 3 integration
│   ├── components/ # EmojixPicker, EmojiGrid, etc.
│   ├── composables/# useEmojix, useSearch, etc.
│   └── plugin.ts   # Vue plugin
└── themes/         # Tailwind plugin, CSS vars
```

## License

MIT
