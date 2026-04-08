<script setup lang="ts">
/**
 * SearchBar - Emoji search input
 */
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** Current search value */
  modelValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Auto focus on mount */
  autofocus?: boolean;
}>(), {
  modelValue: '',
  placeholder: 'Search emoji...',
  autofocus: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  clear: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

// Focus on mount if autofocus
watch(
  () => props.autofocus,
  (shouldFocus) => {
    if (shouldFocus && inputRef.value) {
      inputRef.value.focus();
    }
  },
  { immediate: true }
);

const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value);
};

const handleClear = () => {
  emit('update:modelValue', '');
  emit('clear');
  inputRef.value?.focus();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleClear();
  }
};

// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
});
</script>

<template>
  <div class="emojix-search">
    <svg
      class="emojix-search-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clip-rule="evenodd"
      />
    </svg>
    
    <input
      ref="inputRef"
      type="text"
      class="emojix-search-input"
      :value="modelValue"
      :placeholder="placeholder"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    
    <button
      v-if="modelValue"
      type="button"
      class="emojix-search-clear"
      @click="handleClear"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.emojix-search {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--emojix-border, #e5e7eb);
}

.emojix-search-icon {
  width: 16px;
  height: 16px;
  color: var(--emojix-text-muted, #9ca3af);
  flex-shrink: 0;
}

.emojix-search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 4px 8px;
  font-size: 14px;
  color: var(--emojix-text, #1f2937);
  outline: none;
}

.emojix-search-input::placeholder {
  color: var(--emojix-text-muted, #9ca3af);
}

.emojix-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: var(--emojix-bg-hover, #f3f4f6);
  border-radius: 50%;
  cursor: pointer;
  color: var(--emojix-text-muted, #9ca3af);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.emojix-search-clear:hover {
  background: var(--emojix-border, #e5e7eb);
  color: var(--emojix-text, #1f2937);
}

.emojix-search-clear svg {
  width: 14px;
  height: 14px;
}
</style>
