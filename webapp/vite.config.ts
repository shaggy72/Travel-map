import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// __dirname not available in ESM; derive from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');

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
  // Serve GPX files at the root path (/filename.gpx) so that
  // Remotion's staticFile('x.gpx') → '/x.gpx' resolves correctly in dev
  plugins: [
    react(),
    {
      name: 'serve-gpx',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0] ?? '';
          if (url.endsWith('.gpx')) {
            const filename = path.basename(url);
            const filepath = path.join(PUBLIC_DIR, filename);
            if (fs.existsSync(filepath)) {
              res.setHeader('Content-Type', 'application/gpx+xml');
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filepath).pipe(res as any);
              return;
            }
          }
          next();
        });
      },
    },
  ],
});
