<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { EmojixPicker, EmojiInput, useEmojix } from '@argon-chat/emojix';
import type { EmojiEntry } from '@argon-chat/emojix';

// Types
interface EmojiSelection {
  emoji: EmojiEntry;
  text: string;
}

type RenderMode = 'atlas' | 'native' | 'twemoji' | 'noto';

// State
const selectedEmoji = ref<EmojiSelection | null>(null);
const messageText = ref('');
const showPicker = ref(true);
const theme = ref<'light' | 'dark' | 'auto'>('auto');
const columns = ref(8);
const emojiSize = ref(32);
const renderMode = ref<RenderMode>('atlas');

// Ref for EmojiInput component
const emojiInputRef = ref<InstanceType<typeof EmojiInput> | null>(null);

// Emojix composable
const { search, registerPack, addCustomEmoji, getCustomEmoji } = useEmojix();

// Search demo
const searchQuery = ref('');
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return [];
  return search(searchQuery.value, 10);
});

// Handle emoji selection - insert into rich input
const handleSelect = (selection: EmojiSelection) => {
  selectedEmoji.value = selection;
  
  // Insert emoji into rich input
  if (emojiInputRef.value) {
    emojiInputRef.value.insertEmoji(selection.emoji);
  } else {
    // Fallback for plaintext
    messageText.value += selection.text;
  }
};

// Toggle theme
const toggleTheme = () => {
  const themes: ('light' | 'dark' | 'auto')[] = ['light', 'dark', 'auto'];
  const idx = themes.indexOf(theme.value);
  theme.value = themes[(idx + 1) % themes.length]!;
};

// Animated emoji names for the test pack with fallback emoji for copy/paste
const ANIMATED_EMOJI_NAMES = [
  { id: '0', shortcode: 'animated_fire', name: 'Animated Fire', keywords: ['fire', 'burn', 'hot'], fallbackEmoji: '🔥' },
  { id: '1', shortcode: 'animated_heart', name: 'Animated Heart', keywords: ['heart', 'love', 'pulse'], fallbackEmoji: '❤️' },
  { id: '2', shortcode: 'animated_star', name: 'Animated Star', keywords: ['star', 'sparkle', 'shine'], fallbackEmoji: '⭐' },
  { id: '3', shortcode: 'animated_laugh', name: 'Animated Laugh', keywords: ['laugh', 'lol', 'funny'], fallbackEmoji: '😂' },
  { id: '4', shortcode: 'animated_cry', name: 'Animated Cry', keywords: ['cry', 'sad', 'tears'], fallbackEmoji: '😢' },
  { id: '5', shortcode: 'animated_rage', name: 'Animated Rage', keywords: ['rage', 'angry', 'mad'], fallbackEmoji: '😡' },
  { id: '6', shortcode: 'animated_party', name: 'Animated Party', keywords: ['party', 'celebrate', 'confetti'], fallbackEmoji: '🎉' },
  { id: '7', shortcode: 'animated_clap', name: 'Animated Clap', keywords: ['clap', 'applause', 'bravo'], fallbackEmoji: '👏' },
  { id: '8', shortcode: 'animated_rocket', name: 'Animated Rocket', keywords: ['rocket', 'launch', 'space'], fallbackEmoji: '🚀' },
];

// Load animated test pack on mount
const loadAnimatedPack = async () => {
  try {
    // Register the animated emoji pack
    registerPack({
      id: 'animated-test',
      name: 'Animated Test',
      icon: '🎬',
      order: -1, // Show first
    });
    
    // Add each WebM emoji
    for (const emoji of ANIMATED_EMOJI_NAMES) {
      try {
        await addCustomEmoji({
          id: `anim-${emoji.id}`,
          shortcode: emoji.shortcode,
          name: emoji.name,
          url: `./${emoji.id}.webm`, // Local WebM files
          keywords: emoji.keywords,
          packId: 'animated-test',
          fallbackEmoji: emoji.fallbackEmoji, // Unicode emoji for copy/paste
        });
      } catch (e) {
        // Already exists, skip
      }
    }
    
    console.log('✅ Animated test pack loaded!');
  } catch (e) {
    console.error('Failed to load animated pack:', e);
  }
};

// Load on mount
onMounted(() => {
  loadAnimatedPack();
});

