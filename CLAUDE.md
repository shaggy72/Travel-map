# Travel Map Animation — Claude Code memory

## Standing instructions
- With **every code change**: update docs (README.md / DESIGN.md) and add inline comments
- Commit after every logical change, push to GitHub immediately after
- Repo: https://github.com/shaggy72/Travel-map

## Project overview
Web app that renders travel-route animations as MP4 videos via Remotion v4.
- **Webapp** (Vite 8 + React 18): config sidebar + live Remotion preview → http://localhost:5173
- **Server** (Express, port 3002): session auth, GPX uploads, Remotion render pipeline
- **Animation** (Remotion): `MapComposition.tsx` renders SVG frames headlessly → MP4

Start dev: `npm run dev` (starts both servers concurrently)

## Key files
| File | Role |
|---|---|
| `src/schema.ts` | Zod schema — single source of truth for all animation props |
| `src/MapComposition.tsx` | Remotion animation; uses `useVideoConfig()` for dynamic canvas size |
| `src/mapData.ts` | Projection utils, URL builders, `getDimensions()`, `buildFlightArc()` |
| `src/useMapboxImages.ts` | Hooks: `useMapboxImage`, `useGeocode`, `useGpxTrack`, `useRoute`, `useFlagImage` |
| `src/countryData.ts` | Static `COUNTRIES` list (ISO 3166-1 alpha-2 code + name) powering the country picker |
| `src/easing.ts` | Timing/easing utilities (`easeInOutCubic`, `windowT`, `interpolateEased`, …) |
| `src/Root.tsx` | Remotion composition root; `calculateMetadata` sets dynamic width/height |
| `server/index.cjs` | Express: GPX upload, Remotion render, auto-update endpoints, serves `webapp/dist` in prod; wires in `server/auth.cjs` |
| `server/auth.cjs` | Email+password auth: `initAuth(dataDir)` → login/register/verify-email/change-password/logout/me routes, bcrypt, Resend confirmation email, in-memory sessions |
| `webapp/src/App.tsx` | Root React app; auth state (now tracks `userEmail`); mobile tab switcher; update banner (`updateState`); change-password panel toggle |
| `webapp/src/LoginPage.tsx` | Sign-in + registration (toggled `mode` state) + `?verify=` banner from the confirmation-link redirect |
| `webapp/src/ChangePasswordPanel.tsx` | Small form toggled from the sidebar header, `POST /api/change-password` |
| `webapp/src/PropsForm.tsx` | Full sidebar form — all sections collapsible via `closed` Set state |
| `webapp/src/types.ts` | TypeScript mirror of schema + `DEFAULT_PROPS` |
| `webapp/src/PreviewPlayer.tsx` | Remotion `<Player>` wrapper; dynamic `compositionWidth/Height`; plays via `useEffect` |
| `src/routeIcons.tsx` | `RouteMarkerIcon({ type })` — official Material Symbols glyphs (car/camper/plane/bike/walk) as white SVG silhouettes for the route tip badge |
| `webapp/src/styles.css` | All CSS — design tokens (OKLCH) + mobile rules + update banner |
| `webapp/src/ColorPicker.tsx` | Custom HSV color picker |
| `deploy.sh` | One-command deploy to Debian/Ubuntu/Mint server |

## Environment variables (.env — gitignored)
```
MAPBOX_TOKEN=pk.eyJ1Ijoic2hhZ2d5NzIi...   # required
MAPBOX_STYLE=shaggy72/cmpma5agg000101qr4tt68gad  # optional, falls back to mapbox/light-v11
RESEND_API_KEY=re_...                     # required — account-confirmation emails, see "Authentication" below
APP_URL=https://travelmap.luyens.be       # required in production — confirmation-link base URL
PORT=3002
```
`APP_USERNAME`/`APP_PASSWORD` were removed 2026-09-26 — see "Authentication" below.

## Architecture patterns
- **Props flow**: `PropsForm` → `App` state → `PreviewPlayer` (live preview) + `POST /api/render` (MP4)
- **Canvas dimensions**: `getDimensions(outputFormat)` → `{w, h}` passed to `buildProjection`, `buildMapUrl`, `calcZoomAndCenter`; component reads `width`/`height` from `useVideoConfig()`
- **Async Remotion data**: all hooks use `delayRender`/`continueRender`; `cancelled` flag pattern prevents stale results
- **Route sources**: Mapbox Directions (driving) / routing.openstreetmap.de routed-bike/foot (cycling/walking) / `geoInterpolate` arc (flight — no API)
- **Mobile layout**: `mobileTab` state in `App.tsx`, `layout--preview` CSS class, `@media (max-width: 640px)` tab switcher; mobile render button in `.mobile-render-area`

## Design system — tweakcn "Claude" theme
All tokens in `webapp/src/styles.css :root` (OKLCH colour space):
- `--accent`: `oklch(0.6171 0.1375 39.0427)` — Claude orange (active, slider, button)
- `--bg`: `oklch(0.9818 0.0054 95.0986)` — preview panel background
- `--sidebar-bg`: `oklch(0.9663 0.0080 98.8792)` — sidebar background
- `--field-bg`: `oklch(1.0000 0 0)` — pure white field cards
- `--radius`: `0.5rem` (~8 px)
- Source: https://tweakcn.com/r/themes/claude.json
- Never hardcode colours — always use CSS variables
- `--font`: **Poppins** (was Inter until 2026-09-26 — user asked to switch site-wide, to look
  more like the rounded/friendly reference design behind the card redesign). Loaded in
  `webapp/index.html`'s Google Fonts link, weights 400–800. Only the webapp UI chrome — the
  rendered video's `labelFont`/`cityFont` props are a separate, unrelated font choice.

## Travel modes (travelMode prop)
| Value | Route source |
|---|---|
| `driving` | Mapbox Directions API |
| `cycling` | routing.openstreetmap.de/routed-bike (NOT router.project-osrm.org — car-only!) |
| `walking` | routing.openstreetmap.de/routed-foot |
| `flight` | `buildFlightArc()` via d3-geo `geoInterpolate` — no API, instant |

