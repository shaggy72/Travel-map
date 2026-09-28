# Design System — "Color Stack"

All UI styles live in `webapp/src/styles.css`. No component library — hand-written CSS with a
small set of tokens. Introduced 2026-09-27 (see CLAUDE.md, "UI layout — Color Stack redesign").

---

## Design language

Editorial and bold: a black sidebar holding **full-width colour bands** (one per settings
group), a warm off-white **stage** for the preview, **big light type** for the route title and
the time counter, **black pills and round buttons** for actions, and **flat, borderless
controls** (value-bar sliders, soft fills, no outlines). Labels are never inside a box.

Inspirations the user supplied: colour-banded editorial app screens, a flat native settings
panel (value-bar sliders with a grip), black-pill mobile UIs.

---

## Tokens (`:root` in styles.css)

### Colour

| Token | Value | Used for |
|---|---|---|
| `--ink` | `#111111` | Text, black buttons, selected states, the sidebar |
| `--ink-muted` | `#5E5B55` | Secondary text on the ground (≈6:1) |
| `--on-band-2` | `rgba(17,17,17,0.72)` | Secondary text on a band colour |
| `--ground` | `#F0EFEA` | Stage / page background |
| `--paper` | `#FFFFFF` | Popovers, dropdown panels, white pills |
| `--line` | `rgba(17,17,17,0.14)` | Hairline dividers (rows, ruler, format list) |
| `--soft` / `--soft-hover` | `rgba(255,255,255,0.55)` / `0.8` | Control fill on a band colour |
| `--tag` | `#EEF23A` | "Live preview" tag, update pill, success banner |
| `--danger-bg` / `--danger` | `#FFE3DE` / `#8A1C0B` | Error messages |

### Band colours

| Band | Token | Value |
|---|---|---|
| 1 Route | `--band-route` | `#FFD45C` (yellow) |
| 2 Labels | `--band-labels` | `#F4B6EA` (pink) |
| 3 Line | `--band-line` | `#CDBDB5` (taupe) |
| 4 Map | `--band-map` | `#97ACE3` (periwinkle) |
| 5 Export | `--band-export` | `#FF6B2C` (orange) |

