import { defineConfig } from 'tsup';

// @aynalytics/core (devDependency, sources TS) est inline dans le bundle ;
// les dependances runtime (fastify, better-sqlite3, zod) restent dans node_modules.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  noExternal: ['@aynalytics/core'],
});