## Output formats (outputFormat prop)
| Value | Dimensions | Aspect |
|---|---|---|
| `portrait` | 1080 × 1920 | 9:16 |
| `landscape` | 1920 × 1080 | 16:9 |
| `square` | 1080 × 1080 | 1:1 |

Preview aspect ratio set inline in `App.tsx`; removed from CSS.

## Form section order + structure (PropsForm.tsx)
Reorganized 2026-09-26 (user request, from a pasted outline) — 6 sections, down from 10:
1. **Presets** — save/load named configurations (server-side, `GET/POST/DELETE /api/presets`)
2. **Travel route** — merges the old Mode + Route + GPX file + Elevation profile sections.
   A `mode` radio toggle (Directions / GPS track) at the top reveals only the relevant
   fields below it:
   - *Directions*: Travel mode icons (Car/Bike/Walk/Fly) → Arc curve (Fly only) → Start
     address → End address
   - *GPS track*: Select track → Upload new GPX → an inline "Elevation profile" sub-group
     (`.subsection-label`, GPS-track-only — show/hide, colours, position/size %) — this
     used to be its own independently-collapsible top-level section
3. **Labels** — merges the old Route labels section with the start/end country+city fields
   that used to be **duplicated** between Route (Directions) and GPX file — now a single
   shared set of fields regardless of `mode`: Show (labelMode, relabelled On/Off/Animated →
   **Yes/No/Animated**) → Animation (Animated only) → Start country/city → End country/city
   → Font → Background → Text color
4. **Track line** — unchanged, except "End marker"/"Marker size" fields relabelled
   **"Transport marker"/"Transport marker size"** to match the user's outline
5. **Map style** (renamed from "Map") — merges the old Map section with City labels as an
   inline "City labels" sub-group (`.subsection-label`) — also no longer independently
   collapsible. Field relabelled Style → **Map type**.
6. **Export** (renamed from "Animation") — Format + Duration, unchanged content

**All sections are collapsible.** Default open: Travel route, Track line. Default closed:
Presets, Labels, Map style, Export. Elevation profile and City labels don't have their own
open/closed state any more — they're always-visible inline sub-groups (separated by a
`.subsection-label` sub-heading with a top border) within their new parent section, not
separate accordions. If either grows dense enough to warrant its own collapse again, that's
a deliberate follow-up, not an oversight.
- State: `const [closed, setClosed] = useState<Set<string>>(() => new Set([...]))` in `PropsForm`
- Toggle button: `<button className="section-title">` with `<span className="section-chevron">` before the label text
- Body: `.section-body` + `.section-body-inner`; collapse uses `max-height: 0` / `overflow: hidden` (NOT CSS grid 0fr — that causes 1px border bleed in some browsers)

## Sidebar visual redesign — colourful cards ("Option C", 2026-09-26)
Each of the 6 sections above is now a bold, color-blocked rounded card instead of a plain
header on the neutral sidebar background. User showed a reference screenshot (a finance app's
stacked-card UI) and asked to redesign the sidebar to match; three directions were mocked up
first as a Design-canvas artifact (full peek-stack deck / soft scrollable list / colourful
accordion) — user picked the accordion ("C"): keeps today's expand/collapse behaviour exactly,
nothing hidden behind swipes, just reskinned.

- **Palette** (`webapp/src/styles.css`, one `--card-color` per `.form-section--<id>` modifier
  class): Presets `#8FA69C` (dusty teal), Travel route `#DD6B3B` (burnt orange), Labels
  `#6E7F52` (olive green), Track line `#B69A5C` (tan), Map style `#D4A24C` (mustard), Export
  `#6B7280` (slate) — matches the picked mockup, distinct from the sidebar's own neutral
  "Claude" theme tokens (which are otherwise untouched — this redesign only touches the section
  cards, not the preview panel or other chrome).
- **Why this was a smaller change than it looked**: almost every control (`RangeField`,
  `ColorField`, text inputs, `ls-picker` dropdowns, `radio-group`s nested in `.field`) already
  renders as a **white pill** via the existing `.field` class — that was already isolated from
  whatever sits behind it, so none of those needed any changes at all. Only things that sit
  **directly** on the card background (not wrapped in `.field`) needed light-on-colour styling:
  the new `.section-title` header (icon + title + summary + chevron, all white/near-white),
  `.subsection-label` and `.city-tier-label` (Elevation profile / City labels sub-headings),
  `.upload-area` (GPX upload), and `.upload-status`/`presetError` (now solid dark
  `rgba(0,0,0,0.22)` pills with white text — chosen specifically because their old colour-tint
  approach (`var(--success)`/`var(--danger)` text) isn't guaranteed readable against every one
  of the 6 card colours, whereas white-on-dark-pill always is, regardless of the surrounding
  card).
- **Section icons**: Material Symbols (same font/pattern as the travel-mode icons — see
  `CarIcon` etc.), added to the existing font subset request in `webapp/index.html`'s
  `icon_names` query param (was `directions_bike,directions_car,directions_walk`, now also
  `bookmark,route,sell,timeline,map,download`) — expanding this list is required, the font is
  a curated subset, not the full Material Symbols set. One `<span className="section-icon">`
  wrapper per header gives it the translucent white circle backing seen in the mockup.
- **Header summary line** (e.g. "Car · Ghent → Lauris", "Animated", "Dotted · 10px"): computed
  inline in `PropsForm` right before the `return`, one `const ...Summary` per section, reusing
  existing option-label lookups (`MAP_STYLE_OPTIONS.find(...)`, `LINE_STYLE_OPTIONS.find(...)`,
  `LABEL_MODE_OPTIONS.find(...)`) plus two new small local maps (`TRAVEL_MODE_LABEL`,
  `OUTPUT_FORMAT_LABEL`) for the two prop sets that didn't already have an options array. Shown
  both collapsed and expanded, matching the mockup's "see the current value without opening
  the card" pattern. Not a live "does this match a saved preset" check — `presetsSummary` just
  shows the last-applied preset's name via the existing `selectedPresetId`, same simplification
  as the `PresetPicker` trigger label above.
