/**
 * fixNonStandardEmoji - Normalize emoji from different platforms
 * 
 * Fixes non-standard emoji variations used on some devices:
 * - Missing VS16 (U+FE0F) on emoji that need it
 * - Gender variations without proper modifiers
 * - Flag emoji normalization
 * 
 * Inspired by Telegram Web implementation.
 */

// Anything the fixes below could touch: a pictograph, or a keycap mark after a digit. Not the
// Emoji property, which is true of every digit and would send plain numbers through the
// character loop. No `g` flag: `test()` on a global regex keeps `lastIndex` between calls, so the
// same text answered true and false alternately.
const EMOJI_REGEX = /[\p{Extended_Pictographic}⃣]/u;

// VS16 - Variation Selector 16 (emoji presentation)
const VS16 = '\uFE0F';

// ZWJ - Zero Width Joiner
const ZWJ = '\u200D';

/**
 * Non-standard emoji variations that need fixing.
 * [pattern, replacement]
 */
const EMOJI_FIXES: [RegExp, string][] = [
  // Rainbow flag without VS16: 🏳‍🌈 → 🏳️‍🌈
  [/\u{1F3F3}\u200D\u{1F308}/gu, '\u{1F3F3}\uFE0F\u200D\u{1F308}'],
  
  // Transgender flag: 🏳‍⚧ → 🏳️‍⚧️
  [/\u{1F3F3}\u200D\u26A7\uFE0F?/gu, '\u{1F3F3}\uFE0F\u200D\u26A7\uFE0F'],
  
  // Broken chain: ⛓‍💥 → ⛓️‍💥
  [/\u26D3\u200D\u{1F4A5}/gu, '\u26D3\uFE0F\u200D\u{1F4A5}'],
  
  // Gender variations without VS16: ‍♀ → ‍♀️, ‍♂ → ‍♂️
  [/\u200D([\u2640\u2642])(?!\uFE0F)/gu, '\u200D$1\uFE0F'],
  
  // Keycap sequences without VS16: #⃣ needs # + VS16 + ⃣
  [/([\u0023\u002A\u0030-\u0039])(?!\uFE0F)\u20E3/gu, '$1\uFE0F\u20E3'],
  
  // Heart exclamation without VS16
  [/\u2763(?!\uFE0F)/gu, '\u2763\uFE0F'],
  
  // Black heart without VS16
  [/\u2764(?!\uFE0F)/gu, '\u2764\uFE0F'],
];

/**
 * Emoji that should have VS16 presentation
 * These are common emoji that some platforms send without VS16
 */