// Demo: Add Twemoji pack
const addTwemojiPack = async () => {
  try {
    // Register pack first
    registerPack({
      id: 'twemoji-extras',
      name: 'Twemoji Extras',
      icon: '🐦',
      order: 0,
    });
    
    // Add some emoji to this pack
    await addCustomEmoji({
      id: 'tw-bird',
      shortcode: 'twitter_bird',
      name: 'Twitter Bird',
      url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f426.png',
      keywords: ['twitter', 'bird', 'blue'],
      packId: 'twemoji-extras',
    });
    
    await addCustomEmoji({
      id: 'tw-rocket',
      shortcode: 'twitter_rocket',
      name: 'Twitter Rocket',
      url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f680.png',
      keywords: ['rocket', 'space'],
      packId: 'twemoji-extras',
    });
    
    alert('Twemoji pack added! Check the tabs at the bottom.');
  } catch (e) {
    alert('Error: ' + e);
  }
};

// Demo: Add standalone custom emoji (no pack)
const addCustom = async () => {
  try {
    await addCustomEmoji({
      id: 'custom-star',
      shortcode: 'custom_star',
      name: 'Custom Star',
      url: 'https://em-content.zobj.net/source/twitter/376/star_2b50.png',
      keywords: ['star', 'custom', 'test'],
      // No packId - goes to "Custom" section
    });
    alert('Custom emoji added! Check the Custom tab at the bottom.');
  } catch (e) {
    alert('Custom emoji already exists or error: ' + e);
  }
};
</script>

