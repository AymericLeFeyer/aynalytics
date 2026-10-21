import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: { '/api': 'http://localhost:8081' },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