- **Verified locally before shipping**: spun up the real server (`node server/index.cjs`) with
  a throwaway `.env` (fake `MAPBOX_TOKEN`, default `admin`/`changeme` credentials — deleted
  after, never committed), logged in, and screenshotted every card open/closed in the actual
  running app rather than a static mockup — worth doing again for any layout change this size,
  since contrast/spacing issues in a real flex layout with live data (long preset names, actual
  field values) don't always show up in a hand-written HTML mockup.

## Props defaults (key values)
- `lineWidth`: default **10**, min 1, max **30** (in schema.ts, types.ts, PropsForm slider)
- `routeMarker`: default **'none'** — set to 'car'|'camper'|'plane'|'bike'|'walk' to show animated badge
- `routeMarkerSize`: default **60** (badge diameter in canvas pixels), min 20, max 120
- `dotted` line style gap: `0 ${lineWidth * 1.8}` — dots are SVG round linecaps with strokeDasharray spacing

## Elevation profile (showElevationProfile prop)
- Only rendered when `mode === 'gpx'` and the GPX file contains `<ele>` tags on every trackpoint
- `useGpxTrack` now returns `GpxData { track, elevations }` — elevations is empty if any `<ele>` is missing
- Box position and size driven by `elevationLeft/Top/Width/Height` (all % of canvas dimensions) → adapts to all output formats
- Chart fills left-to-right in sync with `visibleCount` — same animation progress as the route line
- Y-axis scale fixed to full route min/max so the scale doesn't jump during animation
- `elevationBgColor` defaults to `#ffffffcc` (semi-transparent white via 8-char hex)

## Authentication (server/auth.cjs, added 2026-09-26)
Replaced the old single shared `APP_USERNAME`/`APP_PASSWORD` account with email+password,
self-registration (anyone can sign up), and per-account presets — user request, explicitly
modelled on `costa-rica-trip`'s `server/auth.js` pattern (bcrypt + a JSON user store +
`express-rate-limit` + Resend for the confirmation email), simplified: no
admin/participant/supporter roles (every account is equal — Travel Map has no admin-only
actions to gate), and no "forgot password" flow (deliberate scope cut, not an oversight —
add one later following the same reset-token-hash pattern `costa-rica-trip` uses if needed).

- **`initAuth(dataDir)`** returns `{ requireAuth, registerAuthRoutes, loadUsers, saveUsers }`.
  `requireAuth` attaches `req.user` (the full user record) on success — every route that needs
  the current account (presets, later anything else) reads `req.user.email` instead of a fixed
  constant.
- **Users**: `server/data/users.json` — `{ id, email, passwordHash (bcrypt, 12 rounds),
  verified, verificationTokenHash, verificationTokenExpiry, createdAt }`. Token stored only as
  a SHA-256 hash (same reasoning as `costa-rica-trip`: reading the file — e.g. in a backup —
  can't produce a working confirmation link).
- **Sessions**: same lightweight in-memory `Map` the old single-account version already had
  (`token → data`, no `express-session` dependency despite it being in `package.json` — unused
  leftover) — just now the value is `{ email, createdAt }` instead of a bare timestamp, so
  `requireAuth` can look up which account a session belongs to. 7-day expiry, unchanged. Still
  doesn't survive a `pm2 restart` — see "Restart button" in Key bug fixes below; this is a
  *bigger* deal now than under the old single-account model, since every registered user gets
  logged out on every deploy, not just one shared account.
- **Registration**: `POST /api/register` — creates the account immediately (`verified: false`)
  and emails a confirmation link via Resend (`from: 'Travel Map <travelmap@luyens.be>'` — same
  `@luyens.be` domain `costa-rica-trip` already sends from, so the same Resend account/API key
  works, no new domain verification needed). If the Resend call fails, the account is **not**
  rolled back — same tradeoff `costa-rica-trip` makes, since a re-registration attempt would
  otherwise just hit "email already registered" with no way to retry the mail.
- **Login**: `POST /api/login` — blocked with 403 until `verified: true`.
- **Verification**: `GET /api/verify-email?token=...` — not an API call from the SPA, a direct
  browser navigation from the email link. Redirects to `/?verify=ok|invalid|expired|missing`;
  `LoginPage.tsx`'s `useVerifyBanner()` reads that param once on mount, shows a banner, then
  strips it via `history.replaceState` so a refresh doesn't re-show it. Only rendered on the
  login page — a user who's *already logged in* (e.g. clicking a confirmation link for a
  second account in the same browser) won't see the banner, since `App.tsx` skips `LoginPage`
  entirely once `auth === 'logged-in'`. Known gap, not fixed — rare enough not to be worth the
  complexity of surfacing it elsewhere too.
- **Change password**: `POST /api/change-password` (requires current password) — UI is
  `ChangePasswordPanel.tsx`, toggled from a link in `App.tsx`'s sidebar header.
