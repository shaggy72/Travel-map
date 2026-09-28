/**
 * App.tsx — root component for the Travel Map config webapp.
 *
 * Layout (2026-09-27 "Color Stack" redesign, see CLAUDE.md / DESIGN.md):
 *   Sidebar — black brand bar + the settings bands (PropsForm.tsx: 1 Route,
 *   2 Labels, 3 Line, 4 Map) + band 5 Export (here, since it owns the render).
 *   Stage — top bar (PresetBar, update pill, AccountMenu), the big route title
 *   with the format list + duration next to the preview frame, and a ruler
 *   timeline (Timeline.tsx) that drives the Remotion Player's API.
 *   On narrow screens everything becomes one scrolling column
 *   (brand → preview → timeline → bands).
 *
 * Auth flow:
 *   On mount, GET /api/me to verify the session cookie.
 *   A 5-second AbortController timeout guards against a hung server.
 *   Result: 'loading' → 'logged-in' (show main UI) or 'logged-out' (show LoginPage).
 *
 * Render pipeline:
 *   "Export MP4" POSTs the current props to /api/render (server/index.cjs).
 *   The server runs `remotion render` as a child process and streams the MP4 back
 *   as a blob. The browser triggers a file download via a temporary object URL.
 *
 * PreviewPlayer is lazy-loaded (React.lazy) because the Remotion bundle is large
 * (~2 MB) and a load failure should not crash the whole app — hence the ErrorBoundary.
 */
