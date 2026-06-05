/**
 * App.tsx — root component for the Travel Map config webapp.
 *
 * Auth flow:
 *   On mount, GET /api/me to verify the session cookie.
 *   A 5-second AbortController timeout guards against a hung server.
 *   Result: 'loading' → 'logged-in' (show main UI) or 'logged-out' (show LoginPage).
 *
 * Render pipeline:
 *   "Render & Download" POSTs the current props to /api/render (server/index.cjs).
 *   The server runs `remotion render` as a child process and streams the MP4 back
 *   as a blob. The browser triggers a file download via a temporary object URL.
 *
 * PreviewPlayer is lazy-loaded (React.lazy) because the Remotion bundle is large
 * (~2 MB) and a load failure should not crash the whole app — hence the ErrorBoundary.
 */
import React, { useState, useEffect, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import LoginPage from './LoginPage';
import PropsForm from './PropsForm';
import { Props, DEFAULT_PROPS } from './types';

// Lazy-load PreviewPlayer so a Remotion import failure can't kill the whole app
const PreviewPlayer = React.lazy(() => import('./PreviewPlayer'));

// ── Error boundary for the player ─────────────────────────────────────────
interface EBState { error: Error | null }
class PlayerErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PreviewPlayer] error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 16, borderRadius: 8, background: '#fef2f2',
          border: '1px solid #fecaca', color: '#dc2626', fontSize: 12,
          fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxWidth: 300,
        }}>
          Preview unavailable:{'\n'}
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Auth state ────────────────────────────────────────────────────────────
type AuthState = 'loading' | 'logged-out' | 'logged-in';

export default function App() {
  const [auth,      setAuth]      = useState<AuthState>('loading');
  const [props,     setProps]     = useState<Props>(DEFAULT_PROPS);
  const [gpxFiles,  setGpxFiles]  = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderErr, setRenderErr] = useState('');
  // Mobile tab switcher — only visible on screens ≤ 640px (controlled via CSS)
  const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('settings');

  // ── Check session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    fetch('/api/me', { signal: ctrl.signal })
      .then(r => {
        clearTimeout(timer);
        if (r.ok) { setAuth('logged-in'); fetchGpxFiles(); }
        else       { setAuth('logged-out'); }
      })
      .catch(() => { clearTimeout(timer); setAuth('logged-out'); });

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, []);

  async function fetchGpxFiles() {
    try {
      const r = await fetch('/api/gpx-files');
      if (r.ok) setGpxFiles(await r.json());
    } catch { /* ignore */ }
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    setAuth('logged-out');
  }

  async function handleRender() {
    setRendering(true);
    setRenderErr('');
    try {
      const res = await fetch('/api/render', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(props),
      });
      if (!res.ok) {
        setRenderErr((await res.text()) || `Render failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'travel-map.mp4';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setRenderErr(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRendering(false);
    }
  }

  // ── Auth states ─────────────────────────────────────────────────────────
  if (auth === 'loading') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                    height:'100vh', gap: 10, color: '#64748b', fontSize: 14 }}>
        <span className="spinner"
          style={{ borderTopColor:'#2563eb', borderColor:'#e2e8f0', width:20, height:20 }} />
        Connecting…
      </div>
    );
  }

  if (auth === 'logged-out') {
    return <LoginPage onLogin={() => { setAuth('logged-in'); fetchGpxFiles(); }} />;
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className={`layout${mobileTab === 'preview' ? ' layout--preview' : ''}`}>
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="header-row">
            <h1>Travel Map</h1>
            <button className="logout-btn" onClick={handleLogout}>Sign out</button>
          </div>
          <p>Configure and preview your animation</p>
        </div>

        <div className="sidebar-body">
          <PropsForm
            props={props}
            onChange={setProps}
            gpxFiles={gpxFiles}
            onUpload={fetchGpxFiles}
          />
        </div>

        <div className="sidebar-footer">
          <button
            className="btn btn-primary"
            onClick={handleRender}
            disabled={rendering}
          >
            {rendering
              ? <><span className="spinner" /> Rendering… (this takes a few minutes)</>
              : '⬇ Render & Download MP4'
            }
          </button>
          {renderErr && <div className="render-error">{renderErr}</div>}
          {!rendering && !renderErr && (
            <div className="render-info">
              Render time: ~2–5 min for a {props.duration}s animation
            </div>
          )}
        </div>
      </aside>

      {/* ── Preview panel ────────────────────────────────────────────── */}
      <main className="preview-panel">
        <div className="preview-label">Live Preview</div>
        {/* aspect-ratio is set inline so switching format updates the wrapper immediately */}
        <div className="preview-player-wrapper" style={{
          aspectRatio: props.outputFormat === 'landscape' ? '16/9'
                     : props.outputFormat === 'square'    ? '1/1'
                     : '9/16',
        }}>
          <PlayerErrorBoundary>
            <Suspense fallback={
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                            width:270, height:480, color:'#94a3b8', fontSize:13 }}>
                Loading preview…
              </div>
            }>
              <PreviewPlayer props={props} />
            </Suspense>
          </PlayerErrorBoundary>
        </div>
        <div style={{ fontSize:11, color:'var(--text-light)', textAlign:'center' }}>
          Preview uses your browser — no server needed
        </div>
      </main>

      {/* ── Mobile tab bar — hidden on desktop via CSS ───────────────── */}
      <nav className="mobile-tab-bar">
        <button
          className={`mobile-tab${mobileTab === 'settings' ? ' active' : ''}`}
          onClick={() => setMobileTab('settings')}
        >
          ⚙ Settings
        </button>
        <button
          className={`mobile-tab${mobileTab === 'preview' ? ' active' : ''}`}
          onClick={() => setMobileTab('preview')}
        >
          ▶ Preview
        </button>
      </nav>
    </div>
  );
}
