import React, { useState, useEffect, useRef } from 'react';

// ── Color math ─────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

// h 0–360, s 0–100, v 0–100  →  r,g,b 0–255
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100; v /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => Math.round(clamp(v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)))) * 255);
  return [f(5), f(3), f(1)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r)      h = ((g - b) / d + 6) % 6 * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else                h = ((r - g) / d + 4) * 60;
  }
  return [h, max < 1e-6 ? 0 : (d / max) * 100, max * 100];
}

// Parse 6- or 8-char hex → [r, g, b, alpha%]
function hexToRgba(hex: string): [number, number, number, number] | null {
  const m6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m6) return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16), 100];
  const m8 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m8) return [
    parseInt(m8[1], 16), parseInt(m8[2], 16), parseInt(m8[3], 16),
    Math.round(parseInt(m8[4], 16) / 255 * 100),
  ];
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
}

// Output 6-char hex when fully opaque, 8-char hex (#RRGGBBAA) when transparent
function rgbAlphaToHex(r: number, g: number, b: number, alpha: number): string {
  const base = rgbToHex(r, g, b);
  if (alpha >= 100) return base;
  const a = Math.round(clamp(alpha / 100) * 255).toString(16).padStart(2, '0');
  return base + a;
}

function hsvToHex(h: number, s: number, v: number) { return rgbToHex(...hsvToRgb(h, s, v)); }
function pureHue(h: number)                         { return rgbToHex(...hsvToRgb(h, 100, 100)); }

// ── Gradient square ─────────────────────────────────────────────────────────

function GradientSquare({ h, s, v, onChange }: {
  h: number; s: number; v: number;
  onChange: (s: number, v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function pick(cx: number, cy: number) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(
      clamp((cx - r.left) / r.width)  * 100,
      (1 - clamp((cy - r.top) / r.height)) * 100,
    );
  }

  return (
    <div
      ref={ref}
      className="cp-sq"
      style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0), #000), linear-gradient(to right, #fff, ${pureHue(h)})` }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX, e.clientY); }}
      onPointerMove={e => { if (e.buttons) pick(e.clientX, e.clientY); }}
    >
      <div className="cp-sq-cur" style={{ left: `${s}%`, top: `${100 - v}%` }} />
    </div>
  );
}

// ── Hue bar ─────────────────────────────────────────────────────────────────

function HueBar({ h, onChange }: { h: number; onChange: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  function pick(cx: number) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(clamp((cx - r.left) / r.width) * 360);
  }

  return (
    <div
      ref={ref}
      className="cp-hue"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX); }}
      onPointerMove={e => { if (e.buttons) pick(e.clientX); }}
    >
      <div className="cp-bar-cur" style={{ left: `${(h / 360) * 100}%`, background: pureHue(h) }} />
    </div>
  );
}

// ── Alpha bar ───────────────────────────────────────────────────────────────

