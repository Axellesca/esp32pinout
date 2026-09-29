import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle can be opened from any static path.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 5173,
    open: false
  }
});
