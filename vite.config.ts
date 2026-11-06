import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built game works from any static host / subfolder.
  base: './',
  server: { port: 5173 },
  build: {
    assetsInlineLimit: 0, // keep sprite sheets as real files, never base64
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.2 MB
  },
});