- **Verified locally before shipping**: ran the real server with a throwaway `.env` (no real
  `RESEND_API_KEY` — deliberately, to test the "mail failed but account still created" path),
  registered a test account through the actual UI, confirmed the graceful-failure error message
  renders correctly, then drove the rest of the flow (login-blocked-until-verified, manually
  flipping `verified: true` in `users.json` to simulate clicking the email link, successful
  login, change-password wrong/right-current-password cases, the `?verify=ok` banner) via
  direct `fetch()`/JS calls in the browser console rather than simulated clicks — the browser
  automation tool was unreliable at clicking precise coordinates on this page in this session,
  but that's an environment quirk, not a rendering bug (confirmed by cross-checking `element
  .getBoundingClientRect()` against click coordinates), and it doesn't affect a real user
  clicking normally. Test account/`.env` deleted after.

## Presets (server-side)
- Stored in `server/data/presets-<sanitized-email>.json` — one file per registered account
  (was a single shared `presets-<APP_USERNAME>.json` before the 2026-09-26 auth change).
  `sanitizeEmailForFilename()` in `server/index.cjs` lowercases and replaces every non-`[a-z0-9]`
  character with `_`.
  **Migration note**: the pre-existing `presets-micha.json` (the owner's real presets, from
  before self-registration existed) was **not** automatically migrated — there was no way to
  know in advance which email the owner would register with. After registering, manually `cp
  server/data/presets-micha.json server/data/presets-<new-sanitized-email>.json` on the VPS (or
  the user just re-adds presets from scratch, which was flagged as an explicit tradeoff of the
  "per-account presets" choice when asked).
- Three endpoints: `GET /api/presets`, `POST /api/presets`, `DELETE /api/presets/:id`
- Client loads on mount via `useEffect`; save/delete are optimistic (updates local state immediately on 200)
- Saves ALL props — including route addresses, GPX file, colours, fonts, elevation settings, etc.
- **Delete confirmation** (added 2026-09-25, after a data-loss incident: a user's "Air France"
  preset was silently wiped, presumably an accidental click — the `×` delete button sat right
  next to the "Apply" button with no confirmation): the delete button now calls
  `window.confirm(...)` before hitting `DELETE /api/presets/:id`.
- **Rolling backup** (added same day, same incident — there was no way to recover the lost
  preset, not even a stale copy anywhere on the VPS): `writePresets()` in `server/index.cjs`
  copies the current file to `presets-<USERNAME>.json.bak` before every write (POST or
  DELETE). Only one backup generation is kept (overwritten on each write) — good enough to
  undo the *last* accidental delete, not a full history. To restore: `cp
  server/data/presets-<USERNAME>.json.bak server/data/presets-<USERNAME>.json` then restart.
- **Silent-failure bug found the same day**: right after the incident above, the user clicked
  "Save" to recreate the preset and nothing happened — no error, no saved preset. Root cause:
  `handleSavePreset`/`handleDeletePreset` only checked `r.ok` and did nothing on failure (no
  error UI, no `try/catch` around `fetch`). We had restarted the `travel-map` pm2 process 4×
  in the preceding ~15 min for unrelated deploys; sessions are in-memory (see "Restart button"
  entry in Key bug fixes below), so the user's session had silently expired and every request
  was returning 401. Fixed by adding a `presetError` state shown in the Presets section, with
  a specific "session expired, refresh and log in again" message for 401 and a generic one for
  other failures/network errors. **General lesson**: any `fetch()` call gated by `requireAuth`
  needs visible error handling, not just a `r.ok` happy-path check — a stale session after a
  deploy is a realistic, recurring failure mode in this app, not an edge case.
- **UI redesign to a dropdown** (2026-09-26, user request — wanted a dropdown "zoals moderne
  apps" instead of an always-expanded stack of buttons, one per preset): the preset list now
  lives inside a `PresetPicker` component (`webapp/src/PropsForm.tsx`), reusing the same
  `ls-picker` combobox pattern as `MapStylePicker`/`CountryPicker`/etc — trigger button shows
  the last-applied preset's name, opens a dropdown panel listing all presets. Per user's
  explicit choice (asked directly rather than assumed): the delete "×" stays **inline in each
  dropdown row**, not moved to a separate control. "Save current settings…" stays as its own
  button below the picker — saving a new preset is a different action from selecting an
  existing one.
  - Each row is a `<div className="ls-option ls-option-row">` (not a single `<button>` like
    the simpler pickers) containing two independent buttons: `.ls-option-apply` (flex:1,
    `min-width:0` + `overflow:hidden`/`text-overflow:ellipsis` so long names truncate instead
    of forcing the row wider than the panel) and `.ls-option-delete` (flex-shrink:0). New CSS
    in `styles.css`.
  - `selectedPresetId` (local state) drives the trigger label — it's a "last choice" indicator
    only, not a live check that the current props still match that preset exactly (same
    simplification every other `ls-picker` in this file already makes).
  - **Testing gotcha for next time**: a quick static-HTML mockup of this component (outside
    the real app, to sanity-check the row layout before shipping) initially seemed to show the
    delete button completely missing. Root cause was the mockup using `position: static` for
    the panel instead of the real component's `position: fixed` with an explicit pixel
    `width` — under `position: static`, the row's flex content overflowed its container
    instead of being properly constrained. Switching the mockup to `position: fixed` + a fixed
    width (matching the real component) reproduced the correct, working layout. If a future
    icon/layout check via a standalone HTML file gives a suspicious result, double-check the
    mockup's positioning context matches the real component's before concluding there's an
    actual bug.

## Map styles (MAP_STYLE_OPTIONS in PropsForm.tsx)
- `shaggy72/cmpma5agg000101qr4tt68gad` — Gray (custom)
- `shaggy72/cmqf8b53y001g01sc9lsh67db` — Topographic (contours + water only, with hillshade)
- `shaggy72/cmqf94fhu003q01qw4m5e4fpk` — Topo v2 (adds land-use colours: urban/grass/wood/rock/protected areas)
- `shaggy72/cmugrbhnu000801s01q212pyn` — Air France (dark monochrome, inspired by the Air France in-flight wifi map: land `#313645`, water `#181B26`, faint country borders `#41454F` at 60% opacity, no labels/roads)
- Source JSON files: `mapbox-topo-style.json`, `mapbox-topo-style-v2.json`, `mapbox-navy-style.json`
- Custom styles are created by editing the source JSON (Mapbox Style Spec v8) and uploading it manually in Mapbox Studio (or via `POST https://api.mapbox.com/styles/v1/shaggy72` with a `styles:write` secret token)
- Standard Mapbox styles: streets-v12, outdoors-v12, light-v11, dark-v11, satellite-streets-v12, none