All text on bands is `--ink` (black), which clears 4.5:1 on every band colour. Use the
`.band--<id>` classes to paint a band (they're also reused by the login page).

### Type

- **Font**: Archivo (Google Fonts, weights 300–800), fallback Helvetica Neue / Arial.
- **Scale**:
  - 12.5–14px: controls, labels, captions
  - 22px: wordmark (800); format ratios (300, 700 when selected)
  - 34px: band titles (800, tracking −0.035em)
  - 36px: duration value (300)
  - 64px: time counter (300)
  - 66px: route title (300, tracking −0.04em); steps down to 52px / 40px for long names
  - 72px: login title (300)
- Numbers use `font-variant-numeric: tabular-nums`.

### Shape & size

- Controls: 36px tall, radius 12px (sliders, inputs, dropdowns) or fully round (toggles, icon
  buttons).
- Primary actions: black pills, 52–58px tall, with a round arrow badge on the right.
- Popovers and dropdown panels: radius 14–16px, white, soft shadow.
- `--sidebar-w`: 440px (390px ≤ 1200px wide). `--ctl-w`: 216px, the width of the control
  column in a row (190px ≤ 1200px, 180px on phones).

---

## Layout

```
┌──────────────────────┬──────────────────────────────────────────────────┐
│ Travel Map (brand)   │ [Preset ▾] (+)          [update pill]        (M) │
├──────────────────────┤                                                  │
│ 1 Route        Car ⟜ │  Live preview                                    │
│   rows…              │  Ghent                  ┌──────────┐             │
├──────────────────────┤  → Lauris*              │          │             │
│ 2 Labels  Animated ⌂ │  * By car · 9:16 · 5 s  │ preview  │             │
├──────────────────────┤  9:16  Portrait    (→)  │  frame   │             │
│ 3 Line       Solid ⟋ │  16:9  Landscape   (→)  │          │             │
├──────────────────────┤  …                      └──────────┘             │
│ 4 Map        Light ▦ │  Duration   (−) 05 s (+)                         │
├──────────────────────┤ ─┬──┬──┬──┬──┬──┬──┬──┬──┬── ruler ──┬──┬──┬──── │
│ 5 Export [Export →]  │  ▶  02.0 / 5.0 s          Preview runs in browser│
└──────────────────────┴──────────────────────────────────────────────────┘
```

Phones (≤ 760px): one scrolling column — brand bar, stage (preview left, title + 2×2 format
chips + duration right), timeline, bands, Export. Once the preview scrolls away it becomes a
**sticky bar** at the top (`.stage--pinned`: small frame left, ruler + play + time right,
slides in), so edits in any band stay visible.

---

## Components

### Band — `.band.band--<id>` (PropsForm.tsx `Band`)
Header button: number circle (`.band-num`), title (`.band-title`), two-line summary
(`.band-cap`: bold line + muted line), line icon. `aria-expanded` + `aria-controls`. Only one
band open at a time. Body `.band-body` holds rows.

### Row — `.row` (`Row`)
Label left (`.row-label`, plain text, never boxed), control right (`.row-control`, right-
aligned). Rows are separated by a hairline on top.

### Pill toggle — `.seg` / `.seg-btn` (`Seg`)
Black 1.5px outline, fully round; the selected option is a black pill with white text
(`aria-pressed="true"`). Icon variant: `.icon-group` / `.icon-toggle` — 36px round buttons,
selected = black with a white icon.

### Value-bar slider — `.slider` (`Slider`)
The pill *is* the track. `--fill` (percentage) drives `.slider-fill` (12% ink), a 2×14px grip
at the fill edge, five tick dots in the unfilled part, and the value on the right. A real
`<input type="range">` sits on top at `opacity: 0`, so drag, click and keyboard all work;
`:focus-within` draws the focus ring.

### Switch — `.switch` (`Switch`)
46×28, `role="switch"` + `aria-checked`. Off: 16% ink track; on: black track.

### Colour — `.color-control` (`ColorRow`)
Hex text + a 30px round swatch (`.cp-swatch`, the `ColorPicker` trigger button) that opens the
HSV panel (`.cp-panel`, `position: fixed`).

### Dropdown — `.ls-picker` / `.ls-trigger` / `.ls-panel` (`Picker`, `CountryPicker`)
Trigger is a 36px soft pill with an up/down chevron; panel is `position: fixed` (so the
sidebar can't clip it), right-aligned to the trigger, and dismisses on outside click / Escape.
Selected option: black row. Map styles show a colour dot (`.style-dot`), countries a flag.

### Buttons
- `.export-btn` / `.login-submit`: black pill with a round arrow badge.
- `.round-btn--dark` / `--outline`: 42px (36px in the duration stepper) round buttons.
- `.pill-btn`: white pill (preset switcher).
- `.btn-dark` / `.btn-ghost`: small actions inside popovers.

### Stage pieces
- `.tag`: yellow rounded label.
- `.route-title` (+ `--md` / `--sm`): huge light route title.
- `.format-row`: 54px list rows with a ratio, a description and a round arrow; the selected
  row has a bold ratio and a black arrow.
- `.frame-fit` + `.preview-frame`: container-query sizing, always the largest frame of the
  chosen ratio that fits.
- `.ruler`: tick ruler, `--played` shades the played part and positions `.ruler-head`.

### Popovers — `.popover` (+ `--right`)
Absolute, white, radius 16px. Used by the preset list, the save-preset form and the account
menu. Errors from presets appear as a `.toast` (fixed, top centre, dismissable).

### Login
Left: the five bands with huge cropped words ("Route / Plan it" …), each exactly 1/5 of the
viewport so the second line is cut off. Right: wordmark, 72px light title, stacked labelled
inputs (`.stack-field` + `.login-input`), black submit pill. On phones the bands become a
170px strip on top.

---

## App icon

The five band colours as horizontal stripes (route, labels, line, map, export — top to
bottom) with a black route curve and two end dots (white start, yellow destination).
Full-bleed square; iOS and Android apply their own rounding. The maskable Android variant
scales only the route to 72% so it stays inside the 80% safe zone. Files and regeneration:
README → "App icon".

---

## Adding a control

```tsx
<Row label="Width">
  <Slider value={props.lineWidth} min={1} max={30} label="Width" display={`${props.lineWidth} px`}
    onChange={v => upd('lineWidth', v)} />
</Row>
```

Use `RangeRow` / `ColorRow` shortcuts for the common cases. Toggles with two or three text
options → `Seg`; icon choices → `Seg variant="icons"` (give each option a `label`, it becomes
the `aria-label`); on/off → `Switch`; lists → `Picker`.

### Accessibility rules the design relies on
- Every control is a real `<button>`, `<input>` or `<select>`; icon-only buttons have
  `aria-label`.
- Toggle state is `aria-pressed`, `aria-checked` or `aria-expanded`, and CSS styles on those
  attributes (so visuals can't drift from state).
- Black text on every band colour; secondary text never lighter than `--on-band-2` /
  `--ink-muted`.
