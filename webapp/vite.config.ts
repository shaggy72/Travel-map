import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// __dirname not available in ESM; derive from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
// .env lives at the project root (one level up from webapp/)
const PROJECT_ROOT = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  // Load .env from the project root with no prefix filter (gets all vars)
  const env = loadEnv(mode, PROJECT_ROOT, '');

  return {
    // Explicit root = webapp/ directory so Vite finds index.html here
    root: __dirname,

    // Substitute process.env.MAPBOX_TOKEN at build time so the browser
    // bundle never contains the raw token string — it's injected from
    // the gitignored .env file, just as Remotion's esbuild bundler does.
    define: {
      'process.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN ?? ''),
      // Expose the optional custom style slug — schema.ts falls back to mapbox/light-v11 when empty
      'process.env.MAPBOX_STYLE': JSON.stringify(env.MAPBOX_STYLE ?? ''),
    },

    build: {
      outDir: path.join(__dirname, 'dist'),
      emptyOutDir: true,
    },

    server: {
      port: 5173,
      // Remotion's Player bundles compositions at runtime and requires eval().
      // Vite 8 sets a strict CSP by default — override it for dev only.
      headers: {
        'Content-Security-Policy':
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
      },
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
  };
});
