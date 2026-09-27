/**
 * PropsForm.tsx — the settings bands in the sidebar (2026-09-27 "Color Stack"
 * redesign, see CLAUDE.md). Four full-width colour bands — 1 Route, 2 Labels,
 * 3 Line, 4 Map — only one open at a time; the collapsed ones show a two-line
 * summary of their current settings. Band 5 (Export) lives in App.tsx because
 * it owns the render request. Presets moved to the stage's top bar
 * (PresetBar.tsx); output format and duration moved next to the preview
 * (App.tsx), since they change the preview frame itself.
 *
 *  upd(key, value)
 *    Shorthand for onChange({ ...props, [key]: value }).
 *
 *  Picker / CountryPicker
 *    Custom dropdowns (button trigger + position:fixed panel so the sidebar's
 *    overflow can't clip it), dismissed by outside click or Escape.
 *
 *  CITY_STEPS discrete slider
 *    City label density uses fixed population thresholds (10k … 2M, or off)
 *    rather than a continuous range — intermediate values render identically.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Props } from './types';
import { ColorPicker } from './ColorPicker';
import { COUNTRIES, Country } from '../../src/countryData';
import {
  RouteIcon, TagIcon, LineIcon, MapIcon, VehicleIcon, NoneIcon, UpDownIcon, ChevronDownIcon, UploadIcon,
} from './icons';
import { Place, placeFromAddress, placesFromGpx } from './routeLabels';

interface PropsFormProps {
  props:    Props;
  // A state setter (not a plain callback) so async work — geocoding the route
  // into label text — can merge onto the *latest* props when it resolves.
  onChange: React.Dispatch<React.SetStateAction<Props>>;
  gpxFiles: string[];
  onUpload: () => void;  // called after a successful GPX upload
}

function set<K extends keyof Props>(props: Props, key: K, value: Props[K]): Props {
  return { ...props, [key]: value };
}

function useDismiss(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!refs.some(r => r.current?.contains(t))) close();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
}

// ── Layout primitives ─────────────────────────────────────────────────────

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="row">
      {htmlFor
        ? <label className="row-label" htmlFor={htmlFor}>{label}</label>
        : <span className="row-label">{label}</span>}
      <div className="row-control">{children}</div>
    </div>
  );
}

interface SegOption<T> { value: T; label: string; icon?: React.ReactNode }

/** Black-outlined pill toggle (text options) or a row of round icon buttons. */
function Seg<T extends string | boolean>({
  options, value, onChange, ariaLabel, variant = 'pill',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  variant?: 'pill' | 'icons';
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={variant === 'icons' ? 'icon-group' : 'seg'}>
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          aria-label={o.icon ? o.label : undefined}
          title={o.icon ? o.label : undefined}
          className={variant === 'icons' ? 'icon-toggle' : 'seg-btn'}
          onClick={() => onChange(o.value)}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

/** Value-bar slider: the whole pill is the track, filled up to the value,
 *  with a thin grip, tick dots and the number on the right. */
function Slider({
  value, min, max, step = 1, onChange, label, display,
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; label: string; display?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider" style={{ '--fill': `${pct}%` } as React.CSSProperties}>
      <span className="slider-fill" />
      <span className="slider-grip" />
      <span className="slider-dots" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span className="slider-value">{display ?? value}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        aria-label={label}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function RangeRow({ label, value, min, max, step, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={label}>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} label={label}
        display={`${value}${unit}`} />
    </Row>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <span className="color-control">
        <span className="color-hex">{value.toUpperCase()}</span>
        <ColorPicker value={value} onChange={onChange} label={label} />
      </span>
    </Row>
  );
}

// ── Generic dropdown ──────────────────────────────────────────────────────

interface PickerOption<T> { value: T; label: string }

function Picker<T extends string>({
  value, options, onChange, ariaLabel, render, panelWidth = 200,
}: {
  value: T;
  options: PickerOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  render?: (o: PickerOption<T>, inTrigger: boolean) => React.ReactNode;
  panelWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [triggerRef, panelRef]);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.right - panelWidth, window.innerWidth - panelWidth - 12) });
    setOpen(true);
  }

  const current = options.find(o => o.value === value) ?? { value, label: 'Custom' };
  const show = (o: PickerOption<T>, t: boolean) => render ? render(o, t) : <span>{o.label}</span>;

  return (
    <div className="ls-picker">
      <button ref={triggerRef} type="button" className="ls-trigger" aria-label={`${ariaLabel}: ${current.label}`}
        aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        <span className="ls-label">{show(current, true)}</span>
        <span className="ls-arrow"><UpDownIcon size={14} /></span>
      </button>
      {open && (
        <div ref={panelRef} className="ls-panel" role="listbox" aria-label={ariaLabel}
          style={{ top: pos.top, left: Math.max(12, pos.left), width: panelWidth }}>
          <div className="ls-options-scroll">
            {options.map(o => (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value}
                className={`ls-option${o.value === value ? ' selected' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}>
                {show(o, false)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Country picker (searchable — powers the "Air France" style label flags) ──

function CountryPicker({ value, onChange, ariaLabel }: { value: string; onChange: (c: Country) => void; ariaLabel: string }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const [pos,   setPos]   = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  useDismiss(open, () => setOpen(false), [triggerRef, panelRef]);

  const W = 240;
  function toggle() {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.right - W, window.innerWidth - W - 12) });
    setQuery('');
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  const current  = COUNTRIES.find(c => c.code === value) ?? COUNTRIES.find(c => c.code === 'be')!;
  const filtered = query ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : COUNTRIES;

  return (
    <div className="ls-picker">
      <button ref={triggerRef} type="button" className="ls-trigger" aria-label={`${ariaLabel}: ${current.name}`}
        aria-expanded={open} onClick={toggle}>
        <img className="ls-flag" src={`https://flagcdn.com/24x18/${current.code}.png`} alt="" />
        <span className="ls-label">{current.name}</span>
        <span className="ls-arrow"><UpDownIcon size={14} /></span>
      </button>
      {open && (
        <div ref={panelRef} className="ls-panel" style={{ top: pos.top, left: Math.max(12, pos.left), width: W }}>
          <input ref={searchRef} className="ls-search" type="text" placeholder="Search country…"
            aria-label="Search country" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="ls-options-scroll">
            {filtered.map(c => (
              <button key={c.code} type="button" className={`ls-option${c.code === value ? ' selected' : ''}`}
                onClick={() => { onChange(c); setOpen(false); }}>
                <img className="ls-flag" src={`https://flagcdn.com/24x18/${c.code}.png`} alt="" />
                <span>{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="ls-option ls-option--empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Option lists ──────────────────────────────────────────────────────────

const MAP_STYLE_OPTIONS: (PickerOption<string> & { swatch: string })[] = [
  { value: 'mapbox/light-v11',                   label: 'Light',       swatch: '#F2F1EE' },
  { value: 'shaggy72/cmpma5agg000101qr4tt68gad', label: 'Gray',        swatch: '#D9D9D7' },
  { value: 'mapbox/dark-v11',                    label: 'Dark',        swatch: '#2A2B2D' },
  { value: 'shaggy72/cmugrbhnu000801s01q212pyn', label: 'Air France',  swatch: '#1F3A5C' },
  { value: 'shaggy72/cmqf8b53y001g01sc9lsh67db', label: 'Topographic', swatch: '#E8E2CC' },
  { value: 'shaggy72/cmqf94fhu003q01qw4m5e4fpk', label: 'Topo v2',     swatch: '#EDE7D3' },
  { value: 'mapbox/streets-v12',                 label: 'Streets',     swatch: '#AAD3DF' },
  { value: 'mapbox/outdoors-v12',                label: 'Outdoors',    swatch: '#C9D7A7' },
  { value: 'mapbox/satellite-streets-v12',       label: 'Satellite',   swatch: '#4A5738' },
  { value: 'none',                               label: 'No map',      swatch: 'transparent' },
];

type LineStyleValue = Props['lineStyle'];
const LINE_STYLE_OPTIONS: PickerOption<LineStyleValue>[] = [
  { value: 'solid',     label: 'Solid' },
  { value: 'dashed',    label: 'Dashed' },
  { value: 'dotted',    label: 'Dotted' },
  { value: 'long-dash', label: 'Long dash' },
  { value: 'dash-dot',  label: 'Dash-dot' },
  { value: 'pencil',    label: 'Pencil' },
];
const DASH_ARRAYS: Partial<Record<LineStyleValue, string>> = {
  dashed: '8 4', dotted: '2 5', 'long-dash': '16 5', 'dash-dot': '10 4 2 4',
};

function LinePreview({ value, color }: { value: LineStyleValue; color: string }) {
  if (value === 'pencil') {
    return (
      <svg width="34" height="10" viewBox="0 0 44 10" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M2,5 C6,3 11,7 16,5 C21,3 26,7 31,5 C36,3 40,7 42,5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  const da = DASH_ARRAYS[value];
  return (
    <svg width="34" height="10" viewBox="0 0 44 10" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="2" y1="5" x2="42" y2="5" stroke={color} strokeWidth="3"
        strokeLinecap={value === 'dotted' ? 'round' : 'butt'} {...(da ? { strokeDasharray: da } : {})} />
    </svg>
  );
}

const LABEL_ANIM_OPTIONS: PickerOption<string>[] = [
  { value: 'appear',        label: 'Appear (no animation)' },
  { value: 'left-to-right', label: 'Left → right' },
  { value: 'right-to-left', label: 'Right → left' },
  { value: 'fade',          label: 'Fade in' },
  { value: 'scale',         label: 'Scale in' },
  { value: 'slide-up',      label: 'Slide up' },
  { value: 'typewriter',    label: 'Typewriter' },
  { value: 'wipe-from-dot', label: 'Wipe from dot' },
];

const FONT_OPTIONS: (PickerOption<string> & { family: string })[] = [
  { value: 'Helvetica',    label: 'Helvetica',    family: "'Helvetica Neue', Arial, sans-serif" },
  { value: 'Inter',        label: 'Inter',        family: "Inter, 'Segoe UI', sans-serif" },
  { value: 'Georgia',      label: 'Georgia',      family: 'Georgia, serif' },
  { value: 'Oswald',       label: 'Oswald',       family: 'Oswald, sans-serif' },
  { value: 'Merriweather', label: 'Merriweather', family: "'Merriweather', Georgia, serif" },
];
const renderFont = (o: PickerOption<string>) => (
  <span style={{ fontFamily: FONT_OPTIONS.find(f => f.value === o.value)?.family }}>{o.label}</span>
);

const LABEL_MODE_OPTIONS: SegOption<Props['labelMode']>[] = [
  { value: 'off',      label: 'Off' },
  { value: 'on',       label: 'Static' },
  { value: 'animated', label: 'Animated' },
];

// Same glyphs as the route-tip badge in the video (see VehicleIcon).
const TRAVEL_MODE_OPTIONS: SegOption<Props['travelMode']>[] = [
  { value: 'driving', label: 'Car',    icon: <VehicleIcon type="car" /> },
  { value: 'cycling', label: 'Bike',   icon: <VehicleIcon type="bike" /> },
  { value: 'walking', label: 'Walk',   icon: <VehicleIcon type="walk" /> },
  { value: 'flight',  label: 'Flight', icon: <VehicleIcon type="plane" /> },
];

const MARKER_OPTIONS: SegOption<Props['routeMarker']>[] = [
  { value: 'none',   label: 'No marker', icon: <NoneIcon size={16} /> },
  { value: 'car',    label: 'Car',       icon: <VehicleIcon type="car" size={19} /> },
  { value: 'camper', label: 'Camper',    icon: <VehicleIcon type="camper" size={19} /> },
  { value: 'plane',  label: 'Plane',     icon: <VehicleIcon type="plane" size={19} /> },
  { value: 'bike',   label: 'Bike',      icon: <VehicleIcon type="bike" size={19} /> },
  { value: 'walk',   label: 'Walk',      icon: <VehicleIcon type="walk" size={19} /> },
];

// Discrete population thresholds for city labels. Whether city labels show at
// all is a separate switch (minPopulation 0 = off), like Zoom's Auto/Manual.
const CITY_STEPS = [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000] as const;
const DEFAULT_CITY_POP = 100_000;

function popLabel(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M+` : `${n / 1000}k+`;
}

function CitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const index = CITY_STEPS.reduce<number>(
    (best, s, i) => Math.abs(s - value) < Math.abs(CITY_STEPS[best] - value) ? i : best, 0);
  return (
    <Slider value={index} min={0} max={CITY_STEPS.length - 1} label="Show cities with population over"
      display={popLabel(CITY_STEPS[index])} onChange={i => onChange(CITY_STEPS[i])} />
  );
}

/** Read-only preview of one label's text, shown when "Same as route" is on. */
function LabelChip({ code, country, city }: { code: string; country: string; city: string }) {
  return (
    <span className="label-chip">
      {code && <img className="ls-flag" src={`https://flagcdn.com/24x18/${code}.png`} alt="" />}
      <span><strong>{country || '—'}</strong> {city}</span>
    </span>
  );
}

// ── Band ──────────────────────────────────────────────────────────────────

function Band({
  id, num, title, cap1, cap2, icon, open, onToggle, children,
}: {
  id: string; num: number; title: string; cap1: string; cap2?: string;
  icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section className={`band band--${id}${open ? ' band--open' : ''}`}>
      <button type="button" className="band-head" aria-expanded={open} aria-controls={`band-${id}`} onClick={onToggle}>
        <span className="band-num">{num}</span>
        <span className="band-title">{title}</span>
        <span className="band-cap">
          <strong>{cap1}</strong>
          {cap2 && <span>{cap2}</span>}
        </span>
        <span className="band-icon">{icon}</span>
      </button>
      {open && <div className="band-body" id={`band-${id}`}>{children}</div>}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function PropsForm({ props, onChange, gpxFiles, onUpload }: PropsFormProps) {
  const [open,         setOpen]         = useState<string>('route');
  const [showTiers,    setShowTiers]    = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [uploadMsg,    setUploadMsg]    = useState('');

  const toggle = (id: string) => setOpen(o => o === id ? '' : id);

  function upd<K extends keyof Props>(key: K, value: Props[K]) {
    onChange(set(props, key, value));
  }

  // ── Route → label text (2026-09-27) ─────────────────────────────────────
  // Editing From/To fills in that end's country + city (debounced, so it
  // geocodes once typing pauses). "Same as route" additionally keeps them in
  // sync on source/track changes and hides their fields. Results are merged
  // onto the latest props, and dropped if the route changed again meanwhile.
  const geoTimers = useRef<Partial<Record<'start' | 'end', number>>>({});

  function applyPlace(which: 'start' | 'end', place: Place | null, stillValid: (p: Props) => boolean) {
    if (!place) return;
    onChange(prev => {
      if (!stillValid(prev)) return prev;
      const country = place.countryCode ? place.countryCode : null;
      return which === 'start'
        ? { ...prev, startLabel: place.city || prev.startLabel,
            ...(country ? { startCountry: place.countryName, startCountryCode: country } : {}) }
        : { ...prev, endLabel: place.city || prev.endLabel,
            ...(country ? { endCountry: place.countryName, endCountryCode: country } : {}) };
    });
  }

  function syncAddress(which: 'start' | 'end', address: string, delay = 700) {
    window.clearTimeout(geoTimers.current[which]);
    geoTimers.current[which] = window.setTimeout(async () => {
      const place = await placeFromAddress(address);
      applyPlace(which, place, p => (which === 'start' ? p.startAddress : p.endAddress) === address);
    }, delay);
  }

  async function syncFromRoute(p: Props) {
    if (p.mode === 'directions') {
      syncAddress('start', p.startAddress, 0);
      syncAddress('end', p.endAddress, 0);
    } else if (p.gpxFile) {
      const [a, b] = await placesFromGpx(p.gpxFile);
      const same = (q: Props) => q.mode === 'gpx' && q.gpxFile === p.gpxFile;
      applyPlace('start', a, same);
      applyPlace('end', b, same);
    }
  }

  /** Apply a route change; re-derive the labels when "Same as route" is on. */
  function changeRoute(next: Props) {
    onChange(next);
    if (next.labelsFromRoute) syncFromRoute(next);
  }

  // Remembers the population threshold while city labels are switched off.
  const lastCityPop = useRef(props.minPopulation > 0 ? props.minPopulation : DEFAULT_CITY_POP);

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
        setUploadMsg(`${file.name} uploaded`);
        onUpload();
        changeRoute({ ...props, mode: 'gpx', gpxFile: file.name });
      } else {
        const text = await res.text();
        setUploadStatus('error');
        setUploadMsg(text || 'Upload failed.');
      }
    } catch {
      setUploadStatus('error');
      setUploadMsg('Network error during upload.');
    }
    e.target.value = '';
  }

  // ── Band summaries ──────────────────────────────────────────────────────
  const TRAVEL_MODE_LABEL: Record<Props['travelMode'], string> = {
    driving: 'Car', cycling: 'Bike', walking: 'Walk', flight: 'Flight',
  };
  const routeCap1 = props.mode === 'directions' ? TRAVEL_MODE_LABEL[props.travelMode] : 'GPS track';
  const routeCap2 = props.mode === 'directions'
    ? `${props.startLabel || '?'} → ${props.endLabel || '?'}`
    : (props.gpxFile || 'No track selected');
  const labelsCap1 = LABEL_MODE_OPTIONS.find(o => o.value === props.labelMode)?.label ?? '';
  const labelsCap2 = props.labelMode === 'animated'
    ? LABEL_ANIM_OPTIONS.find(o => o.value === props.labelAnimation)?.label
    : props.labelMode === 'on' ? props.labelFont : undefined;
  const lineCap1 = LINE_STYLE_OPTIONS.find(o => o.value === props.lineStyle)?.label ?? '';
  const lineCap2 = `${props.lineWidth} px`;
  const mapCap1  = MAP_STYLE_OPTIONS.find(o => o.value === props.mapStyle)?.label ?? 'Custom';
  const mapCap2  = `${props.zoomMode === 'auto' ? 'Auto zoom' : `Zoom ${props.zoom}`} · ${props.minPopulation === 0 ? 'no cities' : `cities ${popLabel(props.minPopulation)}`}`;

  return (
    <div className="bands">

      {/* ── 1 Route ─────────────────────────────────────────────────── */}
      <Band id="route" num={1} title="Route" cap1={routeCap1} cap2={routeCap2}
        icon={<RouteIcon size={28} strokeWidth={1.5} />} open={open === 'route'} onToggle={() => toggle('route')}>
        <Row label="Source">
          <Seg ariaLabel="Route source" value={props.mode}
            options={[{ value: 'directions', label: 'Directions' }, { value: 'gpx', label: 'GPS track' }]}
            onChange={m => changeRoute(m === 'gpx'
              ? { ...props, mode: 'gpx', gpxFile: props.gpxFile || (gpxFiles[0] ?? '') }
              : { ...props, mode: 'directions' })} />
        </Row>

        {props.mode === 'directions' && (<>
          <Row label="Travel by">
            <Seg variant="icons" ariaLabel="Travel mode" value={props.travelMode}
              options={TRAVEL_MODE_OPTIONS} onChange={v => upd('travelMode', v)} />
          </Row>
          {props.travelMode === 'flight' && (
            <RangeRow label="Arc curve" value={props.flightCurve} min={0} max={100} step={5}
              onChange={v => upd('flightCurve', v)} />
          )}
          <Row label="From" htmlFor="start-address">
            <input id="start-address" className="field-input" type="text" value={props.startAddress}
              onChange={e => { upd('startAddress', e.target.value); syncAddress('start', e.target.value); }}
              placeholder="e.g. Ghent, Belgium" />
          </Row>
          <Row label="To" htmlFor="end-address">
            <input id="end-address" className="field-input" type="text" value={props.endAddress}
              onChange={e => { upd('endAddress', e.target.value); syncAddress('end', e.target.value); }}
              placeholder="e.g. Paris, France" />
          </Row>
        </>)}

        {props.mode === 'gpx' && (<>
          <Row label="Track" htmlFor="gpx-select">
            <span className="select-wrap">
              <select id="gpx-select" className="field-select" value={props.gpxFile}
                onChange={e => changeRoute({ ...props, gpxFile: e.target.value })}>
                <option value="">Choose a file…</option>
                {gpxFiles.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <span className="select-arrow"><UpDownIcon size={14} /></span>
            </span>
          </Row>
          <Row label="Upload">
            <label className="upload-btn">
              <UploadIcon size={16} />
              <span>Upload .gpx</span>
              <input type="file" accept=".gpx" onChange={handleFileUpload} />
            </label>
          </Row>
          {uploadMsg && <div className={`status-note status-note--${uploadStatus}`} role="status">{uploadMsg}</div>}

          <Row label="Elevation profile">
            <Switch label="Show elevation profile" checked={props.showElevationProfile}
              onChange={v => upd('showElevationProfile', v)} />
          </Row>
          {props.showElevationProfile && (<>
            <ColorRow label="Profile line" value={props.elevationColor} onChange={v => upd('elevationColor', v)} />
            <ColorRow label="Profile background" value={props.elevationBgColor} onChange={v => upd('elevationBgColor', v)} />
            <RangeRow label="Left" unit="%" value={props.elevationLeft} min={0} max={90} onChange={v => upd('elevationLeft', v)} />
            <RangeRow label="Top" unit="%" value={props.elevationTop} min={0} max={95} onChange={v => upd('elevationTop', v)} />
            <RangeRow label="Width" unit="%" value={props.elevationWidth} min={10} max={100} onChange={v => upd('elevationWidth', v)} />
            <RangeRow label="Height" unit="%" value={props.elevationHeight} min={3} max={50} onChange={v => upd('elevationHeight', v)} />
          </>)}
        </>)}
      </Band>

      {/* ── 2 Labels ────────────────────────────────────────────────── */}
      <Band id="labels" num={2} title="Labels" cap1={labelsCap1} cap2={labelsCap2}
        icon={<TagIcon size={28} strokeWidth={1.5} />} open={open === 'labels'} onToggle={() => toggle('labels')}>
        <Row label="Show">
          <Seg ariaLabel="Show labels" value={props.labelMode} options={LABEL_MODE_OPTIONS}
            onChange={v => upd('labelMode', v)} />
        </Row>
        {props.labelMode !== 'off' && (
          <Row label="Same as route">
            <Switch label="Take the label text from the route" checked={props.labelsFromRoute}
              onChange={on => {
                const next = { ...props, labelsFromRoute: on };
                onChange(next);
                if (on) syncFromRoute(next);
              }} />
          </Row>
        )}
        {props.labelMode !== 'off' && props.labelsFromRoute && (
          <p className="route-labels-note">
            <LabelChip code={props.startCountryCode} country={props.startCountry} city={props.startLabel} />
            <span aria-hidden="true">→</span>
            <LabelChip code={props.endCountryCode} country={props.endCountry} city={props.endLabel} />
          </p>
        )}
        {props.labelMode === 'animated' && (
          <Row label="Animation">
            <Picker ariaLabel="Label animation" value={props.labelAnimation} options={LABEL_ANIM_OPTIONS}
              onChange={v => upd('labelAnimation', v)} />
          </Row>
        )}
        {props.labelMode !== 'off' && !props.labelsFromRoute && (<>
          <Row label="Start country">
            <CountryPicker ariaLabel="Start country" value={props.startCountryCode}
              onChange={c => onChange(set(set(props, 'startCountryCode', c.code), 'startCountry', c.name))} />
          </Row>
          <Row label="Start city" htmlFor="start-city">
            <input id="start-city" className="field-input" type="text" value={props.startLabel}
              onChange={e => upd('startLabel', e.target.value)} />
          </Row>
          <Row label="End country">
            <CountryPicker ariaLabel="End country" value={props.endCountryCode}
              onChange={c => onChange(set(set(props, 'endCountryCode', c.code), 'endCountry', c.name))} />
          </Row>
          <Row label="End city" htmlFor="end-city">
            <input id="end-city" className="field-input" type="text" value={props.endLabel}
              onChange={e => upd('endLabel', e.target.value)} />
          </Row>
        </>)}
        {props.labelMode !== 'off' && (<>
          <Row label="Font">
            <Picker ariaLabel="Label font" value={props.labelFont} options={FONT_OPTIONS} render={renderFont}
              onChange={v => upd('labelFont', v as Props['labelFont'])} />
          </Row>
          <ColorRow label="Background" value={props.labelBgColor} onChange={v => upd('labelBgColor', v)} />
          <ColorRow label="Text color" value={props.labelTextColor} onChange={v => upd('labelTextColor', v)} />
        </>)}
      </Band>

      {/* ── 3 Line ──────────────────────────────────────────────────── */}
      <Band id="line" num={3} title="Line" cap1={lineCap1} cap2={lineCap2}
        icon={<LineIcon size={28} strokeWidth={1.5} />} open={open === 'line'} onToggle={() => toggle('line')}>
        <Row label="Style">
          <Picker ariaLabel="Line style" value={props.lineStyle} options={LINE_STYLE_OPTIONS}
            onChange={v => upd('lineStyle', v)}
            render={o => (<><LinePreview value={o.value} color={props.lineColor} /><span>{o.label}</span></>)} />
        </Row>
        {props.lineStyle === 'pencil' && (
          <RangeRow label="Pencil strength" value={props.pencilStrength} min={1} max={10}
            onChange={v => upd('pencilStrength', v)} />
        )}
        <ColorRow label="Color" value={props.lineColor} onChange={v => upd('lineColor', v)} />
        <RangeRow label="Width" unit=" px" value={props.lineWidth} min={1} max={30} onChange={v => upd('lineWidth', v)} />
        <RangeRow label="Pin size" unit=" px" value={props.pinSize} min={2} max={24} onChange={v => upd('pinSize', v)} />
        <Row label="Marker">
          <Seg variant="icons" ariaLabel="Transport marker" value={props.routeMarker} options={MARKER_OPTIONS}
            onChange={v => upd('routeMarker', v)} />
        </Row>
        {props.routeMarker !== 'none' && (
          <RangeRow label="Marker size" unit=" px" value={props.routeMarkerSize} min={20} max={120}
            onChange={v => upd('routeMarkerSize', v)} />
        )}
      </Band>

      {/* ── 4 Map ───────────────────────────────────────────────────── */}
      <Band id="map" num={4} title="Map" cap1={mapCap1} cap2={mapCap2}
        icon={<MapIcon size={28} strokeWidth={1.5} />} open={open === 'map'} onToggle={() => toggle('map')}>
        <Row label="Style">
          <Picker ariaLabel="Map style" value={props.mapStyle} options={MAP_STYLE_OPTIONS}
            onChange={v => upd('mapStyle', v)}
            render={o => (<>
              <span className={`style-dot${o.value === 'none' ? ' style-dot--none' : ''}`}
                style={{ background: MAP_STYLE_OPTIONS.find(m => m.value === o.value)?.swatch }} />
              <span>{o.label}</span>
            </>)} />
        </Row>
        {props.mapStyle === 'none' && (
          <ColorRow label="Background" value={props.mapBgColor} onChange={v => upd('mapBgColor', v)} />
        )}
        <Row label="Zoom">
          <Seg ariaLabel="Zoom mode" value={props.zoomMode}
            options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]}
            onChange={v => upd('zoomMode', v)} />
        </Row>
        {props.zoomMode === 'manual' && (
          <RangeRow label="Zoom level" value={props.zoom} min={1} max={20} step={0.1} onChange={v => upd('zoom', v)} />
        )}
        <Row label="City labels">
          <Switch label="Show city labels" checked={props.minPopulation > 0}
            onChange={on => {
              if (!on) lastCityPop.current = props.minPopulation;
              upd('minPopulation', on ? lastCityPop.current : 0);
            }} />
        </Row>
        {props.minPopulation > 0 && (<>
          <Row label="Population">
            <CitySlider value={props.minPopulation} onChange={v => upd('minPopulation', v)} />
          </Row>
          <Row label="City font">
            <Picker ariaLabel="City font" value={props.cityFont} options={FONT_OPTIONS} render={renderFont}
              onChange={v => upd('cityFont', v)} />
          </Row>
          <Row label="Case">
            <Seg ariaLabel="City label case" value={props.cityUppercase}
              options={[{ value: false, label: 'Normal' }, { value: true, label: 'ALL CAPS' }]}
              onChange={v => upd('cityUppercase', v)} />
          </Row>
          <button type="button" className="disclosure" aria-expanded={showTiers} onClick={() => setShowTiers(s => !s)}>
            <span>City sizes &amp; colors</span>
            <span className="disclosure-meta">{props.citySizeBig} · {props.citySizeMedium} · {props.citySizeSmall}</span>
            <span className="disclosure-chev"><ChevronDownIcon size={16} /></span>
          </button>
          {showTiers && (
            <div className="tiers">
              {([
                ['Big', 'over 1M', 'cityColorBig', 'citySizeBig', 10, 80],
                ['Medium', '200k – 1M', 'cityColorMedium', 'citySizeMedium', 8, 60],
                ['Small', 'under 200k', 'cityColorSmall', 'citySizeSmall', 6, 44],
              ] as const).map(([name, range, colorKey, sizeKey, min, max]) => (
                <div className="row" key={name}>
                  <span className="row-label tier-label">{name}<small>{range}</small></span>
                  <div className="row-control tier-control">
                    <ColorPicker value={props[colorKey]} onChange={v => upd(colorKey, v)} label={`${name} city color`} />
                    <Slider value={props[sizeKey]} min={min} max={max} label={`${name} city label size`}
                      onChange={v => upd(sizeKey, v)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </Band>
    </div>
  );
}
