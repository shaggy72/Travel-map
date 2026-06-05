/**
 * PropsForm.tsx — sidebar form that exposes all animation props for editing.
 *
 * Key patterns used throughout this file:
 *
 *  upd(key, value)
 *    Shorthand for onChange({ ...props, [key]: value }). Every control calls
 *    this to produce a new Props object and bubble it up to App.tsx.
 *
 *  Custom ls-picker dropdowns (not native <select>)
 *    Native selects can't be styled consistently across browsers. All dropdowns
 *    use the ls-picker pattern: a button trigger + absolutely positioned panel
 *    with keyboard/click-outside dismiss. See MapStylePicker for a reference impl.
 *
 *  CITY_STEPS discrete slider
 *    City label density uses a fixed set of population thresholds
 *    (10k / 50k / 100k / 500k / 1M / 2M / off) rather than a continuous range,
 *    because intermediate values produce the same visual result and the steps map
 *    to meaningful city tiers (town / large town / city / major city / etc.).
 *
 *  Collapsible sections
 *    Each .form-section has a <button className="section-title"> toggle. A Set of
 *    closed section IDs is stored in state. The section body uses a CSS grid-rows
 *    transition (0fr ↔ 1fr) for a smooth open/close animation without needing to
 *    know the content height. Default open: Mode, Route, Track line.
 *    Default closed: Map, Route labels, Animation, City labels.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Props } from './types';
import { ColorPicker } from './ColorPicker';

interface PropsFormProps {
  props:      Props;
  onChange:   (p: Props) => void;
  gpxFiles:   string[];
  onUpload:   () => void;  // called after a successful GPX upload
}

// ── Helpers ───────────────────────────────────────────────────────────────

function set<K extends keyof Props>(props: Props, key: K, value: Props[K]): Props {
  return { ...props, [key]: value };
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-row">
        <ColorPicker value={value} onChange={onChange} />
        <span className="color-hex">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

interface RangeFieldProps {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step?:    number;
  unit?:    string;
  onChange: (v: number) => void;
}

function RangeField({ label, value, min, max, step = 1, unit: _unit = '', onChange }: RangeFieldProps) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ '--range-fill': `${pct}%` } as React.CSSProperties}
          onChange={e => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

// ── City Slider ───────────────────────────────────────────────────────────

// Discrete population thresholds. Value 0 = "no cities" sentinel.
const CITY_STEPS = [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000, 0] as const;

function SmallCityIcon() {
  return (
    <svg viewBox="0 0 10 12" width="10" height="12" fill="currentColor" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
      <rect x="3" y="3" width="4" height="9" />
      <rect x="0" y="6" width="3" height="6" />
      <rect x="7" y="6" width="3" height="6" />
    </svg>
  );
}

function LargeCityIcon() {
  return (
    <svg viewBox="0 0 14 16" width="14" height="16" fill="currentColor" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
      <rect x="5" y="0" width="4" height="16" />
      <rect x="0" y="5" width="5" height="11" />
      <rect x="9" y="5" width="5" height="11" />
    </svg>
  );
}

function CitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Map stored value → slider index (find exact match, else closest)
  const index = (() => {
    const exact = CITY_STEPS.indexOf(value as typeof CITY_STEPS[number]);
    if (exact !== -1) return exact;
    // Fallback: pick closest non-zero step
    const steps = CITY_STEPS.slice(0, -1);
    return steps.reduce((best, s, i) =>
      Math.abs(s - value) < Math.abs(steps[best] - value) ? i : best, 0);
  })();

  const pct = Math.round((index / (CITY_STEPS.length - 1)) * 100);

  return (
    <div className="city-slider-row">
      <input
        type="range"
        min={0}
        max={CITY_STEPS.length - 1}
        step={1}
        value={index}
        style={{ '--range-fill': `${pct}%` } as React.CSSProperties}
        onChange={e => onChange(CITY_STEPS[Number(e.target.value)])}
      />
    </div>
  );
}

// ── Travel Mode Icons (Material Symbols) ─────────────────────────────────

function CarIcon()    { return <span className="material-symbols-outlined">directions_car</span>;  }
function BikeIcon()   { return <span className="material-symbols-outlined">directions_bike</span>; }
function WalkIcon()   { return <span className="material-symbols-outlined">directions_walk</span>; }
function FlightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>
  );
}

// ── Map Style Picker ──────────────────────────────────────────────────────

const MAP_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'shaggy72/cmpma5agg000101qr4tt68gad', label: 'Gray' },
  { value: 'mapbox/streets-v12',                 label: 'Streets' },
  { value: 'mapbox/outdoors-v12',                label: 'Outdoors' },
  { value: 'mapbox/light-v11',                   label: 'Light' },
  { value: 'mapbox/dark-v11',                    label: 'Dark' },
  { value: 'mapbox/satellite-streets-v12',        label: 'Satellite' },
  { value: 'none',                               label: 'No map' },
];

function MapStylePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,     setOpen]     = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  function openPanel() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left - 8, width: 160 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const current = MAP_STYLE_OPTIONS.find(o => o.value === value) ?? MAP_STYLE_OPTIONS[0];

  return (
    <div className="ls-picker">
      <button
        ref={triggerRef}
        className="ls-trigger"
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        <span className="ls-label">{current.label}</span>
        <span className="ls-arrow">▾</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="ls-panel"
          style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
        >
          {MAP_STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ls-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Line Style Picker ─────────────────────────────────────────────────────

type LineStyleValue = Props['lineStyle'];

const LINE_STYLE_OPTIONS: { value: LineStyleValue; label: string }[] = [
  { value: 'solid',     label: 'Solid' },
  { value: 'dashed',    label: 'Dashed' },
  { value: 'dotted',    label: 'Dotted' },
  { value: 'long-dash', label: 'Long dash' },
  { value: 'dash-dot',  label: 'Dash-dot' },
  { value: 'pencil',    label: 'Pencil' },
];

const DASH_ARRAYS: Partial<Record<LineStyleValue, string>> = {
  dashed:      '8 4',
  dotted:      '2 5',
  'long-dash': '16 5',
  'dash-dot':  '10 4 2 4',
};

function LinePreview({ value, color }: { value: LineStyleValue; color: string }) {
  if (value === 'pencil') {
    return (
      <svg width="44" height="10" viewBox="0 0 44 10" style={{ flexShrink: 0 }}>
        <path d="M2,5 C6,3 11,7 16,5 C21,3 26,7 31,5 C36,3 40,7 42,5"
          stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  const da = DASH_ARRAYS[value];
  return (
    <svg width="44" height="10" viewBox="0 0 44 10" style={{ flexShrink: 0 }}>
      <line x1="2" y1="5" x2="42" y2="5"
        stroke={color} strokeWidth="2"
        strokeLinecap={value === 'dotted' ? 'round' : 'butt'}
        {...(da ? { strokeDasharray: da } : {})} />
    </svg>
  );
}

interface LineStylePickerProps {
  value: LineStyleValue;
  lineColor: string;
  onChange: (v: LineStyleValue) => void;
}

function LineStylePicker({ value, lineColor, onChange }: LineStylePickerProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  function openPanel() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left - 8, width: 160 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const current = LINE_STYLE_OPTIONS.find(o => o.value === value) ?? LINE_STYLE_OPTIONS[0];

  return (
    <div className="ls-picker">
      <button
        ref={triggerRef}
        className="ls-trigger"
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        <LinePreview value={current.value} color={lineColor} />
        <span className="ls-label">{current.label}</span>
        <span className="ls-arrow">▾</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="ls-panel"
          style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
        >
          {LINE_STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ls-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <LinePreview value={opt.value} color={opt.value === value ? lineColor : '#8c7e6e'} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Label Mode Picker ─────────────────────────────────────────────────────

const LABEL_MODE_OPTIONS: { value: Props['labelMode']; label: string }[] = [
  { value: 'animated', label: 'Animated' },
  { value: 'on',       label: 'On' },
  { value: 'off',      label: 'Off' },
];

function LabelModePicker({ value, onChange }: { value: Props['labelMode']; onChange: (v: Props['labelMode']) => void }) {
  const [open,     setOpen]     = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  function openPanel() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left - 8, width: 160 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const current = LABEL_MODE_OPTIONS.find(o => o.value === value) ?? LABEL_MODE_OPTIONS[0];

  return (
    <div className="ls-picker">
      <button
        ref={triggerRef}
        className="ls-trigger"
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        <span className="ls-label">{current.label}</span>
        <span className="ls-arrow">▾</span>
      </button>
      {open && (
        <div ref={panelRef} className="ls-panel" style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}>
          {LABEL_MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ls-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Label Animation Picker ────────────────────────────────────────────────

const LABEL_ANIM_OPTIONS: { value: string; label: string }[] = [
  { value: 'left-to-right', label: 'Left → right' },
  { value: 'right-to-left', label: 'Right → left' },
  { value: 'fade',          label: 'Fade in' },
  { value: 'scale',         label: 'Scale in' },
  { value: 'slide-up',      label: 'Slide up' },
  { value: 'typewriter',    label: 'Typewriter' },
  { value: 'wipe-from-dot', label: 'Wipe from dot' },
];

function LabelAnimationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,     setOpen]     = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  function openPanel() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left - 8, width: 160 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const current = LABEL_ANIM_OPTIONS.find(o => o.value === value) ?? LABEL_ANIM_OPTIONS[0];

  return (
    <div className="ls-picker">
      <button
        ref={triggerRef}
        className="ls-trigger"
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        <span className="ls-label">{current.label}</span>
        <span className="ls-arrow">▾</span>
      </button>
      {open && (
        <div ref={panelRef} className="ls-panel" style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}>
          {LABEL_ANIM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ls-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Font Picker ───────────────────────────────────────────────────────────

const FONT_OPTIONS: { value: string; label: string; family: string }[] = [
  { value: 'Helvetica',    label: 'Helvetica',    family: "'Helvetica Neue', Arial, sans-serif" },
  { value: 'Inter',        label: 'Inter',        family: "Inter, 'Segoe UI', sans-serif" },
  { value: 'Georgia',      label: 'Georgia',      family: "Georgia, serif" },
  { value: 'Oswald',       label: 'Oswald',       family: "Oswald, sans-serif" },
  { value: 'Merriweather', label: 'Merriweather', family: "'Merriweather', Georgia, serif" },
];

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,     setOpen]     = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  function openPanel() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left - 8 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const current = FONT_OPTIONS.find(o => o.value === value) ?? FONT_OPTIONS[0];

  return (
    <div className="ls-picker">
      <button
        ref={triggerRef}
        className="ls-trigger"
        onClick={() => open ? setOpen(false) : openPanel()}
      >
        <span className="ls-font-preview" style={{ fontFamily: current.family }}>{current.label}</span>
        <span className="ls-arrow">▾</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="ls-panel"
          style={{ top: panelPos.top, left: panelPos.left, width: 160 }}
        >
          {FONT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ls-option${opt.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span style={{ fontFamily: opt.family, fontSize: 12, lineHeight: 1 }}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PropsForm({ props, onChange, gpxFiles, onUpload }: PropsFormProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [uploadMsg,    setUploadMsg]    = useState('');

  // ── Collapsible sections ─────────────────────────────────────────────────
  // Sections NOT in this set are open. Mode / Route / Track line start open.
  // Map, Route labels, Animation, City labels start collapsed.
  const [closed, setClosed] = useState<Set<string>>(
    () => new Set(['map', 'routeLabels', 'animation', 'cityLabels'])
  );
  /** Toggle a section open/closed by its ID. */
  const toggle = (id: string) =>
    setClosed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  /** Returns true when the section with the given ID is expanded. */
  const isOpen = (id: string) => !closed.has(id);

  function upd<K extends keyof Props>(key: K, value: Props[K]) {
    onChange(set(props, key, value));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.gpx')) {
      setUploadStatus('error');
      setUploadMsg('Only .gpx files are supported.');
      return;
    }
    setUploadStatus('idle');
    setUploadMsg('Uploading…');
    const form = new FormData();
    form.append('gpxFile', file);
    try {
      const res = await fetch('/api/upload-gpx', { method: 'POST', body: form });
      if (res.ok) {
        setUploadStatus('ok');
        setUploadMsg(`✓ ${file.name} uploaded`);
        onUpload();
        // Auto-select the uploaded file and switch to GPX mode
        onChange({ ...props, mode: 'gpx', gpxFile: file.name });
      } else {
        const text = await res.text();
        setUploadStatus('error');
        setUploadMsg(text || 'Upload failed.');
      }
    } catch {
      setUploadStatus('error');
      setUploadMsg('Network error during upload.');
    }
    // Reset file input
    e.target.value = '';
  }

  return (
    <div>

      {/* ── Mode ─────────────────────────────────────────────────── */}
      <div className="form-section">
        <button className="section-title" onClick={() => toggle('mode')} aria-expanded={isOpen('mode')}>
          <span className={`section-chevron${isOpen('mode') ? ' open' : ''}`} aria-hidden="true">▾</span>
          Mode
        </button>
        <div className={`section-body${isOpen('mode') ? ' section-body--open' : ''}`}>
          <div className="section-body-inner">
            <div className="field">
              <div className="radio-group">
                <input
                  type="radio" id="mode-dir" name="mode"
                  checked={props.mode === 'directions'}
                  onChange={() => upd('mode', 'directions')}
                />
                <label htmlFor="mode-dir">Directions</label>
                <input
                  type="radio" id="mode-gpx" name="mode"
                  checked={props.mode === 'gpx'}
                  onChange={() => {
                    // Auto-select first available GPX file if none chosen yet
                    const gpxFile = props.gpxFile || (gpxFiles[0] ?? '');
                    onChange({ ...props, mode: 'gpx', gpxFile });
                  }}
                />
                <label htmlFor="mode-gpx">GPX track</label>
              </div>
            </div>

            {/* ── Travel mode (Directions only) ────────────────────── */}
            {props.mode === 'directions' && (
              <div className="field">
                <label>Travel</label>
                <div className="radio-group travel-mode-group">
                  <input type="radio" id="travel-driving" name="travelMode"
                    checked={props.travelMode === 'driving'}
                    onChange={() => upd('travelMode', 'driving')}
                  />
                  <label htmlFor="travel-driving" title="Car"><CarIcon /></label>

                  <input type="radio" id="travel-cycling" name="travelMode"
                    checked={props.travelMode === 'cycling'}
                    onChange={() => upd('travelMode', 'cycling')}
                  />
                  <label htmlFor="travel-cycling" title="Bike"><BikeIcon /></label>

                  <input type="radio" id="travel-walking" name="travelMode"
                    checked={props.travelMode === 'walking'}
                    onChange={() => upd('travelMode', 'walking')}
                  />
                  <label htmlFor="travel-walking" title="Walk"><WalkIcon /></label>

                  <input type="radio" id="travel-flight" name="travelMode"
                    checked={props.travelMode === 'flight'}
                    onChange={() => upd('travelMode', 'flight')}
                  />
                  <label htmlFor="travel-flight" title="Flight"><FlightIcon /></label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Route (Directions mode) ───────────────────────────────── */}
      {props.mode === 'directions' && (
        <div className="form-section">
          <button className="section-title" onClick={() => toggle('route')} aria-expanded={isOpen('route')}>
            <span className={`section-chevron${isOpen('route') ? ' open' : ''}`} aria-hidden="true">▾</span>
            Route
          </button>
          <div className={`section-body${isOpen('route') ? ' section-body--open' : ''}`}>
            <div className="section-body-inner">
              <div className="field">
                <label>Start address</label>
                <input
                  type="text"
                  value={props.startAddress}
                  onChange={e => upd('startAddress', e.target.value)}
                  placeholder="e.g. Ghent, Belgium"
                />
              </div>
              <div className="field">
                <label>Start label</label>
                <input
                  type="text"
                  value={props.startLabel}
                  onChange={e => upd('startLabel', e.target.value)}
                />
              </div>
              <div className="field">
                <label>End address</label>
                <input
                  type="text"
                  value={props.endAddress}
                  onChange={e => upd('endAddress', e.target.value)}
                  placeholder="e.g. Paris, France"
                />
              </div>
              <div className="field">
                <label>End label</label>
                <input
                  type="text"
                  value={props.endLabel}
                  onChange={e => upd('endLabel', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GPX file (GPX mode) ───────────────────────────────────── */}
      {props.mode === 'gpx' && (
        <div className="form-section">
          <button className="section-title" onClick={() => toggle('gpx')} aria-expanded={isOpen('gpx')}>
            <span className={`section-chevron${isOpen('gpx') ? ' open' : ''}`} aria-hidden="true">▾</span>
            GPX file
          </button>
          <div className={`section-body${isOpen('gpx') ? ' section-body--open' : ''}`}>
            <div className="section-body-inner">
              <div className="field">
                <label>Select track</label>
                <select
                  value={props.gpxFile}
                  onChange={e => upd('gpxFile', e.target.value)}
                >
                  <option value="">— choose a file —</option>
                  {gpxFiles.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Start label</label>
                <input
                  type="text"
                  value={props.startLabel}
                  onChange={e => upd('startLabel', e.target.value)}
                />
              </div>
              <div className="field">
                <label>End label</label>
                <input
                  type="text"
                  value={props.endLabel}
                  onChange={e => upd('endLabel', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Upload new GPX</label>
                <div className="upload-area">
                  <input
                    type="file"
                    accept=".gpx"
                    onChange={handleFileUpload}
                  />
                  Click to upload a .gpx file
                </div>
              </div>
              {uploadMsg && (
                <div className={`upload-status ${uploadStatus}`}>{uploadMsg}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Track line ───────────────────────────────────────────── */}
      <div className="form-section">
        <button className="section-title" onClick={() => toggle('trackLine')} aria-expanded={isOpen('trackLine')}>
          <span className={`section-chevron${isOpen('trackLine') ? ' open' : ''}`} aria-hidden="true">▾</span>
          Track line
        </button>
        <div className={`section-body${isOpen('trackLine') ? ' section-body--open' : ''}`}>
          <div className="section-body-inner">
            <div className="field">
              <label>Style</label>
              <LineStylePicker
                value={props.lineStyle}
                lineColor={props.lineColor}
                onChange={v => upd('lineStyle', v)}
              />
            </div>
            {props.lineStyle === 'pencil' && (
              <RangeField
                label="Pencil strength"
                value={props.pencilStrength}
                min={1} max={10}
                onChange={v => upd('pencilStrength', v)}
              />
            )}
            <ColorField
              label="Line color"
              value={props.lineColor}
              onChange={v => upd('lineColor', v)}
            />
            <RangeField
              label="Line width"
              value={props.lineWidth}
              min={1} max={30}
              onChange={v => upd('lineWidth', v)}
            />
          </div>
        </div>
      </div>

      {/* ── Map ──────────────────────────────────────────────────── */}
      <div className="form-section">
        <button className="section-title" onClick={() => toggle('map')} aria-expanded={isOpen('map')}>
          <span className={`section-chevron${isOpen('map') ? ' open' : ''}`} aria-hidden="true">▾</span>
          Map
        </button>
        <div className={`section-body${isOpen('map') ? ' section-body--open' : ''}`}>
          <div className="section-body-inner">
            <div className="field">
              <label>Style</label>
              <MapStylePicker
                value={props.mapStyle}
                onChange={v => upd('mapStyle', v)}
              />
            </div>

            {props.mapStyle === 'none' && (
              <ColorField
                label="Background"
                value={props.mapBgColor}
                onChange={v => upd('mapBgColor', v)}
              />
            )}

            <div className="field">
              <label>Zoom mode</label>
              <div className="radio-group">
                <input
                  type="radio" id="zoom-auto" name="zoomMode"
                  checked={props.zoomMode === 'auto'}
                  onChange={() => upd('zoomMode', 'auto')}
                />
                <label htmlFor="zoom-auto">Auto</label>
                <input
                  type="radio" id="zoom-manual" name="zoomMode"
                  checked={props.zoomMode === 'manual'}
                  onChange={() => upd('zoomMode', 'manual')}
                />
                <label htmlFor="zoom-manual">Manual</label>
              </div>
            </div>
            {props.zoomMode === 'manual' && (
              <RangeField
                label="Zoom level"
                value={props.zoom}
                min={1} max={20} step={1}
                onChange={v => upd('zoom', v)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Route labels ─────────────────────────────────────────── */}
      <div className="form-section">
        <button className="section-title" onClick={() => toggle('routeLabels')} aria-expanded={isOpen('routeLabels')}>
          <span className={`section-chevron${isOpen('routeLabels') ? ' open' : ''}`} aria-hidden="true">▾</span>
          Route labels
        </button>
        <div className={`section-body${isOpen('routeLabels') ? ' section-body--open' : ''}`}>
          <div className="section-body-inner">
            <div className="field">
              <label>Labels</label>
              <LabelModePicker
                value={props.labelMode}
                onChange={v => upd('labelMode', v)}
              />
            </div>

            {props.labelMode === 'animated' && (
              <div className="field">
                <label>Animation</label>
                <LabelAnimationPicker
                  value={props.labelAnimation}
                  onChange={v => upd('labelAnimation', v)}
                />
              </div>
            )}

            {props.labelMode !== 'off' && (<>
              <ColorField
                label="Background"
                value={props.labelBgColor}
                onChange={v => upd('labelBgColor', v)}
              />
              <ColorField
                label="Text color"
                value={props.labelTextColor}
                onChange={v => upd('labelTextColor', v)}
              />
            </>)}
          </div>
        </div>
      </div>

      {/* ── Animation ────────────────────────────────────────────── */}
      <div className="form-section">
        <button className="section-title" onClick={() => toggle('animation')} aria-expanded={isOpen('animation')}>
          <span className={`section-chevron${isOpen('animation') ? ' open' : ''}`} aria-hidden="true">▾</span>
          Animation
        </button>
        <div className={`section-body${isOpen('animation') ? ' section-body--open' : ''}`}>
          <div className="section-body-inner">
            {/* Output format — controls canvas dimensions (width × height) of the render */}
            <div className="field">
              <label>Format</label>
              <div className="radio-group">
                <input
                  type="radio" id="fmt-portrait" name="outputFormat"
                  checked={props.outputFormat === 'portrait'}
                  onChange={() => upd('outputFormat', 'portrait')}
                />
                <label htmlFor="fmt-portrait"  title="Portrait (1080×1920)">9:16</label>
                <input
                  type="radio" id="fmt-landscape" name="outputFormat"
                  checked={props.outputFormat === 'landscape'}
                  onChange={() => upd('outputFormat', 'landscape')}
                />
                <label htmlFor="fmt-landscape" title="Landscape (1920×1080)">16:9</label>
                <input
                  type="radio" id="fmt-square" name="outputFormat"
                  checked={props.outputFormat === 'square'}
                  onChange={() => upd('outputFormat', 'square')}
                />
                <label htmlFor="fmt-square"    title="Square (1080×1080)">1:1</label>
              </div>
            </div>

            <RangeField
              label="Duration"
              value={props.duration}
              min={1} max={60} unit="s"
              onChange={v => upd('duration', v)}
            />
          </div>
        </div>
      </div>

      {/* ── City labels ──────────────────────────────────────────── */}
      <div className="form-section">
        <button className="section-title" onClick={() => toggle('cityLabels')} aria-expanded={isOpen('cityLabels')}>
          <span className={`section-chevron${isOpen('cityLabels') ? ' open' : ''}`} aria-hidden="true">▾</span>
          City labels
        </button>
        <div className={`section-body${isOpen('cityLabels') ? ' section-body--open' : ''}`}>
          <div className="section-body-inner">
            <div className="field">
              <label>Show</label>
              <CitySlider
                value={props.minPopulation}
                onChange={v => upd('minPopulation', v)}
              />
            </div>

            {props.minPopulation > 0 && (<>
              <div className="field">
                <label>Font</label>
                <FontPicker
                  value={props.cityFont}
                  onChange={v => upd('cityFont', v as Props['cityFont'])}
                />
              </div>

              <div className="field">
                <label>Case</label>
                <div className="radio-group">
                  <input
                    type="radio" id="city-case-normal" name="cityUppercase"
                    checked={!props.cityUppercase}
                    onChange={() => upd('cityUppercase', false)}
                  />
                  <label htmlFor="city-case-normal">Normal</label>
                  <input
                    type="radio" id="city-case-upper" name="cityUppercase"
                    checked={props.cityUppercase}
                    onChange={() => upd('cityUppercase', true)}
                  />
                  <label htmlFor="city-case-upper">ALL CAPS</label>
                </div>
              </div>

              <div className="city-tier-label">Big <span>(pop &gt; 1M)</span></div>
              <ColorField
                label="Color"
                value={props.cityColorBig}
                onChange={v => upd('cityColorBig', v)}
              />
              <RangeField
                label="Size"
                value={props.citySizeBig}
                min={10} max={80}
                onChange={v => upd('citySizeBig', v)}
              />

              <div className="city-tier-label">Medium <span>(200k – 1M)</span></div>
              <ColorField
                label="Color"
                value={props.cityColorMedium}
                onChange={v => upd('cityColorMedium', v)}
              />
              <RangeField
                label="Size"
                value={props.citySizeMedium}
                min={8} max={60}
                onChange={v => upd('citySizeMedium', v)}
              />

              <div className="city-tier-label">Small <span>(&lt; 200k)</span></div>
              <ColorField
                label="Color"
                value={props.cityColorSmall}
                onChange={v => upd('cityColorSmall', v)}
              />
              <RangeField
                label="Size"
                value={props.citySizeSmall}
                min={6} max={44}
                onChange={v => upd('citySizeSmall', v)}
              />
            </>)}
          </div>
        </div>
      </div>

    </div>
  );
}
