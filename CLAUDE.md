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
| `src/useMapboxImages.ts` | Hooks: `useMapboxImage`, `useGeocode`, `useGpxTrack`, `useRoute` |
| `src/easing.ts` | Timing/easing utilities (`easeInOutCubic`, `windowT`, `interpolateEased`, …) |
| `src/Root.tsx` | Remotion composition root; `calculateMetadata` sets dynamic width/height |
| `server/index.cjs` | Express: auth, GPX upload, Remotion render, auto-update endpoints, serves `webapp/dist` in prod |
| `webapp/src/App.tsx` | Root React app; auth state; mobile tab switcher; update banner (`updateState`) |
| `webapp/src/PropsForm.tsx` | Full sidebar form — all sections collapsible via `closed` Set state |
| `webapp/src/types.ts` | TypeScript mirror of schema + `DEFAULT_PROPS` |
| `webapp/src/PreviewPlayer.tsx` | Remotion `<Player>` wrapper; dynamic `compositionWidth/Height`; plays via `useEffect` |
| `src/routeIcons.tsx` | `RouteMarkerIcon({ type, color })` — white SVG silhouettes for the route tip badge |
| `webapp/src/styles.css` | All CSS — design tokens (OKLCH) + mobile rules + update banner |
| `webapp/src/ColorPicker.tsx` | Custom HSV color picker |
| `deploy.sh` | One-command deploy to Debian/Ubuntu/Mint server |

## Environment variables (.env — gitignored)
```
MAPBOX_TOKEN=pk.eyJ1Ijoic2hhZ2d5NzIi...   # required
MAPBOX_STYLE=shaggy72/cmpma5agg000101qr4tt68gad  # optional, falls back to mapbox/light-v11
APP_USERNAME=micha
APP_PASSWORD=micha
PORT=3002
```

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
1. Presets — save/load named configurations (server-side, `GET/POST/DELETE /api/presets`)
2. Mode (+ Travel sub-section in Directions mode)
3. Route (Directions) — Start address → Start label → End address → End label
4. GPX file (GPX mode) — Select track → Start label → End label → Upload
5. Track line
6. Map
7. Route labels (Labels mode, animation, bg colour, text colour, font)
8. Elevation profile (GPX mode only) — show/hide, colours, position (left/top %) and size (width/height %)
9. Animation (format + duration)
10. City labels

**All sections are collapsible.** Default open: Mode, Route/GPX, Track line. Default closed: Presets, Map, Route labels, Elevation profile, Animation, City labels.
- State: `const [closed, setClosed] = useState<Set<string>>(() => new Set([...]))` in `PropsForm`
- Toggle button: `<button className="section-title">` with `<span className="section-chevron">` before the label text
- Body: `.section-body` + `.section-body-inner`; collapse uses `max-height: 0` / `overflow: hidden` (NOT CSS grid 0fr — that causes 1px border bleed in some browsers)

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

## Presets (server-side)
- Stored in `server/data/presets-<USERNAME>.json` (gitignored directory, created automatically)
- Three endpoints: `GET /api/presets`, `POST /api/presets`, `DELETE /api/presets/:id`
- Client loads on mount via `useEffect`; save/delete are optimistic (updates local state immediately on 200)
- Saves ALL props — including route addresses, GPX file, colours, fonts, elevation settings, etc.

## Map styles (MAP_STYLE_OPTIONS in PropsForm.tsx)
- `shaggy72/cmpma5agg000101qr4tt68gad` — Gray (custom)
- `shaggy72/cmqf8b53y001g01sc9lsh67db` — Topographic (contours + water only, with hillshade)
- `shaggy72/cmqf94fhu003q01qw4m5e4fpk` — Topo v2 (adds land-use colours: urban/grass/wood/rock/protected areas)
- Source JSON files: `mapbox-topo-style.json`, `mapbox-topo-style-v2.json`
- Standard Mapbox styles: streets-v12, outdoors-v12, light-v11, dark-v11, satellite-streets-v12, none

## Flight arc curve (flightCurve prop)
- Only active when `travelMode === 'flight'`
- Applied **in screen space** after projecting the great-circle points
- Lifts each point perpendicular to the start→end chord by `sin(π*t) * maxLift`
- `maxLift = (flightCurve/100) * chordLength * 0.5` — so value 100 = half-chord lift
- Perpendicular direction: CW rotation of chord `(dy/len, -dx/len)` = upward on screen for east-west routes (conventional flight-path look)
- Slider (0–100, step 5) shown in PropsForm only when `travelMode === 'flight'`

## Route tip marker (src/routeIcons.tsx + MapComposition.tsx)
A circular badge (colour = `lineColor`) with a white vehicle icon follows the leading point of the route line as it draws. The badge rotates to face the direction of travel.

- **Tip position**: `visiblePts[visiblePts.length - 1]` (already projected [x,y])
- **Angle**: `Math.atan2(dy, dx) * (180/Math.PI)` from last two visible points
- **Scale**: `markerR / 12` where `markerR = routeMarkerSize / 2` — design space ±10 units
- **No DOM APIs** — pure math from the existing `visiblePts` array, works in both browser and headless render
- Badge is rendered above the route path but below start/end pin markers
- `RouteMarkerIcon` uses the badge colour (`lineColor`) for cutout details (windshields, wheel hubs) to simulate transparency in the white silhouette

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
MAPBOX_TOKEN=pk.xxx APP_USERNAME=micha APP_PASSWORD=micha \
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