function AlphaBar({ color, alpha, onChange }: { color: string; alpha: number; onChange: (a: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  function pick(cx: number) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(Math.round(clamp((cx - r.left) / r.width) * 100));
  }

  return (
    <div
      ref={ref}
      className="cp-alpha"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX); }}
      onPointerMove={e => { if (e.buttons) pick(e.clientX); }}
    >
      {/* gradient from transparent → current color */}
      <div className="cp-alpha-fill" style={{ background: `linear-gradient(to right, transparent, ${color})` }} />
      <div className="cp-bar-cur" style={{ left: `${alpha}%`, background: color }} />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export interface ColorPickerProps {
  value:    string;                  // hex like "#e53935" or "#e5393580"
  onChange: (v: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open,     setOpen]     = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Internal state: HSV + alpha (0–100)
  const [hsv,      setHsv]      = useState<[number, number, number]>(() => {
    const rgba = hexToRgba(value);
    return rgba ? rgbToHsv(rgba[0], rgba[1], rgba[2]) : [0, 0, 100];
  });
  const [alpha,    setAlpha]    = useState<number>(() => {
    const rgba = hexToRgba(value); return rgba ? rgba[3] : 100;
  });
  const [hexInput, setHexInput] = useState(hsvToHex(...((() => {
    const rgba = hexToRgba(value);
    return rgba ? rgbToHsv(rgba[0], rgba[1], rgba[2]) : [0, 0, 100] as [number,number,number];
  })())) .replace('#', '').toUpperCase());

  // Track last committed value to detect external changes
  const lastCommit = useRef(value.toLowerCase());

  useEffect(() => {
    if (value.toLowerCase() === lastCommit.current) return;
    lastCommit.current = value.toLowerCase();
    const rgba = hexToRgba(value);
    if (rgba) {
      const newHsv = rgbToHsv(rgba[0], rgba[1], rgba[2]);
      setHsv(newHsv);
      setAlpha(rgba[3]);
      setHexInput(hsvToHex(...newHsv).replace('#', '').toUpperCase());
    }
  }, [value]);

  function openPanel() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const PANEL_W = 224;
    const PANEL_H = 262;
    const left = Math.min(r.left, window.innerWidth - PANEL_W - 12);
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const top = spaceBelow >= PANEL_H ? r.bottom + 6 : r.top - PANEL_H - 6;
    setPanelPos({ top, left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!triggerRef.current?.contains(e.target as Node) &&
          !panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Commit: update all state + call parent onChange
  function commit(newHsv: [number, number, number], newAlpha: number) {
    setHsv(newHsv);
    setAlpha(newAlpha);
    const [r, g, b] = hsvToRgb(...newHsv);
    const hex = rgbAlphaToHex(r, g, b, newAlpha);
    lastCommit.current = hex.toLowerCase();
    setHexInput(rgbToHex(r, g, b).replace('#', '').toUpperCase());
    onChange(hex);
  }

  function onHexInput(raw: string) {
    const clean = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setHexInput(clean.toUpperCase());
    if (clean.length === 6) {
      const rgba = hexToRgba('#' + clean);
      if (rgba) {
        const newHsv = rgbToHsv(rgba[0], rgba[1], rgba[2]);
        setHsv(newHsv);
        const hex = rgbAlphaToHex(rgba[0], rgba[1], rgba[2], alpha);
        lastCommit.current = hex.toLowerCase();
        onChange(hex);
      }
    }
  }

  function onAlphaInput(newAlpha: number) {
    const clamped = Math.max(0, Math.min(100, newAlpha));
    commit(hsv, clamped);
  }

  const displayHex = hsvToHex(...hsv);

  return (
    <>
      {/* ── Swatch trigger ── */}
      <div
        ref={triggerRef}
        className="cp-swatch"
        style={{ background: value }} // show actual color including alpha
        onClick={() => open ? setOpen(false) : openPanel()}
        title={value}
      />

      {/* ── Floating panel ── */}
      {open && (
        <div ref={panelRef} className="cp-panel" style={{ top: panelPos.top, left: panelPos.left }}>
          <GradientSquare
            h={hsv[0]} s={hsv[1]} v={hsv[2]}
            onChange={(s, v) => commit([hsv[0], s, v], alpha)}
          />
          <HueBar
            h={hsv[0]}
            onChange={h => commit([h, hsv[1], hsv[2]], alpha)}
          />
          <AlphaBar
            color={displayHex}
            alpha={alpha}
            onChange={newAlpha => commit(hsv, newAlpha)}
          />
          <div className="cp-inputs">
            <div className="cp-hex-row">
              <span className="cp-hash">#</span>
              <input
                className="cp-hex-in"
                value={hexInput}
                onChange={e => onHexInput(e.target.value)}
                spellCheck={false}
                maxLength={6}
              />
            </div>
            <div className="cp-alpha-display">
              <input
                className="cp-alpha-in"
                type="number"
                min={0} max={100}
                value={alpha}
                onChange={e => onAlphaInput(Number(e.target.value))}
              />
              <span className="cp-pct">%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
