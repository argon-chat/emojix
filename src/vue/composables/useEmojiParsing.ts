/**
 * useEmojiParsing - Vue composable for emoji parsing utilities
 * 
 * Provides reactive emoji parsing for chat messages
 */

import { computed, ref, type Ref, type ComputedRef } from 'vue';
import {
  isEmojiOnly,
  extractEmojis,
  countEmojis,
  getEmojiSizeMultiplier,
  splitTextAndEmoji,
  type EmojiOnlyResult,
  type TextSegment,
} from '@/core/encoding/parseEmojiString';
import {
  fixNonStandardEmoji,
  normalizeEmoji,
  hasEmoji,
} from '@/core/encoding/fixNonStandardEmoji';

export interface UseEmojiParsingOptions {
  /** Auto-fix non-standard emoji in input */
  autoFix?: boolean;
  /** Auto-normalize emoji (canonical form) */
  autoNormalize?: boolean;
}

export interface UseEmojiParsingResult {
  /** Input text (reactive) */
  text: Ref<string>;
  
  /** Fixed/normalized text */
  processedText: ComputedRef<string>;
  
  /** Is emoji-only message */
  emojiOnly: ComputedRef<EmojiOnlyResult>;
  
  /** Should render as large emoji */
  isLargeEmoji: ComputedRef<boolean>;
  
  /** Size multiplier for large emoji */
  sizeMultiplier: ComputedRef<number>;
  
  /** All extracted emojis */
  emojis: ComputedRef<string[]>;
  
  /** Emoji count */
  emojiCount: ComputedRef<number>;
  
  /** Has any emoji */
  hasEmoji: ComputedRef<boolean>;
  
  /** Text split into segments */
  segments: ComputedRef<TextSegment[]>;
  
  /** Set input text */
  setText: (value: string) => void;
}

/**
 * Parse emoji from reactive text input
 */
export function useEmojiParsing(
  initialText: string = '',
  options: UseEmojiParsingOptions = {}
): UseEmojiParsingResult {
  const { autoFix = true, autoNormalize = false } = options;
  
  const text = ref(initialText);
  
  const processedText = computed(() => {
    let result = text.value;
    if (autoFix) {
      result = fixNonStandardEmoji(result);
    }
    if (autoNormalize) {
      result = normalizeEmoji(result);
    }
    return result;
  });
  
  const emojiOnly = computed(() => isEmojiOnly(processedText.value));
  
  const isLargeEmoji = computed(() => emojiOnly.value.isOnlyEmoji);
  
  const sizeMultiplier = computed(() => {
    if (!emojiOnly.value.isOnlyEmoji) return 1;
    return getEmojiSizeMultiplier(emojiOnly.value.count);
  });
  
  const emojis = computed(() => extractEmojis(processedText.value));
  
  const emojiCount = computed(() => countEmojis(processedText.value));
  
  const hasEmojiComputed = computed(() => hasEmoji(processedText.value));
  
  const segments = computed(() => splitTextAndEmoji(processedText.value));
  
  const setText = (value: string) => {
    text.value = value;
  };
  
  return {
    text,
    processedText,
    emojiOnly,
    isLargeEmoji,
    sizeMultiplier,
    emojis,
    emojiCount,
    hasEmoji: hasEmojiComputed,
    segments,
    setText,
  };
}

/**
 * Parse a static message (non-reactive)
 */
export function parseMessage(text: string, options: UseEmojiParsingOptions = {}) {
  const { autoFix = true, autoNormalize = false } = options;
  
  let processed = text;
  if (autoFix) {
    processed = fixNonStandardEmoji(processed);
  }
  if (autoNormalize) {
    processed = normalizeEmoji(processed);
  }
  
  const emojiOnlyResult = isEmojiOnly(processed);
  
  return {
    text: processed,
    emojiOnly: emojiOnlyResult,
    isLargeEmoji: emojiOnlyResult.isOnlyEmoji,
    sizeMultiplier: emojiOnlyResult.isOnlyEmoji 
      ? getEmojiSizeMultiplier(emojiOnlyResult.count) 
      : 1,
    emojis: extractEmojis(processed),
    emojiCount: countEmojis(processed),
    hasEmoji: hasEmoji(processed),
    segments: splitTextAndEmoji(processed),
  };
}
