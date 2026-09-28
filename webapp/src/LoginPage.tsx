import React, { useState, useEffect, FormEvent } from 'react';
import { ArrowIcon } from './icons';

interface Props {
  onLogin: () => void;
}

// Sign-in only. The "Create account" link and registration form were removed
// from the UI 2026-09-28 (user request); POST /api/register still exists on the
// server (server/auth.cjs) — see CLAUDE.md "Authentication".

// Reads the ?verify=ok|invalid|expired|missing param left by GET /api/verify-email's
// redirect (server/auth.cjs) and turns it into a one-time banner, then strips the
// param from the URL so a refresh doesn't show it again. Kept for confirmation
// links that were already sent.
function useVerifyBanner(): { text: string; kind: 'ok' | 'error' } | null {
  const [banner] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const verify = params.get('verify');
    if (!verify) return null;
    const map: Record<string, { text: string; kind: 'ok' | 'error' }> = {
      ok:      { text: 'Email confirmed — you can now log in.', kind: 'ok' },
      invalid: { text: 'That confirmation link is invalid or already used.', kind: 'error' },
      expired: { text: 'That confirmation link has expired.', kind: 'error' },
      missing: { text: 'That confirmation link is missing its token.', kind: 'error' },
    };
    return map[verify] ?? null;
  });

  useEffect(() => {
    if (!banner) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('verify');
    window.history.replaceState({}, '', url.toString());
  }, [banner]);

  return banner;
}

export default function LoginPage({ onLogin }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const verifyBanner = useVerifyBanner();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      if (res.ok) {
        onLogin();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Invalid email or password.');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login-bands" aria-hidden="true">
        {LOGIN_BANDS.map(([id, w1, w2], i) => (
          <div key={id} className={`login-band band--${id}`}>
            <span className="band-num">{i + 1}</span>
            <span className="login-words">{w1}<br />{w2}</span>
          </div>
        ))}
      </div>

      <div className="login-side">
        <span className="wordmark wordmark--ink">Travel Map</span>
        <div className="login-center">
          <div className="login-form-wrap">
            <h1 className="login-title">Sign in</h1>
            <p className="login-sub">Turn any route into a map animation — your presets are waiting.</p>

            {verifyBanner && (
              <div className={`login-banner login-banner--${verifyBanner.kind}`} role="status">{verifyBanner.text}</div>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}

            <form className="login-form" onSubmit={handleLogin}>
              <label className="stack-field">
                <span>Email</span>
                <input className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  autoFocus autoComplete="email" required />
              </label>
              <label className="stack-field">
                <span>Password</span>
                <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required />
              </label>
              <button type="submit" className="login-submit" disabled={loading}>
                {loading
                  ? <><span className="spinner" /> Signing in…</>
                  : <>Sign in<span className="login-submit-arrow"><ArrowIcon size={18} /></span></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const LOGIN_BANDS: [string, string, string][] = [
  ['route',  'Route',  'Plan it'],
  ['labels', 'Labels', 'Name it'],
  ['line',   'Line',   'Draw it'],
  ['map',    'Map',    'Style it'],
  ['export', 'Export', 'Share it'],
];
