import React, { useState, useEffect } from 'react';
import LoginPage   from './LoginPage';
import PropsForm   from './PropsForm';
import PreviewPlayer from './PreviewPlayer';
import { Props, DEFAULT_PROPS } from './types';

type AuthState = 'loading' | 'logged-out' | 'logged-in';

export default function App() {
  const [auth,      setAuth]      = useState<AuthState>('loading');
  const [props,     setProps]     = useState<Props>(DEFAULT_PROPS);
  const [gpxFiles,  setGpxFiles]  = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderErr, setRenderErr] = useState('');

  // ── Check session on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/me')
      .then(r => {
        if (r.ok) {
          setAuth('logged-in');
          fetchGpxFiles();
        } else {
          setAuth('logged-out');
        }
      })
      .catch(() => setAuth('logged-out'));
  }, []);

  async function fetchGpxFiles() {
    try {
      const r = await fetch('/api/gpx-files');
      if (r.ok) {
        const files: string[] = await r.json();
        setGpxFiles(files);
      }
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
        const text = await res.text();
        setRenderErr(text || `Render failed (${res.status})`);
        return;
      }

      // Trigger download
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="spinner" style={{ borderTopColor: '#2563eb', borderColor: '#e2e8f0', width: 24, height: 24 }} />
      </div>
    );
  }

  if (auth === 'logged-out') {
    return <LoginPage onLogin={() => { setAuth('logged-in'); fetchGpxFiles(); }} />;
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="layout">
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
        <div className="preview-player-wrapper">
          <PreviewPlayer props={props} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center' }}>
          Preview uses your browser — no server needed
        </div>
      </main>
    </div>
  );
}