<template>
  <div class="playground" :class="{ dark: theme === 'dark' }">
    <!-- Header -->
    <header class="header">
      <h1>🎨 Emojix Playground</h1>
      <p>High-performance emoji picker for Vue 3</p>
    </header>

    <div class="content">
      <!-- Controls Panel -->
      <div class="panel controls">
        <h2>⚙️ Controls</h2>
        
        <div class="control-group">
          <label>Theme</label>
          <button @click="toggleTheme" class="btn">
            {{ theme === 'light' ? '☀️ Light' : theme === 'dark' ? '🌙 Dark' : '🔄 Auto' }}
          </button>
        </div>

        <div class="control-group">
          <label>Columns: {{ columns }}</label>
          <input type="range" v-model.number="columns" min="4" max="12" />
        </div>

        <div class="control-group">
          <label>Emoji Size: {{ emojiSize }}px</label>
          <input type="range" v-model.number="emojiSize" min="24" max="48" step="4" />
        </div>

        <div class="control-group">
          <label>Show/Hide</label>
          <button @click="showPicker = !showPicker" class="btn">
            {{ showPicker ? '👁️ Hide Picker' : '👁️ Show Picker' }}
          </button>
        </div>

        <div class="control-group">
          <label>Custom Emoji</label>
          <button @click="addCustom" class="btn">
            ⭐ Add Custom Star
          </button>
        </div>

        <div class="control-group">
          <label>Custom Pack</label>
          <button @click="addTwemojiPack" class="btn">
            🐦 Add Twemoji Pack
          </button>
        </div>

        <div class="control-group">
          <label>Render Mode</label>
          <select v-model="renderMode" class="select">
            <option value="atlas">🎨 Atlas (Sprites)</option>
            <option value="native">📱 Native</option>
            <option value="twemoji">🐦 Twemoji Font</option>
            <option value="noto">🤖 Noto Font</option>
          </select>
        </div>
      </div>

      <!-- Picker Panel -->
      <div class="panel picker-panel">
        <h2>🎯 Emoji Picker</h2>
        
        <div class="picker-container" v-if="showPicker">
          <EmojixPicker
            :theme="theme"
            :columns="columns"
            :emoji-size="emojiSize"
            :height="400"
            :width="columns * (emojiSize + 4) + 32"
            :render-mode="renderMode"
            @select="handleSelect"
          />
        </div>
        <div v-else class="picker-placeholder">
          Picker is hidden. Click "Show Picker" to reveal.
        </div>
      </div>

      <!-- Output Panel -->
      <div class="panel output">
        <h2>📤 Output</h2>

        <!-- Message input -->
        <div class="message-box">
          <label>Rich Emoji Input</label>
          <div class="message-input">
            <EmojiInput
              ref="emojiInputRef"
              v-model="messageText"
              placeholder="Click emoji to add them here..."
              :render-mode="renderMode"
              :emoji-size="20"
              @submit="(text) => alert('Submit: ' + text)"
            />
            <button @click="emojiInputRef?.clear()" class="btn-clear">Clear</button>
          </div>
          <div class="plaintext-preview">
            <small>Plaintext: {{ messageText }}</small>
          </div>
        </div>

        <!-- Selected emoji info -->
        <div class="selection-info" v-if="selectedEmoji">
          <label>Last Selected</label>
          <div class="emoji-info">
            <span class="emoji-preview">{{ selectedEmoji.text }}</span>
            <div class="emoji-details">
              <div><strong>Shortcode:</strong> :{{ selectedEmoji.emoji.shortcode }}:</div>
              <div><strong>Name:</strong> {{ selectedEmoji.emoji.name }}</div>
              <div><strong>Category:</strong> {{ selectedEmoji.emoji.category }}</div>
              <div><strong>Hexcode:</strong> {{ selectedEmoji.emoji.hexcode }}</div>
            </div>
          </div>
        </div>

        <!-- Search demo -->
        <div class="search-demo">
          <label>Search API Demo</label>
          <input 
            v-model="searchQuery" 
            placeholder="Type to search emoji..." 
            class="search-input"
          />
          <div class="search-results" v-if="searchResults.length">
            <span 
              v-for="emoji in searchResults" 
              :key="emoji.id"
              class="search-result"
              :title="emoji.name"
            >
              {{ String.fromCodePoint(...emoji.codepoints) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <p>
        Built with 💜 using Vue 3 + Vite + Tailwind CSS
        <span class="separator">|</span>
        <a href="https://github.com/argon-chat/emojix" target="_blank">GitHub</a>
      </p>
    </footer>
  </div>
</template>

<style scoped>
.playground {
  min-height: 100vh;
  padding: 20px;
  color: #1f2937;
}

.playground.dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #f9fafb;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  color: white;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 8px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.header p {
  opacity: 0.9;
  font-size: 1.1rem;
}

.content {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 1200px) {
  .content {
    grid-template-columns: 1fr 1fr;
  }
  .controls {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .content {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.dark .panel {
  background: #1f2937;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.panel h2 {
  font-size: 1.25rem;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e5e7eb;
}

.dark .panel h2 {
  border-bottom-color: #374151;
}

/* Controls */
.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 6px;
}

.dark .control-group label {
  color: #9ca3af;
}

.control-group input[type="range"] {
  width: 100%;
  accent-color: #8b5cf6;
}

.btn {
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.select {
  width: 100%;
  padding: 10px 16px;
  background: var(--card-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.select:hover {
  border-color: #8b5cf6;
}

.select:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}

/* Picker */
.picker-panel {
  display: flex;
  flex-direction: column;
}

.picker-container {
  display: flex;
  justify-content: center;
}

.picker-placeholder {
  padding: 60px 20px;
  text-align: center;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 8px;
}

.dark .picker-placeholder {
  background: #111827;
}

/* Output */
.message-box {
  margin-bottom: 20px;
}

.message-box label,
.selection-info label,
.search-demo label {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 8px;
}

.dark .message-box label,
.dark .selection-info label,
.dark .search-demo label {
  color: #9ca3af;
}

.message-input {
  position: relative;
}

.message-input textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  resize: none;
  font-size: 1.25rem;
  font-family: inherit;
}

.dark .message-input textarea {
  background: #111827;
  border-color: #374151;
  color: #f9fafb;
}

.btn-clear {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 12px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.selection-info {
  margin-bottom: 20px;
}

.emoji-info {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.dark .emoji-info {
  background: #111827;
}

.emoji-preview {
  font-size: 3rem;
  line-height: 1;
}

.emoji-details {
  font-size: 0.875rem;
  line-height: 1.6;
}

.emoji-details div {
  margin-bottom: 2px;
}

.search-demo {
  margin-top: 16px;
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 12px;
}

.dark .search-input {
  background: #111827;
  border-color: #374151;
  color: #f9fafb;
}

.search-results {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-result {
  font-size: 1.5rem;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.search-result:hover {
  background: #e5e7eb;
}

.dark .search-result:hover {
  background: #374151;
}

/* Footer */
.footer {
  text-align: center;
  margin-top: 40px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.8);
}

.footer a {
  color: white;
  text-decoration: underline;
}

.separator {
  margin: 0 12px;
  opacity: 0.5;
}
</style>
