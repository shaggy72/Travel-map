'use strict';

const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const crypto   = require('crypto');
const { execSync, exec } = require('child_process');
const { promisify }      = require('util');
const execAsync          = promisify(exec); // async version used for update/build steps
const express  = require('express');
const multer   = require('multer');
require('dotenv').config();

// ── Config ────────────────────────────────────────────────────────────────
const PORT     = parseInt(process.env.PORT || '3002', 10);
const USERNAME = process.env.APP_USERNAME   || 'admin';
const PASSWORD = process.env.APP_PASSWORD   || 'changeme';

const ROOT_DIR    = process.cwd();
const PUBLIC_DIR  = path.join(ROOT_DIR, 'public');
const WEBAPP_DIR  = path.join(ROOT_DIR, 'webapp', 'dist');
const ENTRY_POINT = path.join(ROOT_DIR, 'src', 'index.ts');

// ── Simple session store (no express-session dependency) ──────────────────
// Maps token → createdAt timestamp. Tokens survive server restarts only via
// the in-process Map (users re-login after restart, which is fine).
const SESSION_COOKIE  = 'travel_map_sid';
const SESSION_MAX_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
const activeSessions  = new Map();

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, Date.now());
  return token;
}

function destroySession(token) {
  activeSessions.delete(token);
}

function isValidSession(token) {
  if (!token || !activeSessions.has(token)) return false;
  const age = Date.now() - activeSessions.get(token);
  if (age > SESSION_MAX_MS) { activeSessions.delete(token); return false; }
  return true;
}

/** Parse the session cookie from request headers (no cookie-parser needed). */
function getSessionToken(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k.trim() === SESSION_COOKIE) return decodeURIComponent((v || '').trim());
  }
  return null;
}

/** Set the session cookie on the response. */
function setSessionCookie(res, token) {
  const maxAge = Math.round(SESSION_MAX_MS / 1000);
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`
  );
}

/** Clear the session cookie. */
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`
  );
}

// ── Auth middleware ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (isValidSession(getSessionToken(req))) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auto-update ───────────────────────────────────────────────────────────
// Read the current git commit hash once on startup. The hash stays fixed until
// the process restarts (after an update + pm2 restart it becomes the new hash).
let localHash = '';
try {
  localHash = execSync('git rev-parse HEAD', { cwd: ROOT_DIR }).toString().trim();
  console.log(`[update] Running commit: ${localHash.slice(0, 7)}`);
} catch {
  console.warn('[update] Not a git repo — update check disabled.');
}

// ── Remotion bundle cache ─────────────────────────────────────────────────
let bundlePath  = null;
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
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Express app ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve GPX files (needed by @remotion/player in browser)
app.use('/public', express.static(PUBLIC_DIR));

// ── Auth routes ───────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    const token = createSession();
    setSessionCookie(res, token);
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
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
  if (!req.file) return res.status(400).send('No file received.');

  try {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'syncGpxFiles.cjs')}"`, {
      cwd: ROOT_DIR, stdio: 'inherit',
    });
  } catch (err) {
    console.error('[upload] syncGpxFiles failed:', err.message);
  }

  bundlePath = null; // invalidate bundle so next render picks up new file
  console.log('[upload] GPX saved, bundle invalidated.');
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

    const composition = await selectComposition({ serveUrl, id: 'EuropeMap', inputProps });
    console.log(`[render] Starting — ${composition.durationInFrames} frames`);

    await renderMedia({
      composition,
      serveUrl,
      codec:          'h264',
      outputLocation: outFile,
      inputProps,
      onProgress: ({ progress }) => {
        process.stdout.write(`\r[render] ${Math.round(progress * 100)}%`);
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
    res.status(500).send(err instanceof Error ? err.message : 'Render failed.');
  } finally {
    isRendering = false;
  }
});

// ── Update endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/update-check
 * Does a live call to the GitHub API to compare the remote main branch hash
 * against the local hash captured at startup. Called by the webapp on each
 * page load; no background polling on the server side.
 */
app.get('/api/update-check', requireAuth, async (_req, res) => {
  if (!localHash) {
    return res.json({ updateAvailable: false, localHash: '', remoteHash: '' });
  }
  try {
    const ghRes = await fetch(
      'https://api.github.com/repos/shaggy72/Travel-map/commits/main',
      { headers: { 'User-Agent': 'travel-map-server' } }
    );
    if (!ghRes.ok) {
      return res.json({ updateAvailable: false, localHash, remoteHash: '' });
    }
    const { sha: remoteHash } = await ghRes.json();
    res.json({ updateAvailable: remoteHash !== localHash, localHash, remoteHash });
  } catch {
    // GitHub unreachable — report no update rather than an error
    res.json({ updateAvailable: false, localHash, remoteHash: '' });
  }
});

/**
 * POST /api/update
 * Pulls the latest code, installs dependencies, and rebuilds the webapp.
 * The response is sent only after all steps complete (or fail). Typical
 * duration is 30–90 seconds; the client shows a spinner while waiting.
 */
app.post('/api/update', requireAuth, async (_req, res) => {
  console.log('[update] Starting update…');
  try {
    const opts = { cwd: ROOT_DIR };
    console.log('[update] git pull…');
    await execAsync('git pull --ff-only', opts);
    console.log('[update] npm install…');
    await execAsync('npm install', opts);
    console.log('[update] build:webapp…');
    await execAsync('npm run build:webapp', opts);
    // Refresh local hash so the check endpoint is accurate after update
    localHash = execSync('git rev-parse HEAD', { cwd: ROOT_DIR }).toString().trim();
    console.log(`[update] Done. Now at ${localHash.slice(0, 7)}`);
    res.json({ ok: true });
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    console.error('[update] Failed:', msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/restart
 * Responds immediately, then exits after a short delay.
 * PM2 (the process manager) detects the exit and restarts the server,
 * which picks up the freshly built webapp from webapp/dist.
 */
app.post('/api/restart', requireAuth, (_req, res) => {
  res.json({ ok: true });
  console.log('[update] Restarting via process.exit(0) — PM2 will restart.');
  setTimeout(() => process.exit(0), 200);
});

// ── Serve frontend (production build) ─────────────────────────────────────
if (fs.existsSync(WEBAPP_DIR)) {
  app.use(express.static(WEBAPP_DIR));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(WEBAPP_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('<p>Run <code>npm run build:webapp</code> first, or start Vite dev server.</p>');
  });
}

// ── Start server ──────────────────────────────────────────────────────────
// Use http.createServer directly (more reliable than app.listen in Express v5)
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use. Kill the other process first.`);
  } else {
    console.error('[server] Fatal error:', err);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel Map server running on http://localhost:${PORT}`);
  if (!process.env.APP_PASSWORD || process.env.APP_PASSWORD === 'changeme') {
    console.warn('[warn] Set APP_PASSWORD in .env before exposing to the internet!');
  }
});

// ── Catch any unhandled errors ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});
