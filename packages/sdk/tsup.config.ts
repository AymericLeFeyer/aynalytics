import { defineConfig } from 'tsup';

export default defineConfig([
  // Module ESM/CJS pour les projets bundles (React, Vite...) + helper serveur.
  {
    entry: { index: 'src/index.ts', server: 'src/server.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    splitting: false,
    target: 'es2020',
  },
  // Script autonome servi par le collector sur /sdk.js (window.aynalytics).
  {
    entry: { aynalytics: 'src/browser.ts' },
    format: ['iife'],
    minify: true,
    target: 'es2018',
    outExtension: () => ({ js: '.global.js' }),
  },
]);
