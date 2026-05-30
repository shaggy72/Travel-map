# Design System

All UI styles live in `webapp/src/styles.css`. There is no external component library — everything is hand-crafted CSS using a shared set of design tokens.

---

## Design language

The UI uses a **warm beige/brown palette** — intentionally muted so the map preview is always the focal point. The sidebar is compact (280 px wide, 11 px base font) to give as much space as possible to the preview panel.

---

## Design tokens (CSS custom properties)

Defined in `:root` in `styles.css`. Use these variables everywhere — never hardcode colours or shadows.

### Colours

| Variable | Value | Used for |
|---|---|---|
| `--bg` | `#edeae4` | Preview panel background |
| `--sidebar-bg` | `#e8e4de` | Sidebar background, picker inputs |
| `--field-bg` | `#f8f6f2` | Field pill background, floating panels |
| `--border` | `#d0cbc3` | All borders |
| `--border-hover` | `#b8b2aa` | Border on hover (not widely used) |
| `--text` | `#26211a` | Primary text (dark warm brown-black) |
| `--text-muted` | `#8c7e6e` | Labels, secondary values |
| `--text-light` | `#b4a898` | Tertiary text, arrows |
| `--accent` | `#a06840` | Active/selected state, slider thumb, primary button |
| `--accent-hover` | `#8a5530` | Accent on hover |
| `--accent-light` | `#f2e9de` | Selected option background in dropdowns |
| `--danger` | `#b83c3c` | Error messages |
| `--success` | `#4a7a50` | Upload success message |
| `--field-hover` | `#e8e1d6` | Field pill on hover |

### Shape & shadow

| Variable | Value | Used for |
|---|---|---|
| `--radius` | `6px` | Default border radius (fields, buttons, panels) |
| `--radius-lg` | `10px` | Larger panels (color picker, login card) |
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
│  │              │  │  aspect-ratio: 9/16           ││
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
