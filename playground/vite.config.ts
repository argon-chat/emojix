import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  root: resolve(__dirname),
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@argon-chat/emojix': resolve(__dirname, '../src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    include: ['vue'],
  },
});