## Flight arc curve (flightCurve prop)
- Only active when `travelMode === 'flight'`
- Applied **in screen space** after projecting the great-circle points
- Lifts each point perpendicular to the start→end chord by `sin(π*t) * maxLift`
- `maxLift = (flightCurve/100) * chordLength * 0.5` — so value 100 = half-chord lift
- Perpendicular direction: CW rotation of chord `(dy/len, -dx/len)` = upward on screen for east-west routes (conventional flight-path look)
- Slider (0–100, step 5) shown in PropsForm only when `travelMode === 'flight'`

## Route tip marker / "End marker" (src/routeIcons.tsx + MapComposition.tsx)
A circular badge with a white vehicle icon follows the leading point of the route line as it draws.

- **Icon rotation** (added 2026-09-25, user request: *"kun je de orientatie van de end marker
  aanpassen aan de richting van de lijn? Dit moet niet constant veranderen... in grove lijn"*):
  `markerAngle = atan2(y1-y0, x1-x0)` in degrees, from the **first and last** points of the
  full `routePoints` array (the final curved/projected path, not the animating `visiblePts`
  subset) — computed once, identical every frame, so the icon has a fixed heading for the
  whole video instead of jittering as the line locally turns. Explicitly *not* a
  continuously-updating per-segment heading — the user asked for "roughly right", not
  frame-accurate.
- **Rotate vs. mirror, per icon type** (same day, follow-up bug report: *"als de track van
  rechts naar links loopt staat de auto op z'n kop"*): only `'plane'` gets the full
  `rotate(${markerAngle})` — it's a top-down icon with no inherent "up", so any bearing
  (including pointing south / "upside down" relative to the screen) reads correctly, same as a
  real flight-tracker app. The other types (`car`/`camper`/`bike`/`walk`) are side/front views
  with a real up = sky, down = ground — rotating one ~180° for a right-to-left route flipped it
  upside down. Those are mirrored horizontally instead: `markerFacingLeft = Math.abs(markerAngle)
  > 90`, applied as `scale(markerFacingLeft ? -markerScale : markerScale, markerScale)` — stays
  upright either way, just faces the other direction. Verified both cases (mirror + a couple of
  plane rotation angles) by rendering in a browser before shipping.
  Applied on the icon's own `<g>` only, not the badge `<circle>` (rotating/mirroring a circle is
  a no-op, and keeping it separate means the circle's positioning math elsewhere is untouched).

- **Badge colour**: fixed `MARKER_BADGE_COLOR = "#313645"` (dark navy, "Air France" palette) —
  changed 2026-09-25 from `lineColor` to a fixed colour, since the reference badge (plane icon
  on the in-flight wifi map) is dark navy regardless of the route line's own colour (white
  dotted line there). Applies to **all** vehicle types, not just the plane icon — this was a
  full replacement of the old lineColor-tied style, not a new toggle/option.
- **Badge opacity**: `MARKER_BADGE_OPACITY = 0.78` (added same day, same feedback round) — the
  reference badge is a soft translucent circle, not solid; applied via `fillOpacity` on the
  badge `<circle>` only (icon silhouette itself stays fully opaque white).
- **All 5 icons replaced with official Material Symbols glyphs** (2026-09-25, two-step
  feedback round): first the plane alone was rebuilt by hand (5 shapes: fuselage + main wings
  + tail wings) after *"nu lijkt een vliegtuig meer op een vis"* — an improvement, but still
  hand-drawn. User then asked directly: *"gebruik je nu voor alle mogelijkheden de officiële
  google material symbolen? Zo niet, pas dat aan"* — so **all** hand-drawn icons (car, camper,
  bike, walk; plane was redone again too) were replaced with the real Google Material Symbols
  paths (Apache-2.0), fetched from `github.com/google/material-design-icons`
  (`symbols/web/<name>/materialsymbolsoutlined/<name>_24px.svg`):
  - `car` → `directions_car`, `camper` → `airport_shuttle` (no dedicated "camper van" glyph
    exists in Material Symbols — this is the closest official van/shuttle icon),
    `bike` → `pedal_bike` (not `directions_bike`, which includes a rider silhouette),
    `walk` → `directions_walk`, `plane` → `flight` (unchanged from the earlier redo)
  - Each source glyph's viewBox is `0 -960 960 960`; every icon except `flight` is embedded
    **unmodified** inside `<g transform="scale(0.025) translate(-480,480)">` — this recentres
    the 960×960 grid on the origin and scales it into the ±10 design space in one consistent
    step, so relative icon sizes match Google's own design grid. No rotation needed:
    car/shuttle/bike/walk are already right-facing or symmetric in their source orientation.
  - `flight` alone keeps the hand-transformed point list from the earlier redo (not the `<g>`
    recipe above) because its nose-up→nose-right 90° reorientation was done by directly
    recomputing coordinates, at the same time as simplifying its small rounded nose bezier to
    a sharp point.
  - **`color` prop removed from `RouteMarkerIcon`** — the old hand-drawn icons used it for
    "cutout" details (windshields, wheel hubs) that read as transparent holes against the
    badge; none of the Material glyphs have that kind of internal cutout, they're single flat
    silhouettes, so the prop had nothing left to do. Update the call site in
    `MapComposition.tsx` if this ever needs reintroducing for a future custom icon.
  - Verified all 5 by rendering the exact transform + paths in a browser (scratch HTML file,
    not committed) before shipping, both raw (to check natural orientation) and at realistic
    badge scale on the translucent navy circle — worth doing again for any future icon change,
    since orientation/centering is easy to get subtly wrong by eyeballing path data alone.
- **Tip position**: `visiblePts[visiblePts.length - 1]` (already projected [x,y])
- **Scale**: `markerR / 12` where `markerR = routeMarkerSize / 2` — design space ±10 units
- **No DOM APIs** — pure math from the existing `visiblePts` array, works in both browser and headless render
- Badge is rendered above the route path but below start/end pin markers

