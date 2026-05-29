'use strict';

const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { execSync } = require('child_process');
const express  = require('express');
const session  = require('express-session');
const multer   = require('multer');
require('dotenv').config();

// ── Config ────────────────────────────────────────────────────────────────
const PORT       = parseInt(process.env.PORT || '3002', 10);
const USERNAME   = process.env.APP_USERNAME   || 'admin';
const PASSWORD   = process.env.APP_PASSWORD   || 'changeme';
const SECRET     = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

const ROOT_DIR   = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const WEBAPP_DIR = path.join(ROOT_DIR, 'webapp', 'dist');
const ENTRY_POINT = path.join(ROOT_DIR, 'src', 'index.ts');

// ── Bundle cache ──────────────────────────────────────────────────────────
let bundlePath  = null;   // null = needs (re)build
let isRendering = false;

async function getBundle() {
  if (!bundlePath) {
    console.log('[bundle] Building Remotion bundle…');
    const { bundle } = await import('@remotion/bundler');
    bundlePath = await bundle({
      entryPoint: ENTRY_POINT,
      publicDir:  PUBLIC_DIR,
    });
    console.log('[bundle] Ready:', bundlePath);
  }
  return bundlePath;
}

// ── Multer: GPX uploads ───────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: PUBLIC_DIR,
    filename: (_req, file, cb) => cb(null, file.originalname),
  }),
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.gpx') {
      cb(null, true);
    } else {
      cb(new Error('Only .gpx files are accepted'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

// ── Express app ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));

// Serve GPX files (needed by @remotion/player in the browser)
app.use('/public', express.static(PUBLIC_DIR));

// ── Auth middleware ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth routes ───────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    req.session.loggedIn = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ── GPX management ────────────────────────────────────────────────────────
app.get('/api/gpx-files', requireAuth, (_req, res) => {
  try {
    const files = fs.readdirSync(PUBLIC_DIR)
      .filter(f => f.toLowerCase().endsWith('.gpx'))
      .sort();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/upload-gpx', requireAuth, upload.single('gpxFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file received.');
  }

  // Regenerate src/gpxFiles.ts so next bundle includes the new file
  try {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'syncGpxFiles.cjs')}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('[upload] syncGpxFiles failed:', err.message);
  }

  // Invalidate bundle so next render picks up the new file
  bundlePath = null;
  console.log('[upload] Bundle invalidated — will rebuild on next render.');

  res.json({ ok: true, filename: req.file.originalname });
});

// ── Render ────────────────────────────────────────────────────────────────
app.post('/api/render', requireAuth, async (req, res) => {
  if (isRendering) {
    return res.status(409).send('A render is already in progress. Please wait.');
  }

  const inputProps = req.body;
  if (!inputProps || typeof inputProps !== 'object') {
    return res.status(400).send('Invalid props.');
  }

  isRendering = true;
  const outFile = path.join(os.tmpdir(), `travel-map-${Date.now()}.mp4`);

  try {
    const serveUrl = await getBundle();

    const { selectComposition, renderMedia } = await import('@remotion/renderer');

    const composition = await selectComposition({
      serveUrl,
      id: 'EuropeMap',
      inputProps,
    });

    console.log(`[render] Starting render — ${composition.durationInFrames} frames`);

    await renderMedia({
      composition,
      serveUrl,
      codec:          'h264',
      outputLocation: outFile,
      inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        process.stdout.write(`\r[render] ${pct}%`);
      },
    });

    console.log('\n[render] Done:', outFile);

    res.download(outFile, 'travel-map.mp4', (err) => {
      if (err) console.error('[render] Download error:', err);
      fs.unlink(outFile, () => {});
    });
  } catch (err) {
    console.error('\n[render] Error:', err);
    fs.unlink(outFile, () => {});
    res.status(500).send(
      err instanceof Error ? err.message : 'Render failed. Check server logs.'
    );
  } finally {
    isRendering = false;
  }
});

// ── Serve frontend (production) ───────────────────────────────────────────
if (fs.existsSync(WEBAPP_DIR)) {
  app.use(express.static(WEBAPP_DIR));
  // SPA fallback (Express v5 wildcard syntax)
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(WEBAPP_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send(
      '<p>Frontend not built. Run <code>npm run build:webapp</code> first, ' +
      'or start Vite dev server with <code>npm run dev</code>.</p>'
    );
  });
}

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Travel Map server running on http://localhost:${PORT}`);
  if (!process.env.APP_PASSWORD) {
    console.warn('[warn] APP_PASSWORD not set in .env — using default "changeme". Set it before exposing publicly!');
  }
});
