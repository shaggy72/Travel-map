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
| `server/index.cjs` | Express: auth, GPX upload, Remotion render, serves `webapp/dist` in prod |
| `webapp/src/App.tsx` | Root React app; auth state; mobile tab switcher (`mobileTab` state) |
| `webapp/src/PropsForm.tsx` | Full sidebar form with all controls |
| `webapp/src/types.ts` | TypeScript mirror of schema + `DEFAULT_PROPS` |
| `webapp/src/PreviewPlayer.tsx` | Remotion `<Player>` wrapper; dynamic `compositionWidth/Height` |
| `webapp/src/styles.css` | All CSS — design tokens (OKLCH) + `@media (max-width: 640px)` mobile rules |
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
- **Mobile layout**: `mobileTab` state in `App.tsx`, `layout--preview` CSS class, `@media (max-width: 640px)` tab switcher

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

## Form section order (PropsForm.tsx)
1. Mode (+ Travel sub-section in Directions mode)
2. Route / GPX file
3. Track line
4. Map
5. Route labels
6. Animation (format + duration)
7. City labels

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

# Update after code changes:
bash ~/Travel-map/deploy.sh
```
- Requires passwordless sudo (`echo '$USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/$USER`)
- Ubuntu 24.04: `deploy.sh` uses `resolve_pkg()` to handle `libasound2t64` rename
- App runs on port 3002; add nginx in front for HTTPS / multiple apps

## Key bug fixes (patterns to remember)
- **Stale map tile**: `useMapboxImage` uses a `cancelled` flag in effect cleanup — prevents slow fallback fetch from overwriting a newer correct tile after geocoding completes
- **Route handle leak**: `useRoute` calls `continueRender(handle)` immediately when `url` is null (flight/GPX mode), so Remotion CLI renderer doesn't hang
- **OSRM server**: always use `routing.openstreetmap.de`, NOT `router.project-osrm.org` (car profile only)