## Label reveal animations (labelAnimation prop)
`appear` (added 2026-09-25, user request: *"hier wil ik de optie ook nog 'verschijnen' (zonder
animatie)"*) — pops the label fully in the instant its timing window opens, no clip-wipe/fade/
scale transition. Different from `labelMode: 'on'`: `'on'` skips the timing entirely (visible
from frame 0, e.g. for thumbnails); `appear` still waits for the normal per-label window
(`startBoxEnd` / `endFadeIn`→`endBoxEnd`, see "Label/marker timing" below) — it just doesn't
animate *how* it shows up once that window starts. Implemented in `getLabelAnim()` in
`MapComposition.tsx` as `opacity: t > 0 ? 1 : 0` (hard on/off, no easing).

## Label placement vs. the route line and marker badge (src/MapComposition.tsx, bestLabelPos)
Labels were overlapping both the route line and the route marker badge (user report,
2026-09-25, right after the label-timing fixes above). Two separate gaps, both in
`bestLabelPos`'s collision logic:
- **Clearance from the pin**: the 4 candidate positions (above/below/left/right) were offset
  from the pin by `DOT_R = pinSize` — a few px. The marker badge (`routeMarkerSize/2`, default
  30) is far bigger and sits *exactly on top of the pin* at the moments a label is actually
  visible: briefly at the start pin as the line begins drawing, and at the end pin for the
  entire reveal+hold window (the marker's tip = the destination once the route has fully
  drawn — see "Label/marker timing" above). Fix: `DOT_R` is now
  `routeMarker !== 'none' ? Math.max(pinSize, markerR) : pinSize` — this constant is *only*
  used for label-clearance math (candidate offsets + `PIN_IGNORE`), never for drawing the
  actual pin dot (that still uses `pinSize` directly at the `<circle>` call sites), so
  redefining it here doesn't change the pin's own visual size.
