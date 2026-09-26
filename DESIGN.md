# Design System

All UI styles live in `webapp/src/styles.css`. There is no external component library — everything is hand-crafted CSS using a shared set of design tokens.

---

## Design language

The UI uses the **tweakcn "Claude" theme** — a warm cream/white palette with Claude's signature terracotta orange as the accent colour. Colours are defined in [OKLCH](https://oklch.com/) colour space for perceptual uniformity. The sidebar is 320px wide (widened from 280px 2026-09-27 — see CLAUDE.md's "Sidebar visual redesign" entry — the narrower width truncated longer field labels), 11 px base font, to give as much space as possible to the map preview.

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
| `--danger` | `oklch(0.6368 0.2078 25.3313)` | `--destructive` (dark) | Error messages (login, render errors) — not upload/preset errors any more, see below |
| `--field-hover` | `oklch(0.9341 0.0153 90.2390)` | `--muted` | Field pill on hover |

`--success` was removed 2026-09-26 — its only use (`.upload-status.ok`) became a solid dark
pill instead (see "Form section" below), since a colour-tinted message text isn't guaranteed
legible against all 6 card colours the way white-on-dark always is.

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
| `--sidebar-w` | `320px` | Fixed sidebar width (280px until 2026-09-27) |

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  .layout  (display: flex, height: 100vh)            │
│  ┌──────────────┐  ┌───────────────────────────────┐│
│  │  .sidebar    │  │  .preview-panel               ││
│  │  320px wide  │  │  flex: 1                      ││
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

### Mobile layout (≤ 640px)

At 640 px and below the layout switches to a tab-based design. A `mobileTab` state in `App.tsx` (`'settings' | 'preview'`) drives a CSS class on `.layout`:

```
┌─────────────────────────┐
│  .sidebar  (full width) │  ← visible when mobileTab === 'settings'
│  or                     │
│  .preview-panel         │  ← visible when mobileTab === 'preview'
├─────────────────────────┤
│  .mobile-tab-bar        │  ← always visible (fixed at bottom)
│  [ ⚙ Settings ] [ ▶ Preview ]
└─────────────────────────┘
```

Key CSS rules inside `@media (max-width: 640px)`:
- `.layout:not(.layout--preview) .preview-panel { display: none }` — hides preview on Settings tab
- `.layout.layout--preview .sidebar { display: none }` — hides sidebar on Preview tab
- `.mobile-tab-bar { display: flex }` — shows the tab bar (hidden via `display: none` on desktop)
- `.mobile-render-area { display: flex }` — shows the Render button below the preview (hidden on desktop)
- `.preview-player-wrapper` — `height: auto`, `max-height: calc(100svh - 140px)` to avoid iOS chrome bar
- `min-height: 100svh` on `.login-page` — excludes iOS Safari chrome bar from viewport height

**`.mobile-render-area`** is a `display: none` wrapper on desktop. On mobile it appears below the preview player and contains the same "Render & Download MP4" button as the sidebar footer, wired to the same `handleRender` handler.

### Login card

`.login-card` uses `width: 100%; max-width: 360px` (not a fixed `width: 360px`) so it fills narrow viewports without overflowing. On mobile, `.login-field input` is set to `font-size: 16px` — below 16 px iOS Safari auto-zooms the viewport on input focus, which is disorienting on a centered card.

**Restyled 2026-09-26** alongside the auth overhaul (email+password, self-registration — see
CLAUDE.md's "Authentication" section): the card itself is now the "Travel route" burnt-orange
(`#DD6B3B`), same light-on-colour pattern as the sidebar's section cards — white/near-white
text and labels, white `.field`-style inputs, and (since a solid orange `.btn-primary` would
have no contrast against an already-orange card) an *inverted* primary button — white
background, orange text — scoped via `.login-card .btn-primary`. `.login-error`/`.login-banner`
are solid white pills with semantically-coloured text (red for errors, green for the
"?verify=ok" success banner), same reasoning as `.upload-status`/`presetError` elsewhere: a
colour-tinted background isn't guaranteed legible the way white-on-solid always is. `LoginPage`
now has three states (`mode`: `'login' | 'register' | 'registered'`), toggled by `.login-switch`
links, plus a one-time `?verify=` banner read from the confirmation-link redirect.

**Field styling fix (same day, follow-up)**: the initial white `.field`-style inputs had no
visible border and were the same generic small size as every other input in the app — on the
solid orange card, a real browser screenshot showed Chrome's autofill background (its own
yellow/orange tint) fighting with the card colour, rendering as a muddy brownish box instead of
white. Fixed with the standard `:-webkit-autofill` override (`-webkit-box-shadow: 0 0 0 1000px
#fff inset` + a very long `transition-delay` to stop Chrome re-asserting its own background) and
gave `.login-field input` its own explicit styling instead of inheriting the app-wide compact
input rule: `border: 2px solid #000` (a real visible black border, as asked — this card's
inputs are the only ones in the app with a border at all, everywhere else relies on the white
pill's own contrast against a neutral background) plus larger `padding`/`font-size` (12px 14px /
15px vs. the app-wide 5px 8px / 10px).