const NEEDS_VS16 = new Set([
  '\u2618', // ☘ Shamrock
  '\u2620', // ☠ Skull and crossbones
  '\u2622', // ☢ Radioactive
  '\u2623', // ☣ Biohazard
  '\u2626', // ☦ Orthodox cross
  '\u2638', // ☸ Wheel of Dharma
  '\u2639', // ☹ Frowning face
  '\u263A', // ☺ Smiling face
  '\u2640', // ♀ Female sign
  '\u2642', // ♂ Male sign
  '\u2648', // ♈-♓ Zodiac
  '\u2649',
  '\u264A',
  '\u264B',
  '\u264C',
  '\u264D',
  '\u264E',
  '\u264F',
  '\u2650',
  '\u2651',
  '\u2652',
  '\u2653',
  '\u265F', // ♟ Chess pawn
  '\u2660', // ♠ Spade
  '\u2663', // ♣ Club
  '\u2665', // ♥ Heart
  '\u2666', // ♦ Diamond
  '\u2668', // ♨ Hot springs
  '\u267B', // ♻ Recycling
  '\u267E', // ♾ Infinity
  '\u267F', // ♿ Wheelchair
  '\u2692', // ⚒ Hammer and pick
  '\u2693', // ⚓ Anchor
  '\u2694', // ⚔ Crossed swords
  '\u2695', // ⚕ Staff of Aesculapius
  '\u2696', // ⚖ Scales
  '\u2697', // ⚗ Alembic
  '\u2699', // ⚙ Gear
  '\u269B', // ⚛ Atom
  '\u269C', // ⚜ Fleur-de-lis
  '\u26A0', // ⚠ Warning
  '\u26A1', // ⚡ High voltage
  '\u26A7', // ⚧ Transgender
  '\u26B0', // ⚰ Coffin
  '\u26B1', // ⚱ Urn
  '\u26C4', // ⛄ Snowman
  '\u26C5', // ⛅ Sun behind cloud
  '\u26C8', // ⛈ Thunder cloud
  '\u26CF', // ⛏ Pick
  '\u26D1', // ⛑ Rescue worker helmet
  '\u26D3', // ⛓ Chains
  '\u26E9', // ⛩ Shinto shrine
  '\u26EA', // ⛪ Church
  '\u26F0', // ⛰ Mountain
  '\u26F1', // ⛱ Umbrella on ground
  '\u26F4', // ⛴ Ferry
  '\u26F5', // ⛵ Sailboat
  '\u26F7', // ⛷ Skier
  '\u26F8', // ⛸ Ice skate
  '\u26F9', // ⛹ Person bouncing ball
  '\u26FA', // ⛺ Tent
  '\u26FD', // ⛽ Fuel pump
  '\u2702', // ✂ Scissors
  '\u2708', // ✈ Airplane
  '\u2709', // ✉ Envelope
  '\u270C', // ✌ Victory hand
  '\u270D', // ✍ Writing hand
  '\u270F', // ✏ Pencil
  '\u2712', // ✒ Black nib
  '\u2714', // ✔ Check mark
  '\u2716', // ✖ Multiplication
  '\u271D', // ✝ Latin cross
  '\u2721', // ✡ Star of David
  '\u2733', // ✳ Eight spoked asterisk
  '\u2734', // ✴ Eight pointed star
  '\u2744', // ❄ Snowflake
  '\u2747', // ❇ Sparkle
  '\u2753', // ❓ Question mark
  '\u2757', // ❗ Exclamation mark
  '\u2763', // ❣ Heart exclamation
  '\u2764', // ❤ Red heart
  '\u27A1', // ➡ Right arrow
  '\u2934', // ⤴ Right arrow curving up
  '\u2935', // ⤵ Right arrow curving down
  '\u2B05', // ⬅ Left arrow
  '\u2B06', // ⬆ Up arrow
  '\u2B07', // ⬇ Down arrow
  '\u3030', // 〰 Wavy dash
  '\u303D', // 〽 Part alternation mark
  '\u3297', // ㊗ Circled ideograph congratulation
  '\u3299', // ㊙ Circled ideograph secret
]);

/**
 * Check if text contains any emoji
 */
export function hasEmoji(text: string): boolean {
  return EMOJI_REGEX.test(text);
}

/**
 * Fix non-standard emoji variations in text
 * 
 * @param text - Text that may contain non-standard emoji
 * @returns Text with normalized emoji
 * 
 * @example
 * ```ts
 * fixNonStandardEmoji('🏳‍🌈') // → '🏳️‍🌈' (with VS16)
 * fixNonStandardEmoji('Hello ♥ World') // → 'Hello ♥️ World'
 * ```
 */
export function fixNonStandardEmoji(text: string): string {
  // Quick check - if no emoji-like characters, return as-is
  if (!text || !hasEmoji(text)) {
    return text;
  }
  
  // Apply known fixes
  for (const [pattern, replacement] of EMOJI_FIXES) {
    text = text.replace(pattern, replacement);
  }
  
  // Add VS16 to emoji that need it but don't have it
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i]!;
    const codePoint = text.codePointAt(i)!;
    const charLen = codePoint > 0xFFFF ? 2 : 1;
    const nextChar = text[i + charLen];
    
    // Check if this character needs VS16 and doesn't have it
    if (NEEDS_VS16.has(char) && nextChar !== VS16) {
      // Don't add VS16 if followed by skin tone modifier or ZWJ
      const nextCodePoint = nextChar ? text.codePointAt(i + charLen) : 0;
      const isSkinTone = nextCodePoint && nextCodePoint >= 0x1F3FB && nextCodePoint <= 0x1F3FF;
      const isZWJ = nextChar === ZWJ;
      
      if (!isSkinTone && !isZWJ) {
        result += char + VS16;
        i += charLen;
        continue;
      }
    }
    
    result += text.slice(i, i + charLen);
    i += charLen;
  }
  
  return result;
}

/**
 * Remove VS16 from text (for comparison/normalization)
 */
export function removeVS16(text: string): string {
  return text.replace(/\uFE0F/g, '');
}

/**
 * Normalize emoji for comparison
 * Removes VS16 and converts to lowercase for consistent matching
 */
export function normalizeEmoji(emoji: string): string {
  return removeVS16(emoji).toLowerCase();
}