- **Clearance from the line/badge corridor while travelling**: `segHitsBox`'s collision check
  only expanded by `lineWidth/2 + 4` (the line's own stroke), not the marker badge's radius —
  so a label placed just clear of the *thin line* could still get clipped later when the much
  wider badge travels past that same spot. Fix: `EXP = Math.max(lineWidth/2+4, routeMarker !==
  'none' ? markerR+4 : 0)`.
- Both fixes are no-ops when `routeMarker === 'none'` (falls back to the original `pinSize`-only
  behaviour) — this is purely about the marker badge, unrelated to the label-timing fixes above.
- **Follow-up bug from the fix above** (same day, user screenshot showed the incoming line
  cutting through the destination label's corner): `PIN_IGNORE` (the radius within which route
  segments are skipped during collision scoring, so the line's unavoidable final approach to
  the pin doesn't penalise every candidate) was `DOT_R + LABEL_GAP + 5` — 5px *past* the box's
  own near edge (`DOT_R + LABEL_GAP`). That overshoot existed even before this session's
  changes (with the original `DOT_R = pinSize`, a few px), just too small to notice; once
  `DOT_R` grew to match the marker badge (up to 30), the same overshoot became a visible
  blind spot right at the box's corner — exactly where the screenshot showed the line cutting
  through. Fixed by dropping the extra margin: `PIN_IGNORE = DOT_R`, strictly less than the
  box's near edge, so collision-testing now covers the box's edge fully with no gap.

## Label/marker timing (src/MapComposition.tsx)
Two rounds of feedback on 2026-09-25 reshaped how the destination label's timing works —
**`routeEnd` is no longer a fixed fraction of `dur`** (was `0.867*dur`), it's now derived by
working backwards from the end of the video:
```
endRevealFrames = min(0.6*FPS, 0.15*dur)   // time for the label's reveal animation to play
endHoldFrames   = min(1.3*FPS, 0.30*dur)   // time the fully-revealed label stays on screen, unread otherwise
routeEnd        = max(1, dur - endRevealFrames - endHoldFrames)
endFadeIn       = routeEnd                 // pin/label only start appearing once the line arrives
endFadeEnd      = min(dur, routeEnd + 0.1*FPS)   // quick opacity fade
endBoxEnd       = min(dur, routeEnd + endRevealFrames)   // reveal completes here — then HOLDS until dur automatically, since windowT() clamps t at 1 past its end argument, no separate "hold" branch needed
```
- **Round 1** (*"ik wil dat het destination label pas verschijnt als de lijn toekomt"*): made
  `endFadeIn = routeEnd` so the label can't start appearing before the line arrives. At that
  point `routeEnd` was still the old fixed `0.867*dur` and `endBoxEnd` was pushed to `dur` —
  which fixed the "appears too early" bug but left almost no time after the reveal finished.
- **Round 2** (*"het eind label komt er nu pas de laatste seconde op... het zou er toch 1 a 2
  sec moeten blijven op staan"*): the real fix — `routeEnd` itself now moves *earlier* so there
  is guaranteed reveal + hold time left over at the tail, instead of squeezing both into
  whatever scraps were left after a fixed-fraction `routeEnd`. `FPS` (imported from
  `mapData.ts`, always 30) is used directly for the reveal/hold durations because "1.3
  seconds to read a label" should mean the same thing regardless of the video's total
  `duration` — a pure `*dur` fraction would make the hold time balloon on long videos and
  vanish on short ones. Both are still capped as a fraction of `dur` (`0.15`/`0.30`) so very
  short clips degrade gracefully (less route-drawing time) rather than a negative/zero
  `routeEnd`.
- **Net effect at the 5 s default**: route line now finishes at ~3.1 s (was ~4.33 s), reveals
  over ~0.6 s, then holds fully visible for exactly 1.3 s until the video ends at 5 s.
- The start label is unaffected — it still begins its own reveal at frame 0 (`startBoxEnd`
  unchanged, still a fixed `0.267*dur`), since there's no "hasn't arrived yet" concern for the
  start of the route, and no equivalent complaint was raised about it.
- **Debugging note for next time**: when a user reports "the label shows too early/fully
  visible from frame 0" and the timing math looks right on paper, check `labelMode` first —
  `'on'` forces `endT`/`endO` to `1` unconditionally (by design, "always fully visible, good
  for thumbnails"), bypassing all of the above entirely. That was the actual cause the first
  time this was reported, not a logic bug in the timing constants.

## Start/end labels — "Air France" two-row style (src/MapComposition.tsx)
Replaced the old single-line label box entirely (2026-09-25), inspired by the Air France
in-flight wifi map (flag + country on top, city below). No toggle between old/new style —
the two-row layout is the only one.

- **Row 1**: flag image (fetched from flagcdn.com via `useFlagImage`, see below) + country
  name, bold, full `labelTextColor`
- **Row 2**: city name (`startLabel`/`endLabel` — same fields as before, meaning unchanged),
  lighter weight, `labelTextColor` at `fillOpacity={0.7}` for visual hierarchy — **no
  separate sub-text-color prop**; font/background/text-color customisation (`labelFont`,
  `labelBgColor`, `labelTextColor` in PropsForm's "Labels" section, renamed from "Route labels"
  in the 2026-09-26 reorg) already applied to
  both rows before this change, so no new controls were needed there
- New schema fields: `startCountry`/`endCountry` (display name) + `startCountryCode`/
  `endCountryCode` (lowercase ISO 3166-1 alpha-2, e.g. `"be"`) — independent of `mode`, so
  available in both Directions and GPX mode
- `labelBoxWidth(country, city, font)` now takes both row texts and returns the max of the
  two row widths (row 1 includes flag width + gap) — replaces the old single-string version
- `LABEL_BOX_H = 92` (was `52`) — flows through positioning/collision-avoidance/clip-path
  logic unchanged since those are content-agnostic (just work with a box rect)
- Flag rendered via `<image>` clipped to a small rounded rect (`startFlagClip`/`endFlagClip`
  in `<defs>`) with `preserveAspectRatio="xMidYMid slice"` — flag source images have varying
  aspect ratios (e.g. Nepal), slice-cropping into a fixed 34×24 box avoids distortion
- **Why fetch flag PNGs instead of Unicode flag emoji**: the project already avoids emoji
  glyphs in the actual rendered video — `routeIcons.tsx`'s vehicle badges are hand-drawn SVG
  specifically because headless Chromium on the render server may lack a colour-emoji font,
  so flag emoji would risk rendering as blank/tofu. Flag images follow the same
  fetch-as-data-URL pattern as `useMapboxImage` instead.

## useFlagImage hook (src/useMapboxImages.ts)
Fetches `https://flagcdn.com/w80/<code>.png` (no API key) and returns a data URL, same
`delayRender`/`continueRender` + `cancelled`-flag pattern as `useMapboxImage`. Unlike the map
tile, a fetch failure is **non-fatal** — `continueRender` still fires and the label just
renders without a flag image (no `cancelRender`), since a mistyped/missing country code
shouldn't abort the whole render.

## Country picker (webapp/src/PropsForm.tsx — CountryPicker component)
Searchable `ls-picker` variant (~195 countries from `src/countryData.ts`, imported cross-
project the same way `PreviewPlayer.tsx` imports `MapComposition`/`mapData`). Adds a text
filter input + scrollable option list (`.ls-search` / `.ls-options-scroll` in styles.css —
the other `ls-panel`s don't scroll, this one needs to for ~195 options) and a small flag
thumbnail (`https://flagcdn.com/24x18/<code>.png`) per row and on the trigger button.
Selecting an option updates both `startCountryCode`/`startCountry` (or the `end` pair) in one
`onChange` call via `set(set(props, ...), ...)` — `upd()` only sets one key at a time.
Appears in both the Route (Directions mode) and GPX file sections, alongside the renamed
"Start city"/"End city" fields (previously "Start label"/"End label").

## Preview player (PreviewPlayer.tsx)
- Auto-play via `useEffect` + `setTimeout(() => playerRef.current?.play(), 100)` — NOT the `autoPlay` prop
- The `autoPlay` prop caused "shows Pause but frames don't advance" on page refresh (fires before Player is ready)

## Auto-update feature (server/index.cjs + App.tsx)
### Server endpoints (all `requireAuth`):
- `GET /api/update-check` — calls GitHub API live, returns `{ updateAvailable, localHash, remoteHash }`
- `POST /api/update` — runs `git pull --ff-only` → `npm install` → `npm run build:webapp`; returns `{ ok: true }` when done (~30–90 s)
- `POST /api/restart` — responds `{ ok: true }` then `setTimeout(() => process.exit(0), 200)`; PM2 restarts
- Local hash read once at startup: `execSync('git rev-parse HEAD')` into `let localHash`

### Client (App.tsx):
- `updateState`: `'idle' | 'available' | 'updating' | 'restart-needed' | 'restarting'`
- `checkForUpdate()` called after login and session restore
- Update banner in `.sidebar-header`; Install disabled while rendering
- After restart: polls `GET /api/me` every 2 s; **any HTTP response** (200 or 401) triggers `window.location.reload()` — sessions are in-memory so the server returns 401 after restart, not 200

## Sidebar visual redesign — critique pass (2026-09-27)
Ran `image-to-code-skill` (a Claude Code custom skill, `~/.claude/skills/image-to-code-skill/SKILL.md`) as a design critique against a screenshot of the main screen (sidebar + preview), then implemented all 6 points it raised, in `webapp/src/styles.css`:
1. **Brand consistency** — `.sidebar-header h1` ("Travel Map") was 12px/600, a much weaker treatment than the login card's 22px/800 for the same wordmark. Bumped to 18px/800.
2. **Typographic contrast** — `.section-title-main` 12px→14px, `.section-summary` 9.5px→10.5px; everything used to sit in an 8–12px range with little hierarchy.
3. **Spacing** — card gap 10px→16px, `.section-title` padding 13/15px→16/18px, `.section-body-inner` 14px→18/16px, `.field` padding/min-height/margin bumped — cards and fields were nearly touching.
4. **Systematic card palette** — the 6 `--card-color` values were picked by eye (mustard/tan were only a few degrees apart). Now all 5 content cards share the same OKLCH lightness (64%) and chroma (0.09), only hue rotates; Export is a deliberate desaturated exception (utility step, not content).
5. **Render button distinction** — `.sidebar-footer .btn-primary` (only that scope, not the global `.btn-primary`) now gets a near-black `oklch(22% 0.01 250)` background, since the global `--accent` orange sat in the same hue family as the Travel route card directly above it.
6. **Sidebar width** — `--sidebar-w` 280px→320px, root cause of truncated labels ("Transport ma..."). Widening alone wasn't enough because `.field > label { width: 38% }` is a percentage, not absolute — also bumped that to 46% so "Transport marker" (the longest field label) renders in full.

Rollback: commit `eecb220` is the last clean commit before this pass — `git revert <this-pass-commit>` or checkout `eecb220` undoes it cleanly since it landed as its own commit, not amended.

## Mobile-specific fixes
- **Login screen**: `.login-card` uses `width: 100%; max-width: 360px`; on mobile `.login-field input` has `font-size: 16px` (prevents iOS Safari auto-zoom); `.login-page` uses `min-height: 100svh`
- **Mobile render button**: `.mobile-render-area` (hidden on desktop, shown in preview tab on mobile) — same `handleRender` handler as sidebar footer

## npm scripts
| Script | Description |
|---|---|
| `npm run dev` | Start both servers (Vite 5173 + Express 3002) |
| `npm run build:webapp` | Vite production build → `webapp/dist` |
| `npm run start:server` | Production Express server only |
| `npm run sync-gpx` | Regenerate `src/gpxFiles.ts` after adding `.gpx` to `/public` |

## Production deployment
```bash
# First deploy (seeds .env from inline vars):
MAPBOX_TOKEN=pk.xxx RESEND_API_KEY=re_xxx APP_URL=https://travelmap.luyens.be \
  bash <(curl -s https://raw.githubusercontent.com/shaggy72/Travel-map/main/deploy.sh)

# Update via browser: "🔄 Update available" banner → Install → Restart now
# Update via SSH:
bash ~/Travel-map/deploy.sh
```
- Requires passwordless sudo (`echo '$USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/$USER`)
- Ubuntu 24.04: `deploy.sh` uses `resolve_pkg()` + runs `apt-get update -qq` before package installs (stale cache caused `libasound2` to fail as virtual package on repeated deploys)
- App runs on port 3002; add nginx in front for HTTPS / multiple apps

## Key bug fixes (patterns to remember)
- **Presets server not responding after code change**: new Express endpoints require a server restart — `npx kill-port 3002 && npm run dev` (the Vite HMR does NOT restart the Express process)
- **GPX not showing in production**: Express must serve `PUBLIC_DIR` at both `/public/` AND `/` so `staticFile(filename)` resolves correctly in the Remotion renderer
- **Stale map tile**: `useMapboxImage` uses a `cancelled` flag in effect cleanup — prevents slow fallback fetch from overwriting a newer correct tile after geocoding completes
- **Route handle leak**: `useRoute` calls `continueRender(handle)` immediately when `url` is null (flight/GPX mode), so Remotion CLI renderer doesn't hang
- **OSRM server**: always use `routing.openstreetmap.de`, NOT `router.project-osrm.org` (car profile only)
- **Collapsible section border bleed**: CSS grid `0fr` trick causes 1px child border to bleed past the collapsed track in some browsers — use `max-height: 0; overflow: hidden` instead
- **Preview autoplay on refresh**: `autoPlay` prop fires before Player is ready → use `useEffect` + `setTimeout(play, 100)` instead
- **deploy.sh libasound2**: on repeated deploys `apt-cache` is stale (Node already installed, NodeSource skipped) → `apt-get update -qq` before `resolve_pkg` calls fixes it
- **Render geocoding failure** ("Geocoding failed for: …"): Remotion bundles via webpack which does NOT substitute `process.env.*` automatically (unlike Vite). Fix: use `webpackOverride` + `webpack.DefinePlugin` in `bundle()` in `server/index.cjs` to hard-bake `MAPBOX_TOKEN` and `MAPBOX_STYLE` into the bundle. `envVariables` option in `@remotion/bundler@4.0.469` does not work as expected.
- **Restart button does nothing after update**: sessions stored in-memory (`Map`) are lost on `process.exit(0)`. After PM2 restarts the server, `/api/me` returns 401 (not 200). Old polling checked `r.ok` (200 only) → never reloaded. Fix: reload on any HTTP response; only network-level errors (ECONNREFUSED) mean the server is still starting.
- **`dotenv` prints ad tips to production logs**: `dotenv@17.4.2`'s `.config()` logs an "injected env" line with a random rotating self-promo tip (`dotenvx.com`, `vestauth.com`) on every server start — looks alarming in `pm2 logs` (unfamiliar domain) but is genuine upstream behaviour, not a compromised package (checked `node_modules/dotenv/lib/main.js` — the tips are hardcoded in a `TIPS` array). Fixed by passing `{ quiet: true }` to `.config()` in `server/index.cjs`.
- **Applying an old preset after adding a schema field crashes the preview**: preset "Apply" replaced `props` wholesale with the raw stored JSON (`onChange(p.props)`), so a preset saved before a new required-looking field existed (e.g. `startCountry`/`startCountryCode`) left it `undefined` at runtime — `labelBoxWidth()` then called `.length` on `undefined` and threw. Fix: `onChange({ ...DEFAULT_PROPS, ...p.props })` so missing fields fall back to defaults. Apply this pattern any time a new prop is added — old stored presets never gain it automatically.