---

## Typography

- **Font**: Poppins (Google Fonts, weights 400/500/600/700/800), fallback to system-ui —
  switched from Inter 2026-09-26 alongside the login/sidebar card redesign: rounder and
  friendlier, closer to the reference design the user asked to match. Site-wide, i.e. the
  webapp UI chrome only — the rendered video's own label fonts (`labelFont`/`cityFont` props:
  Helvetica/Inter/Georgia/Oswald/Merriweather) are a separate per-render user choice and
  untouched by this.
- **Base size**: 11px on `html/body` — everything else is relative to this
- **Scale in use**: 8px (tiny labels) / 9px (picker internals) / 10px (field labels and values) / 11px (font preview) / 13px (login form) / 14px (section titles, bumped from 12px 2026-09-27) / 18px (sidebar heading "Travel Map", bumped from 12px 2026-09-27 — see CLAUDE.md's "Sidebar visual redesign" entry)
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
  padding: 0 14px 0 10px;
  min-height: 30px;
  margin-bottom: 6px;
}
.field > label { width: 46%; flex-shrink: 0; color: var(--text-muted); }
```

The label takes 46% of the width (bumped from 38% 2026-09-27 — even at the wider 320px sidebar, 38% still ellipsised the longest label, "Transport marker"). The control (`input`, `.range-row`, `.color-row`, `.radio-group`, `.ls-picker`) takes `flex: 1`.

**Two-column layout** — wrap two fields in `.field-row` (CSS grid, 2 equal columns):
```jsx
<div className="field-row">
  <div className="field">...</div>
  <div className="field">...</div>
</div>
```

---

### Form section — `.form-section` (colourful card, redesigned 2026-09-26)

Groups related fields. Each of the 6 sections is now a bold, color-blocked rounded **card**
(one accent colour per section, `--card-color` set by a `.form-section--<id>` modifier class)
rather than a plain header on the neutral sidebar background — see CLAUDE.md's "Sidebar visual
redesign" entry for the full rationale (a user-provided reference screenshot + a Design-canvas
mockup with 3 options, user picked this one: keep the collapsible behaviour exactly, just
reskin it). Section body is still toggled by a `.section-title` button, now with an icon +
title + one-line summary of the current settings.

```jsx
<div className="form-section form-section--trackLine">
  {/* title is a <button> — clicking it calls toggle(id) */}
  <button className="section-title" onClick={() => toggle('trackLine')} aria-expanded={isOpen('trackLine')}>
    <span className="section-icon"><TrackLineIcon /></span>
    <span className="section-title-text">
      <span className="section-title-main">Track line</span>
      <span className="section-summary">{trackLineSummary}</span>
    </span>
    <span className={`section-chevron${isOpen('trackLine') ? ' open' : ''}`} aria-hidden="true">▾</span>
  </button>

  {/* body animates open/closed via a max-height transition */}
  <div className={`section-body${isOpen('trackLine') ? ' section-body--open' : ''}`}>
    <div className="section-body-inner">
      <div className="field">...</div>
    </div>
  </div>
