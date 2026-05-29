import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

// __dirname not available in ESM; derive from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Explicit root = webapp/ directory so Vite finds index.html here
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api':    'http://localhost:3002',
      '/public': 'http://localhost:3002',
    },
  },
});
