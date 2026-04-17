import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the config's own directory in an ESM-safe way.
// `__dirname` is not defined when the config is loaded as ESM (which it is
// when package.json has "type": "module") — using it silently produced a
// bogus alias path that worked in dev but broke `vite build` with
// "Rollup failed to resolve import @/...".
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so you can reach it from other devices on your LAN
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
});
