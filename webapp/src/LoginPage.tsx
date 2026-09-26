import React, { useState, useEffect, FormEvent } from 'react';

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

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Travel Map</h1>
        <p className="subtitle">
          {mode === 'login'      && 'Sign in to configure and render your map animation.'}
          {mode === 'register'   && 'Create an account — anyone can sign up.'}
          {mode === 'registered' && 'Almost there!'}
        </p>

        {verifyBanner && (
          <div className={`login-banner login-banner--${verifyBanner.kind}`}>{verifyBanner.text}</div>
        )}
        {error && <div className="login-error">{error}</div>}

        {mode === 'registered' && (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              account, then come back here and log in.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          </>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
            </button>
            <button
              type="button"
              className="login-switch"
              onClick={() => switchMode('register')}
            >
              No account yet? Create one
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="login-field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Creating account…</> : 'Create account'}
            </button>
            <button
              type="button"
              className="login-switch"
              onClick={() => switchMode('login')}
            >
              Already have an account? Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
