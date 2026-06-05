# Design System

All UI styles live in `webapp/src/styles.css`. There is no external component library — everything is hand-crafted CSS using a shared set of design tokens.

---

## Design language

The UI uses the **tweakcn "Claude" theme** — a warm cream/white palette with Claude's signature terracotta orange as the accent colour. Colours are defined in [OKLCH](https://oklch.com/) colour space for perceptual uniformity. The sidebar is compact (280 px wide, 11 px base font) to give as much space as possible to the map preview.

Source: [`https://tweakcn.com/r/themes/claude.json`](https://tweakcn.com/r/themes/claude.json)

---

## Design tokens (CSS custom properties)

Defined in `:root` in `styles.css`. Use these variables everywhere — never hardcode colours or shadows.

### Colours

All values use OKLCH. Map to tweakcn token shown in comments.

| Variable | OKLCH value | tweakcn token | Used for |
|---|---|---|---|
| `--bg` | `oklch(0.9818 0.0054 95.0986)` | `--background` | Preview panel background |
| `--sidebar-bg` | `oklch(0.9663 0.0080 98.8792)` | `--sidebar` | Sidebar background |
| `--field-bg` | `oklch(1.0000 0 0)` | `--popover` | Field pill background, floating panels |
| `--border` | `oklch(0.8847 0.0069 97.3627)` | `--border` | All borders |
| `--border-hover` | `oklch(0.7621 0.0156 98.3528)` | `--input` | Border on hover |
| `--text` | `oklch(0.3438 0.0269 95.7226)` | `--foreground` | Primary text |
| `--text-muted` | `oklch(0.6059 0.0075 97.4233)` | `--muted-foreground` | Labels, secondary values |
| `--text-light` | `oklch(0.7500 0.0100 97.0000)` | interpolated | Tertiary text, arrows |
| `--accent` | `oklch(0.6171 0.1375 39.0427)` | `--primary` | Active/selected state, slider thumb, primary button (Claude orange) |
| `--accent-hover` | `oklch(0.5300 0.1375 39.0427)` | `--primary` darkened | Accent on hover |
| `--accent-light` | `oklch(0.9245 0.0138 92.9892)` | `--secondary` | Selected option background in dropdowns |
| `--danger` | `oklch(0.6368 0.2078 25.3313)` | `--destructive` (dark) | Error messages |
| `--success` | `#4a7a50` | — | Upload success message |
| `--field-hover` | `oklch(0.9341 0.0153 90.2390)` | `--muted` | Field pill on hover |

### Shape & shadow

| Variable | Value | Used for |
|---|---|---|
| `--radius` | `0.5rem` (≈ 8 px) | Default border radius (fields, buttons, panels) |
| `--radius-lg` | `0.75rem` (≈ 12 px) | Larger panels (color picker, login card) |
| `--shadow` | `0 1px 2px rgba(0,0,0,.05)` | Subtle lift |
| `--shadow-md` | `0 2px 16px rgba(0,0,0,.10)` | Floating panels, preview player |

### Layout

| Variable | Value | Used for |
|---|---|---|
| `--sidebar-w` | `280px` | Fixed sidebar width |

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  .layout  (display: flex, height: 100vh)            │
│  ┌──────────────┐  ┌───────────────────────────────┐│
│  │  .sidebar    │  │  .preview-panel               ││
│  │  280px wide  │  │  flex: 1                      ││
│  │              │  │  centred column               ││
│  │ .sidebar-    │  │                               ││
│  │  header      │  │  .preview-player-wrapper      ││
│  │              │  │  aspect-ratio: dynamic        ││
│  │ .sidebar-    │  │                               ││
│  │  body        │  │                               ││
│  │  (scrollable)│  │                               ││
│  │              │  │                               ││
│  │ .sidebar-    │  │                               ││
│  │  footer      │  │                               ││
│  └──────────────┘  └───────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

The sidebar is a flex column: header (fixed) + body (scrollable, `flex: 1`) + footer (fixed).

`.preview-player-wrapper` has no hardcoded `aspect-ratio` in CSS. It is set inline in `App.tsx` based on `props.outputFormat`:
- `portrait` → `9/16`
- `landscape` → `16/9`
- `square` → `1/1`

---

## Typography

- **Font**: Inter (Google Fonts), fallback to system-ui
- **Base size**: 11px on `html/body` — everything else is relative to this
- **Scale in use**: 8px (tiny labels) / 9px (section titles, picker internals) / 10px (field labels and values) / 11px (font preview) / 12px (sidebar heading) / 13px (login form)
- **Section titles**: 9px, 600 weight, uppercase, `letter-spacing: 0.09em`, `--text-muted` colour

---

## Core components

### Field pill — `.field`

The fundamental unit of the form. A rounded card with a label on the left and a control on the right.

```
┌─────────────────────────────────────────┐
│ Label          [      control      ]    │
└─────────────────────────────────────────┘
```

```css
/* Structure */
.field {
  display: flex;
  align-items: center;
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0 12px 0 8px;
  min-height: 27px;
  margin-bottom: 4px;
}
.field > label { width: 38%; flex-shrink: 0; color: var(--text-muted); }
```

The label takes 38% of the width. The control (`input`, `.range-row`, `.color-row`, `.radio-group`, `.ls-picker`) takes `flex: 1`.

**Two-column layout** — wrap two fields in `.field-row` (CSS grid, 2 equal columns):
```jsx
<div className="field-row">
  <div className="field">...</div>
  <div className="field">...</div>
</div>
```

---

### Form section — `.form-section`

Groups related fields. Sections are separated by a top border + margin. Each section has a `.section-title` heading.

```jsx
<div className="form-section">
  <div className="section-title">Route</div>
  <div className="field">...</div>
</div>
```

---

### Radio toggle — `.radio-group`

A segmented button group (hidden radio inputs + styled labels). Two variants:

**Standalone** (e.g. Directions / GPX mode selector):
```jsx
<div className="radio-group">
  <input type="radio" id="mode-directions" name="mode" checked={...} onChange={...} />
  <label htmlFor="mode-directions">Directions</label>
  <input type="radio" id="mode-gpx" name="mode" checked={...} onChange={...} />
  <label htmlFor="mode-gpx">GPX track</label>
</div>
```

**Inside a field pill** — add `.field > .radio-group`; this removes the inner box and uses text-only highlighting instead:
```jsx
<div className="field">
  <label>Label mode</label>
  <div className="radio-group">...</div>
</div>
```

Checked state: standalone → filled accent background; inside field → accent text colour + bold.

---

### Custom dropdown — `.ls-picker`

Used for all dropdowns (line style, map style, label animation, font). **Do not use native `<select>`** — it can't be styled consistently cross-browser and doesn't support visual previews in options.

Structure:
```jsx
<div className="ls-picker">
  {/* Trigger button — always visible */}
  <button className="ls-trigger" onClick={open}>
    <span className="ls-label">{currentLabel}</span>
    <span className="ls-arrow">▾</span>
  </button>

  {/* Options panel — rendered with position:fixed to escape sidebar overflow:hidden */}
  {open && (
    <div className="ls-panel" style={{ top, left, width }}>
      {options.map(opt => (
        <button
          key={opt.value}
          className={`ls-option ${opt.value === value ? 'selected' : ''}`}
          onClick={() => { onChange(opt.value); close(); }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )}
</div>
```

The panel uses `position: fixed` (not `absolute`) because the sidebar has `overflow: hidden`. Position is calculated from `getBoundingClientRect()` of the trigger. See `MapStylePicker` in `PropsForm.tsx` for the reference implementation.

**Click-outside / Escape to close** — use `useEffect` to add `mousedown` and `keydown` listeners when open:
```ts
useEffect(() => {
  if (!open) return;
  const onDown = (e: MouseEvent) => {
    if (!triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)) setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
  document.addEventListener('mousedown', onDown);
  document.addEventListener('keydown', onKey);
  return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
}, [open]);
```

---

### Range slider — `.range-row`

Wraps an `<input type="range">`. The filled portion (left of thumb) uses a CSS custom property `--range-fill` set inline:

```jsx
const pct = Math.round(((value - min) / (max - min)) * 100);
<div className="range-row">
  <input
    type="range" min={min} max={max} value={value}
    style={{ '--range-fill': `${pct}%` } as React.CSSProperties}
    onChange={e => onChange(Number(e.target.value))}
  />
</div>
```

The track gradient uses `--range-fill` to split `var(--accent)` (left) and `var(--border)` (right).

---

### Color picker — `.cp-*`

A fully custom HSV picker in `webapp/src/ColorPicker.tsx`. Renders a floating panel (`.cp-panel`) from a small swatch trigger (`.cp-swatch`).

Supports **8-character hex** (`#RRGGBBAA`) for semi-transparent colours. When alpha = 100, outputs standard 6-char hex. Both SVG attributes and Remotion's `zColor()` accept 8-char hex natively.

Usage:
```jsx
<ColorPicker value={props.lineColor} onChange={v => upd('lineColor', v)} />
```

---

### Buttons — `.btn`

Two variants:

| Class | Appearance | Used for |
|---|---|---|
| `.btn.btn-primary` | Solid accent background, full width | Render & Download |
| `.btn.btn-ghost` | `--field-bg` background, bordered | Secondary actions |

Disabled state: `opacity: 0.5`, `cursor: not-allowed`, no transform on active.

---

### Travel mode icon group — `.travel-mode-group`

The travel mode selector is a `.radio-group` inside a `.field` pill, using icon-only labels instead of text. Material Symbols icons are used for car/bike/walk; the flight icon is an inline SVG (the Material Symbols ligature for "flight" does not load reliably in subsetted fonts).

```jsx
<div className="field">
  <label>Travel</label>
  <div className="radio-group travel-mode-group">
    <input type="radio" id="travel-driving" name="travelMode" ... />
    <label htmlFor="travel-driving" title="Car"><CarIcon /></label>
    {/* repeat for cycling, walking, flight */}
  </div>
</div>
```

Labels use reduced horizontal padding (`7px`) so all four icons fit within the pill width. Icon size: 20 px for car/flight, 15 px for bike/walk (slightly smaller for visual balance).

To add a new travel mode: add a radio input + label here, and add the icon as either a `material-symbols-outlined` span (if the ligature is reliable) or an inline SVG.

---

## Adding a new control

1. **Simple text/number input** — put an `<input>` directly inside `.field`:
   ```jsx
   <div className="field">
     <label>My label</label>
     <input type="text" value={...} onChange={...} />
   </div>
   ```

2. **Dropdown** — follow the `.ls-picker` pattern; copy `MapStylePicker` as a template.

3. **Toggle** — use `.radio-group` with hidden radio inputs.

4. **Color** — use `<ColorPicker>` from `ColorPicker.tsx` wrapped in a `.color-row`.

5. **Slider** — use `.range-row` with `--range-fill` inline style.

Never introduce new colours, border radii, or shadows outside the token system — always use the CSS variables.
