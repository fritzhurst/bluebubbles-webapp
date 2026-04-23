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
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // Default to loopback only. Set VITE_HOST_ALL=true to expose the dev
    // server on the LAN (e.g. for testing from another device on the network).
    // Combined with prior Vite/esbuild CVEs that let any origin read the dev
    // server, binding to 0.0.0.0 by default is an unnecessary risk.
    host: process.env.VITE_HOST_ALL === 'true' ? true : 'localhost',
  },
  build: {
    outDir: 'dist',
    // Only emit sourcemaps in dev-mode builds. Production bundles shipped to
    // a public host should not include .map files — they expose original
    // TypeScript, auth flows, and API internals.
    sourcemap: mode !== 'production',
    target: 'es2020',
  },
}));
