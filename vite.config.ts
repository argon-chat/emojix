import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Emojix',
      formats: ['es', 'cjs'],
      fileName: (format) => `emojix.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
        assetFileNames: 'assets/[name][extname]',
      },
    },
    sourcemap: true,
    minify: true, // Uses oxc by default in Vite 8
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
