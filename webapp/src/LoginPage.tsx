import React, { useState, useEffect, FormEvent } from 'react';
import { ArrowIcon } from './icons';

interface Props {
  onLogin: () => void;
}

type Mode = 'login' | 'register' | 'registered';

// Reads the ?verify=ok|invalid|expired|missing param left by GET /api/verify-email's
// redirect (server/auth.cjs) and turns it into a one-time banner, then strips the
// param from the URL so a refresh doesn't show it again.
function useVerifyBanner(): { text: string; kind: 'ok' | 'error' } | null {
  const [banner] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const verify = params.get('verify');
    if (!verify) return null;
    const map: Record<string, { text: string; kind: 'ok' | 'error' }> = {
      ok:      { text: 'Email confirmed — you can now log in.', kind: 'ok' },
      invalid: { text: 'That confirmation link is invalid or already used.', kind: 'error' },
      expired: { text: 'That confirmation link has expired. Register again to get a new one.', kind: 'error' },
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
  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const verifyBanner = useVerifyBanner();

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  }

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

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setMode('registered');
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Registration failed.');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = (text: string, busy: string) => loading
    ? <><span className="spinner" /> {busy}</>
    : <>{text}<span className="login-submit-arrow"><ArrowIcon size={18} /></span></>;

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
            <h1 className="login-title">
              {mode === 'login' && 'Sign in'}
              {mode === 'register' && 'Create account'}
              {mode === 'registered' && 'Check your inbox'}
            </h1>
            <p className="login-sub">
              {mode === 'login'      && 'Turn any route into a map animation — your presets are waiting.'}
              {mode === 'register'   && 'Anyone can sign up. We’ll email you a link to confirm your address.'}
              {mode === 'registered' && <>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back here and sign in.</>}
            </p>

            {verifyBanner && (
              <div className={`login-banner login-banner--${verifyBanner.kind}`} role="status">{verifyBanner.text}</div>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}

            {mode === 'registered' && (
              <button type="button" className="login-submit" onClick={() => switchMode('login')}>
                Back to sign in<span className="login-submit-arrow"><ArrowIcon size={18} /></span>
              </button>
            )}

            {mode === 'login' && (
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
                  {submitLabel('Sign in', 'Signing in…')}
                </button>
                <p className="login-switch">
                  No account yet? <button type="button" onClick={() => switchMode('register')}>Create one</button>
                </p>
              </form>
            )}

            {mode === 'register' && (
              <form className="login-form" onSubmit={handleRegister}>
                <label className="stack-field">
                  <span>Email</span>
                  <input className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    autoFocus autoComplete="email" required />
                </label>
                <label className="stack-field">
                  <span>Password</span>
                  <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password" minLength={6} required />
                </label>
                <label className="stack-field">
                  <span>Confirm password</span>
                  <input className="login-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password" minLength={6} required />
                </label>
                <button type="submit" className="login-submit" disabled={loading}>
                  {submitLabel('Create account', 'Creating account…')}
                </button>
                <p className="login-switch">
                  Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button>
                </p>
              </form>
            )}
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
