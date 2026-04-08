/**
 * Tailwind CSS v4 Theme Plugin for Emojix
 * Adds emojix color tokens to your Tailwind config
 */

import plugin from 'tailwindcss/plugin';

/**
 * Emojix Tailwind Plugin
 * Adds CSS variables and utilities for theming
 */
export const emojixPlugin: ReturnType<typeof plugin> = plugin(
  function ({ addBase }) {
    addBase({
      ':root': {
        '--emojix-bg': 'var(--color-white, #ffffff)',
        '--emojix-bg-secondary': 'var(--color-gray-50, #f9fafb)',
        '--emojix-bg-hover': 'color-mix(in srgb, var(--color-gray-900, #111827) 5%, transparent)',
        '--emojix-bg-active': 'color-mix(in srgb, var(--color-blue-500, #3b82f6) 10%, transparent)',
        '--emojix-border': 'var(--color-gray-200, #e5e7eb)',
        '--emojix-text': 'var(--color-gray-900, #1f2937)',
        '--emojix-text-muted': 'var(--color-gray-400, #9ca3af)',
        '--emojix-accent': 'var(--color-blue-500, #3b82f6)',
        '--emojix-scrollbar': 'var(--color-gray-300, #d1d5db)',
        '--emojix-radius': 'var(--radius-lg, 8px)',
        '--emojix-sprite-radius': 'var(--radius-sm, 4px)',
      },
      '.dark': {
        '--emojix-bg': 'var(--color-gray-800, #1f2937)',
        '--emojix-bg-secondary': 'var(--color-gray-900, #111827)',
        '--emojix-bg-hover': 'color-mix(in srgb, var(--color-white, #ffffff) 10%, transparent)',
        '--emojix-bg-active': 'color-mix(in srgb, var(--color-blue-500, #3b82f6) 20%, transparent)',
        '--emojix-border': 'var(--color-gray-700, #374151)',
        '--emojix-text': 'var(--color-gray-50, #f9fafb)',
        '--emojix-text-muted': 'var(--color-gray-400, #9ca3af)',
        '--emojix-scrollbar': 'var(--color-gray-600, #4b5563)',
      },
    });
  },
  {
    theme: {
      extend: {
        colors: {
          emojix: {
            bg: 'var(--emojix-bg)',
            'bg-secondary': 'var(--emojix-bg-secondary)',
            'bg-hover': 'var(--emojix-bg-hover)',
            'bg-active': 'var(--emojix-bg-active)',
            border: 'var(--emojix-border)',
            text: 'var(--emojix-text)',
            'text-muted': 'var(--emojix-text-muted)',
            accent: 'var(--emojix-accent)',
          },
        },
        borderRadius: {
          emojix: 'var(--emojix-radius)',
          'emojix-sprite': 'var(--emojix-sprite-radius)',
        },
      },
    },
  }
);

export default emojixPlugin;