import React, { useState, useEffect, useRef, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import type { PlayerRef } from '@remotion/player';
import LoginPage from './LoginPage';
import PropsForm from './PropsForm';
import PresetBar from './PresetBar';
import AccountMenu from './AccountMenu';
import Timeline from './Timeline';
import { ArrowIcon, MinusIcon, PlusIcon, RefreshIcon } from './icons';
import { Props, DEFAULT_PROPS } from './types';

// Lazy-load PreviewPlayer so a Remotion import failure can't kill the whole app
const PreviewPlayer = React.lazy(() => import('./PreviewPlayer'));

const FPS = 30; // mirrors src/mapData.ts — kept local so the main bundle doesn't pull in Remotion code

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
        <div className="preview-error">
          Preview unavailable:{'\n'}
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

const FORMATS: { value: Props['outputFormat']; ratio: string; desc: string; ar: number }[] = [
  { value: 'portrait',       ratio: '9:16', desc: 'Portrait · 1080×1920',       ar: 9 / 16 },
  { value: 'landscape',      ratio: '16:9', desc: 'Landscape · 1920×1080',      ar: 16 / 9 },
  { value: 'square',         ratio: '1:1',  desc: 'Square · 1080×1080',         ar: 1 },
  { value: 'instagram-post', ratio: '4:5',  desc: 'Instagram post · 1080×1350', ar: 4 / 5 },
];

const MODE_NOTE: Record<Props['travelMode'], string> = {
  driving: 'By car', cycling: 'By bike', walking: 'On foot', flight: 'By plane',
};

// ── Auth state ────────────────────────────────────────────────────────────
type AuthState = 'loading' | 'logged-out' | 'logged-in';

export default function App() {
  const [auth,      setAuth]      = useState<AuthState>('loading');
  const [props,     setProps]     = useState<Props>(DEFAULT_PROPS);
  const [gpxFiles,  setGpxFiles]  = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderErr, setRenderErr] = useState('');
  const [player,    setPlayer]    = useState<PlayerRef | null>(null);
  // Update banner — tracks the lifecycle of a server-side update
  type UpdateState = 'idle' | 'available' | 'updating' | 'restart-needed' | 'restarting';
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateErr,   setUpdateErr]   = useState('');
  const [userEmail,   setUserEmail]   = useState('');
  // True once the user's last session (or the "Start" preset) has been
  // applied — autosave waits for it so it never overwrites the stored session
  // with DEFAULT_PROPS.
  const [sessionReady, setSessionReady] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  // ── Sticky preview on phones (2026-09-28) ───────────────────────────────
  // On narrow screens the stage sits above the bands, so editing Line or Map
  // scrolled the preview out of view. Once the stage has scrolled up past
  // PIN_AT px, it switches to a compact bar fixed to the top (.stage--pinned:
  // small frame + timeline). Same element, only CSS changes, so the Remotion
  // Player isn't remounted. .stage-slot keeps the stage's full height while
  // it's pinned so the page doesn't jump.
  const stageRef = useRef<HTMLElement>(null);
  const slotRef  = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [slotH,  setSlotH]  = useState<number | null>(null);

  useEffect(() => {
    if (auth !== 'logged-in') return;
    const PIN_AT = 190; // ≈ height of the pinned bar
    const mq = window.matchMedia('(max-width: 760px)');
    let pinnedNow = false;
    let fullH = 0;
    const measure = () => {
      if (!pinnedNow && stageRef.current) fullH = stageRef.current.offsetHeight;
    };
    const update = () => {
      measure();
      const slot = slotRef.current;
      const should = mq.matches && !!slot && slot.getBoundingClientRect().top + fullH < PIN_AT;
      if (should === pinnedNow) return;
      pinnedNow = should;
      setSlotH(should ? fullH : null);
      setPinned(should);
    };
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    mq.addEventListener('change', update);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      mq.removeEventListener('change', update);
    };
  }, [auth]);

  // ── Check session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    fetch('/api/me', { signal: ctrl.signal })
      .then(async r => {
        clearTimeout(timer);
        if (r.ok) {
          const body = await r.json().catch(() => ({}));
          setUserEmail(body.email ?? '');
          await loadSession();
          setAuth('logged-in'); fetchGpxFiles(); checkForUpdate();
        } else {
          setAuth('logged-out');
        }
      })
      .catch(() => { clearTimeout(timer); setAuth('logged-out'); });

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, []);

  // ── Last session: restore on login, autosave while working ──────────────
  // GET /api/state returns the user's last settings, or — on their first
  // login — the owner's preset named "Start" (server/index.cjs).
  async function loadSession() {
    try {
      const r = await fetch('/api/state');
      if (r.ok) {
        const { props: saved } = await r.json();
        // Merge onto defaults: older saves may lack props added since.
        if (saved) setProps({ ...DEFAULT_PROPS, ...saved });
      }
    } catch { /* fall back to DEFAULT_PROPS */ }
    setSessionReady(true);
  }

  function saveSession(p: Props) {
    return fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ props: p }),
      keepalive: true,
    }).catch(() => { /* next change retries */ });
  }

  useEffect(() => {
    if (auth !== 'logged-in' || !sessionReady) return;
    const t = setTimeout(() => saveSession(props), 1000);
    return () => clearTimeout(t);
  }, [props, auth, sessionReady]);

  // Closing/reloading the tab within the debounce window would lose the last
  // change — send it with a beacon on the way out.
  useEffect(() => {
    if (auth !== 'logged-in' || !sessionReady) return;
    const onHide = () => navigator.sendBeacon('/api/state',
      new Blob([JSON.stringify({ props: propsRef.current })], { type: 'application/json' }));
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [auth, sessionReady]);

  async function fetchGpxFiles() {
    try {
      const r = await fetch('/api/gpx-files');
      if (r.ok) setGpxFiles(await r.json());
    } catch { /* ignore */ }
  }

  /** Called once after login / on mount. Hits the server which checks GitHub live. */
  async function checkForUpdate() {
    try {
      const r = await fetch('/api/update-check');
      if (r.ok) {
        const { updateAvailable } = await r.json();
        if (updateAvailable) setUpdateState('available');
      }
    } catch { /* server may be too old or offline — silently ignore */ }
  }

  /** Pull latest code, reinstall deps, rebuild webapp. */
  async function handleUpdate() {
    setUpdateState('updating');
    setUpdateErr('');
    try {
      const r = await fetch('/api/update', { method: 'POST' });
      if (r.ok) {
        setUpdateState('restart-needed');
      } else {
        const body = await r.json().catch(() => ({}));
        setUpdateErr(body.error ?? 'Update failed');
        setUpdateState('available');
      }
    } catch {
      setUpdateErr('Network error during update');
      setUpdateState('available');
    }
  }

  /**
   * Tell the server to exit (PM2 restarts it), then poll /api/me every 2 s
   * until the server is back up, then reload the page.
   *
   * NOTE: sessions are stored in-memory, so after restart /api/me returns 401
   * (session gone). Any HTTP response — even 401 — means the server is back up.
   * Only a network-level error (ECONNREFUSED) means it is still starting.
   */
  async function handleRestart() {
    setUpdateState('restarting');
    await fetch('/api/restart', { method: 'POST' }).catch(() => {});
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        await fetch('/api/me');
        window.location.reload();
        return;
      } catch { /* network error = server still starting, keep polling */ }
    }
    window.location.reload();
  }

  async function handleLogout() {
    await saveSession(propsRef.current); // don't lose changes still inside the autosave debounce
    await fetch('/api/logout', { method: 'POST' });
    setUserEmail('');
    setSessionReady(false);
    setAuth('logged-out');
  }

  /** Called by LoginPage after a successful sign-in — restores the session, fetches the email. */
  async function handleLoginSuccess() {
    await loadSession();
    setAuth('logged-in');
    fetchGpxFiles();
    checkForUpdate();
    try {
      const r = await fetch('/api/me');
      if (r.ok) setUserEmail((await r.json()).email ?? '');
    } catch { /* menu just shows nothing — not worth failing the login over */ }
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
      <div className="app-loading">
        <span className="spinner spinner--dark" />
        Connecting…
      </div>
    );
  }

  if (auth === 'logged-out') {
    return <LoginPage onLogin={handleLoginSuccess} />;
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  const format   = FORMATS.find(f => f.value === props.outputFormat) ?? FORMATS[0];
  const start    = props.startLabel || '…';
  const end      = props.endLabel   || '…';
  const longest  = Math.max(start.length, end.length + 2);
  const titleCls = longest <= 8 ? '' : longest <= 12 ? ' route-title--md' : ' route-title--sm';
  const modeNote = props.mode === 'gpx' ? 'GPS track' : MODE_NOTE[props.travelMode];
  const durationInFrames = Math.max(1, Math.round(props.duration * FPS));
  const setDuration = (v: number) => setProps(p => ({ ...p, duration: Math.max(1, Math.min(60, Math.round(v) || 1)) }));

  return (
    <div className="app">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar" aria-label="Settings">
        <div className="brand-bar">
          <span className="wordmark">Travel Map</span>
          <span className="brand-sub">Map animation studio</span>
        </div>

        <div className="sidebar-scroll">
          <PropsForm props={props} onChange={setProps} gpxFiles={gpxFiles} onUpload={fetchGpxFiles} />

          <section className="band band--export">
            <div className="band-head band-head--static">
              <span className="band-num">5</span>
              <span className="band-title">Export</span>
            </div>
            <div className="export-row">
              <span className="export-note">Full-HD MP4, rendered<br />on the server · ~2–5 min</span>
              <button type="button" className="export-btn" onClick={handleRender} disabled={rendering}>
                {rendering
                  ? <><span className="spinner" /> Rendering…</>
                  : <>Export MP4<span className="export-btn-arrow"><ArrowIcon size={16} /></span></>}
              </button>
            </div>
            {rendering && <p className="export-status" role="status">This takes a few minutes — keep this tab open.</p>}
            {renderErr && <p className="export-status export-status--error" role="alert">{renderErr}</p>}
          </section>
        </div>
      </aside>

      {/* ── Stage ────────────────────────────────────────────────────── */}
      <div className="stage-slot" ref={slotRef} style={slotH ? { height: slotH } : undefined}>
      <main ref={stageRef} className={`stage${pinned ? ' stage--pinned' : ''}`}>
        <div className="stage-top">
          <PresetBar props={props} onChange={setProps} />

          {updateState !== 'idle' && (
            <div className="update-pill" role="status">
              {updateState === 'available' && (<>
                <RefreshIcon size={15} /> Update available
                <button type="button" onClick={handleUpdate} disabled={rendering}>Install</button>
              </>)}
              {updateState === 'updating' && <><span className="spinner spinner--dark" /> Installing update…</>}
              {updateState === 'restart-needed' && (<>
                Updated
                <button type="button" onClick={handleRestart}>Restart now</button>
              </>)}
              {updateState === 'restarting' && <><span className="spinner spinner--dark" /> Restarting…</>}
              {updateErr && <span className="update-err">{updateErr}</span>}
            </div>
          )}

          <AccountMenu email={userEmail} onLogout={handleLogout} />
        </div>

        <div className="stage-body">
          <div className="stage-info">
            <span className="tag">Live preview</span>
            <h1 className={`route-title${titleCls}`}>{start}<br />→ {end}*</h1>
            <p className="route-note">* {modeNote} · {format.ratio} · {props.duration} seconds</p>

            <div className="format-list" role="group" aria-label="Video format">
              {FORMATS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  className="format-row"
                  aria-pressed={f.value === props.outputFormat}
                  onClick={() => setProps(p => ({ ...p, outputFormat: f.value }))}
                >
                  <span className="format-ratio">{f.ratio}</span>
                  <span className="format-desc">{f.desc}</span>
                  <span className="format-go"><ArrowIcon size={14} /></span>
                </button>
              ))}
            </div>

            <div className="duration">
              <label htmlFor="duration-input" className="duration-label">Duration</label>
              <div className="duration-control">
                <button type="button" className="round-btn round-btn--outline" aria-label="Shorter"
                  onClick={() => setDuration(props.duration - 1)} disabled={props.duration <= 1}>
                  <MinusIcon size={14} />
                </button>
                <span className="duration-value">
                  <input id="duration-input" type="number" min={1} max={60} value={props.duration}
                    onChange={e => setDuration(Number(e.target.value))} />
                  <span>s</span>
                </span>
                <button type="button" className="round-btn round-btn--dark" aria-label="Longer"
                  onClick={() => setDuration(props.duration + 1)} disabled={props.duration >= 60}>
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="stage-frame-area">
            {/* .frame-fit is a size container: the frame takes the largest
                size of the chosen aspect ratio that fits (see styles.css). */}
            <div className="frame-fit">
              <div className="preview-frame" style={{ '--ar': format.ar } as React.CSSProperties}>
                <PlayerErrorBoundary>
                  <Suspense fallback={<div className="preview-loading">Loading preview…</div>}>
                    <PreviewPlayer props={props} onReady={setPlayer} />
                  </Suspense>
                </PlayerErrorBoundary>
              </div>
            </div>
          </div>
        </div>

        <div className="stage-bottom">
          <Timeline player={player} durationInFrames={durationInFrames} fps={FPS} />
          <p className="stage-hint">Preview runs in your browser<br />Export renders full HD on the server</p>
        </div>
      </main>
      </div>
    </div>
  );
}