</div>
```

**Colour per section** (`webapp/src/styles.css`) — replaced with a systematic OKLCH ramp
2026-09-27 (the original 6 hex values were picked by eye; mustard and tan sat only a few
degrees apart and didn't read as one family). All 5 content cards now share the same
lightness (64%) and chroma (0.09), only hue rotates: Presets `oklch(64% 0.09 165)` (teal),
Travel route `oklch(64% 0.09 45)` (orange), Labels `oklch(64% 0.09 125)` (green), Track line
`oklch(64% 0.09 85)` (olive), Map style `oklch(64% 0.09 235)` (blue). Export is a deliberate
exception — `oklch(55% 0.015 250)`, desaturated near-neutral, since it's a utility/output step
rather than a content category. Independent of the sidebar's own neutral "Claude" theme tokens
(`--bg`, `--sidebar-bg`, etc.), which this redesign left untouched.

**Why most fields needed zero changes**: `RangeField`, `ColorField`, text inputs, `ls-picker`
dropdowns and `radio-group`s nested inside `.field` already render as **white pills** — already
isolated from whatever's behind them. Only elements that sit directly on the card background
(not wrapped in `.field`) needed a light-on-colour variant: `.section-title` itself,
`.subsection-label`/`.city-tier-label` (the "Elevation profile"/"City labels" inline
sub-headings — see "Subsection" below), `.upload-area`, and `.upload-status`/`presetError`
(now solid dark pills, `rgba(0,0,0,0.22)` background + white text, rather than a colour-tinted
text that isn't guaranteed legible against all 6 card colours).

**Section icons** (`.section-icon` — a 30px circle, `rgba(255,255,255,0.22)` background):
Material Symbols, same pattern as the travel-mode icons (`CarIcon` etc. in `PropsForm.tsx`) —
`bookmark` (Presets), `route` (Travel route), `sell` (Labels), `timeline` (Track line), `map`
(Map style), `download` (Export). The font is a curated subset requested by name in
`webapp/index.html`'s `icon_names` query param — a new icon needs adding there or it silently
fails to render.

**Header summary** (`.section-summary`, e.g. "Car · Ghent → Lauris"): one `const ...Summary`
per section, computed in `PropsForm` from `props` right before the JSX return, reusing existing
option-label lookups (`MAP_STYLE_OPTIONS.find(...)` etc.) where available. Shown both collapsed
and expanded.

**Collapse state** is a `Set<string>` in `PropsForm` (`closed`), toggled by `toggle(id)`.
Default closed: `presets`, `labels`, `map`, `export`. Default open: `travelRoute`, `trackLine`.

**Render button vs. Travel route card** (2026-09-27): `.sidebar-footer .btn-primary` (scoped —
not the global `.btn-primary`) overrides the background to a near-black `oklch(22% 0.01 250)`.
The global `--accent` orange sits in the same hue family as the Travel route card, so the
"Render & Download MP4" button used to blend into it instead of reading as a separate action.

The Track line section also contains the **Transport marker** control — a `MarkerPicker`
dropdown (same `ls-picker` pattern) followed by a conditional size slider when a marker is active.

**CSS animation** uses `max-height` + `overflow: hidden` (battle-tested approach):
```css
.section-body        { overflow: hidden; max-height: 0;      transition: max-height 0.22s ease; }
.section-body--open  { max-height: 1500px; }
.section-body-inner  { padding: 0 14px 14px; }
```
The CSS grid `0fr` technique was tried first but causes the first child's 1px border to bleed past the collapsed track in some browsers regardless of `overflow: hidden` settings. `max-height: 0` clips unconditionally. 1500px is a safe ceiling above the tallest possible section.

**Chevron** (`.section-chevron`) sits after the title/summary text block (flex row, `gap: 11px`
for the whole header). White/near-white (`rgba(255,255,255,0.85)`) since the card redesign — it
used to be `var(--text-light)` on the neutral background. Rotates from −90° (▸, collapsed) to
0° (▾, open) with a 0.18s ease transition, 11px.

### Subsection — `.subsection-label` / `.city-tier-label`

An inline sub-heading inside a merged section (e.g. "Elevation profile" inside Travel route,
"City labels" inside Map style, or the "Big"/"Medium"/"Small" city tiers inside that). Light-
on-colour (`rgba(255,255,255,0.75)` text, `rgba(255,255,255,0.22)` top border) since these sit
directly on the card background like `.section-title`, not wrapped in a white `.field` pill.
Not independently collapsible — always visible when their parent section is open.

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

### Update banner — `.update-banner`

Appears inside `.sidebar-header` when a new GitHub commit is detected. Hidden (`updateState === 'idle'`) otherwise. Four visual states driven by `updateState` in `App.tsx`:

| State | Class modifier | Colour | Content |
|---|---|---|---|
| `available` | `--available` | amber | "🔄 Update available [Install]" |
| `updating` | `--updating` | amber | spinner + "Installing update…" |
| `restart-needed` | `--restart-needed` | green | "✅ Updated. [Restart now]" |
| `restarting` | `--restarting` | neutral | spinner + "Restarting…" |

The inline **Install** / **Restart now** buttons use `.update-banner button` (accent background, not `.btn`). Install is disabled while a render is in progress. After restart the client polls `GET /api/me` every 2 s and reloads when the server responds. `.spinner--dark` is a modifier for the standard `.spinner` that works on light (non-white) backgrounds.

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
