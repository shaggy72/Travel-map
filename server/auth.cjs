'use strict';

/**
 * auth.cjs — email + password authentication, self-registration with email
 * confirmation, and password change. Same core pattern as costa-rica-trip's
 * server/auth.js (bcrypt + a users.json store + express-rate-limit + Resend
 * for the confirmation email), adapted to Travel Map's simpler single-role
 * model (no admin/participant/supporter distinction — every account is
 * equal) and its existing lightweight in-memory session store (kept as-is,
 * just now keyed by email instead of being a single shared account).
 *
 * Added 2026-09-26 per user request, replacing the old single shared
 * APP_USERNAME/APP_PASSWORD account. See CLAUDE.md for the full rationale,
 * including the presets-per-user migration this implies.
 */

const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');

const BCRYPT_ROUNDS = 12;
const SESSION_COOKIE = 'travel_map_sid';
const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — unchanged from the old single-account session
const VERIFICATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h — same as costa-rica-trip

function initAuth(dataDir) {
  const USERS_FILE = path.join(dataDir, 'users.json');

  function loadUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch { return []; }
  }
  function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }
  function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
  function isValidEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  // ── Session store (token → { email, createdAt }) ──────────────────────
  // Same in-memory Map the old single-account version used — sessions don't
  // survive a server restart, which is an accepted tradeoff (users just log
  // in again), documented in CLAUDE.md's "Restart button" entry.
  const activeSessions = new Map();

  function createSession(email) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, { email, createdAt: Date.now() });
    return token;
  }
  function destroySession(token) {
    activeSessions.delete(token);
  }
  function getSession(token) {
    if (!token || !activeSessions.has(token)) return null;
    const entry = activeSessions.get(token);
    if (Date.now() - entry.createdAt > SESSION_MAX_MS) {
      activeSessions.delete(token);
      return null;
    }
    return entry;
  }
  function getSessionToken(req) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k.trim() === SESSION_COOKIE) return decodeURIComponent((v || '').trim());
    }
    return null;
  }
  function setSessionCookie(res, token) {
    const maxAge = Math.round(SESSION_MAX_MS / 1000);
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`
    );
  }
  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`
    );
  }

  /** Attaches req.user ({ email }) on success — presets/gpx routes key off this. */
  function requireAuth(req, res, next) {
    const session = getSession(getSessionToken(req));
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const user = loadUsers().find(u => u.email === session.email);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  }

  // process.env read lazily (not at module load) — dotenv runs in index.cjs
  // before routes are registered, but ESM/CJS load order is fragile enough
  // elsewhere in this codebase (see the dotenv quiet-mode comment) that it's
  // safer to always read it fresh here too.
  function getResend() {
    return new Resend(process.env.RESEND_API_KEY);
  }
  function appUrl() {
    return process.env.APP_URL || `http://localhost:${process.env.PORT || 3002}`;
  }

  function verificationMailHtml(link) {
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#F6F0E4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2B2620;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#fff;border-radius:20px;overflow:hidden;">
<tr><td style="background:#DD6B3B;padding:22px 26px;"><div style="font-size:20px;font-weight:800;color:#fff;">Travel Map</div></td></tr>
<tr><td style="padding:26px;font-size:15px;line-height:1.55;">
<p style="margin:0 0 16px;">Welcome! Confirm your email address to activate your account. This link is valid for 48 hours.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#DD6B3B;border-radius:10px;"><a href="${link}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">Confirm email address</a></td></tr></table>
<p style="margin:18px 0 0;font-size:12px;color:#726c5d;word-break:break-all;">Button not working? Copy this link into your browser:<br>${link}</p>
</td></tr></table></td></tr></table></body></html>`;
  }

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in a few minutes.' },
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 5,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many registration attempts. Try again later.' },
  });

  function registerAuthRoutes(app) {
    app.get('/api/me', requireAuth, (req, res) => {
      res.json({ ok: true, email: req.user.email });
    });

    app.post('/api/login', loginLimiter, async (req, res) => {
      const email = (req.body?.email ?? '').toLowerCase().trim();
      const password = req.body?.password ?? '';
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

      const users = loadUsers();
      const user = users.find(u => u.email.toLowerCase() === email);
      if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!user.verified) {
        return res.status(403).json({ error: 'Please confirm your email first — check your inbox' });
      }

      const token = createSession(user.email);
      setSessionCookie(res, token);
      res.json({ ok: true, email: user.email });
    });

    app.post('/api/logout', (req, res) => {
      const token = getSessionToken(req);
      if (token) destroySession(token);
      clearSessionCookie(res);
      res.json({ ok: true });
    });

    // Anyone can register — no approval step, just email confirmation.
    app.post('/api/register', registerLimiter, async (req, res) => {
      const email = (req.body?.email ?? '').toLowerCase().trim();
      const password = req.body?.password ?? '';
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      const users = loadUsers();
      if (users.some(u => u.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'This email is already registered' });
      }

      // Token stored only as a hash — same reasoning as costa-rica-trip: whoever
      // reads users.json (e.g. in a backup) can't derive a working confirmation link.
      const token = crypto.randomBytes(32).toString('hex');
      const user = {
        id: crypto.randomBytes(8).toString('hex'),
        email,
        passwordHash: await hashPassword(password),
        verified: false,
        verificationTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        verificationTokenExpiry: Date.now() + VERIFICATION_TOKEN_TTL_MS,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveUsers(users);

      const link = `${appUrl()}/api/verify-email?token=${token}`;
      try {
        const { error } = await getResend().emails.send({
          from: 'Travel Map <travelmap@luyens.be>',
          to: user.email,
          subject: 'Confirm your email for Travel Map',
          html: verificationMailHtml(link),
          text: `Welcome! Confirm your email address via this link (valid 48h):\n\n${link}`,
        });
        if (error) throw new Error(error.message);
      } catch (err) {
        console.error('[auth] Verification email failed:', err.message);
        // Account already saved — don't roll it back, just report the mail
        // failure. The user can retry registration once Resend is reachable
        // (the email-already-registered check above would then need a resend
        // path, but that's a deliberate scope cut — see CLAUDE.md).
        return res.status(500).json({ error: 'Account created, but the confirmation email could not be sent. Please try again later.' });
      }

      res.status(201).json({ ok: true });
    });

    // Confirmation link target — not an API call from the SPA, a direct browser
    // navigation from the email. Redirects back into the SPA with a query flag
    // it can react to (see LoginPage.tsx).
    app.get('/api/verify-email', (req, res) => {
      const token = req.query?.token;
      if (typeof token !== 'string' || !token) return res.redirect('/?verify=missing');

      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const users = loadUsers();
      const user = users.find(u => u.verificationTokenHash === hash);
      if (!user) return res.redirect('/?verify=invalid');
      if (user.verificationTokenExpiry < Date.now()) return res.redirect('/?verify=expired');

      user.verified = true;
      delete user.verificationTokenHash;
      delete user.verificationTokenExpiry;
      saveUsers(users);

      res.redirect('/?verify=ok');
    });

    app.post('/api/change-password', requireAuth, async (req, res) => {
      const currentPassword = req.body?.currentPassword ?? '';
      const newPassword = req.body?.newPassword ?? '';
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      const users = loadUsers();
      const user = users.find(u => u.email === req.user.email);
      if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      user.passwordHash = await hashPassword(newPassword);
      saveUsers(users);
      res.json({ ok: true });
    });
  }

  return { requireAuth, registerAuthRoutes, loadUsers, saveUsers };
}

module.exports = { initAuth };
