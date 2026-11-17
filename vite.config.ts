import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/** Browsers block module scripts on file://, so emit a classic deferred script instead. */
const classicScript = (): Plugin => ({
  name: 'classic-script',
  apply: 'build',
  transformIndexHtml: (html) => html.replace(/<script type="module" crossorigin/g, '<script defer'),
});

// Relative base + IIFE bundle: dist/index.html works when opened directly from disk.
export default defineConfig({
  base: './',
  plugins: [classicScript()],
  build: {
    modulePreload: false,
    rollupOptions: { output: { format: 'iife' } },
  },
});
