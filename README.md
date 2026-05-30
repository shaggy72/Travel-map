# Travel Map Animation

A web app that lets you configure a travel-route animation and export it as an MP4 video. Pick a start and end point (or upload a GPX track), choose a map style, travel mode, line and label appearance, and the app renders a smooth animated map using [Remotion](https://www.remotion.dev/).

---

## Prerequisites

- **Node.js ≥ 18**
- A **Mapbox account** (free tier is enough) — needed for map tiles, geocoding, and driving directions. Get a token at [account.mapbox.com](https://account.mapbox.com/access-tokens/).

---

## Setup

```bash
npm install
cp .env.example .env   # then edit .env with your values
```

### Environment variables (`.env`)

```
# Required
MAPBOX_TOKEN=pk.your_mapbox_token_here   # Mapbox API token

# Optional — custom map style (defaults to public mapbox/light-v11)
MAPBOX_STYLE=username/styleId            # Your personal Mapbox style slug

# Optional — server auth (defaults shown)
APP_USERNAME=admin        # Login username for the webapp
APP_PASSWORD=changeme     # Login password — change this!
PORT=3002                 # Upload/render server port
```

`.env` is gitignored and never committed. See `.env.example` for a copy-paste template.

---

## Running in development

```bash
npm run dev
```

Starts two processes concurrently:
- **Config webapp** → `http://localhost:5173`
- **Upload/render server** → `http://localhost:3002`

To use Remotion's own Studio (frame-scrubber, useful for debugging animations):

```bash
npm start
```

---

## How it works — end-to-end data flow

```
User edits form (PropsForm.tsx)
        │
        ▼
  Props object (types.ts)
        │ passed as inputProps
        ▼
  Remotion Player (PreviewPlayer.tsx)     ← live preview in browser
        │ re-renders on every prop change
        ▼
  MapComposition.tsx                      ← the animation itself
    ├── useGeocode()      address → [lng, lat] via Mapbox Geocoding API
    ├── useRoute()        coordinates → route polyline via Mapbox or OSRM
    ├── useMapboxImage()  center + zoom → map tile PNG via Mapbox Static Images
    └── useGpxTrack()     .gpx file → [lng, lat][] array (GPX mode only)
        │
        ▼ SVG rendered frame-by-frame

User clicks "Render & Download"
        │
        ▼
  POST /api/render  (App.tsx → server/index.cjs)
        │ server runs: remotion render --props='...'
        ▼
  Remotion CLI renders all frames headlessly
        │ same MapComposition.tsx, same data flow as preview
        ▼
  MP4 streamed back → browser downloads travel-map.mp4
```

**Key insight:** the preview and the final render use the exact same React component (`MapComposition.tsx`). The only difference is that the preview runs frame-by-frame in the browser via Remotion Player, while the render runs headlessly via the Remotion CLI on the server.

---

## Configuring a route

1. Open `http://localhost:5173` and log in
2. **Directions mode** — enter start and end addresses, pick travel mode:
   - 🚗 **Car** — Mapbox Directions API (fast, accurate, any distance)
   - 🚲 **Bike** — routing.openstreetmap.de/routed-bike (no key, handles long distances)
   - 🚶 **Walk** — routing.openstreetmap.de/routed-foot (no key, handles long distances)
   - *Mapbox is not used for cycling/walking because it rejects routes longer than ~24 h travel time*
3. **GPX mode** — upload a `.gpx` track file; select it from the dropdown
4. Adjust **Map style**, **Line** (color, width, style), **Labels** (animation, colors, font)
5. Choose **Format** (Portrait 9:16 / Landscape 16:9 / Square 1:1) and **Duration** (seconds)
6. The live preview updates as you change settings

---

## Rendering to MP4

**Via the webapp:** click **⬇ Render & Download MP4**. Takes ~2–5 min for a 5-second animation.

**Via CLI** (runs on the current `defaultProps` in `src/Root.tsx`):
```bash
npm run build
```

---

## Key files explained

### `src/schema.ts`
Defines every configurable prop using [Zod](https://zod.dev). This is the single source of truth — Remotion validates props against it, and the webapp mirrors it in `webapp/src/types.ts`. Every field has a JSDoc comment explaining its purpose.

### `src/MapComposition.tsx`
The animation component. Renders an SVG at 1080×1920px (9:16 portrait). On each frame it:
1. Draws the Mapbox tile as a background `<image>`
2. Draws the route as an animated SVG `<path>` (draw-on effect)
3. Draws city dots + labels (filtered by population)
4. Draws start/end pin markers with animated label boxes

All async data (tile, geocoding, route) is fetched via `delayRender`/`continueRender` hooks so Remotion waits for them before rendering each frame.

### `src/useMapboxImages.ts`
Four custom hooks used by `MapComposition`:
- `useMapboxImage(url)` — fetches a Mapbox static tile and returns a data URL
- `useGeocode(address)` — geocodes a place name to `[lng, lat]`
- `useGpxTrack(filename)` — parses a GPX file from `/public`
- `useRoute(url)` — fetches a route polyline from Mapbox or OSRM; clears stale coords immediately when URL changes (travel mode switch)

### `server/index.cjs`
Express server (port 3002) that:
- Authenticates the webapp via a session cookie
- Accepts GPX file uploads (`POST /api/upload`)
- Triggers Remotion renders (`POST /api/render`) and streams the MP4 back
- Serves the list of available GPX files (`GET /api/gpx-files`)

### `webapp/src/PropsForm.tsx`
The sidebar form. Every control calls `upd(key, value)` which produces a new `Props` object and bubbles it to `App.tsx` → `PreviewPlayer`. Dropdowns use a custom `ls-picker` pattern (not native `<select>`) for consistent cross-browser styling.

---

## Adding GPX tracks

```bash
# Option 1 — manual
cp your-track.gpx public/
npm run sync-gpx          # regenerates src/gpxFiles.ts

# Option 2 — via the webapp
# Use the "Upload GPX" button in the sidebar (calls POST /api/upload)
```

---

## Tech stack

| Library | Role |
|---|---|
| [Remotion v4](https://remotion.dev) | Frame-by-frame React → MP4 rendering |
| Vite 8 + React 18 | Config webapp bundler + UI |
| [D3-geo](https://github.com/d3/d3-geo) | Mercator map projection |
| [Zod](https://zod.dev) | Prop schema definition and validation |
| TypeScript | Type safety across animation and webapp |
| Express | Upload and render API server |

---

## Troubleshooting

**Mapbox tile is a grey square / "No token" error**
→ Check that `MAPBOX_TOKEN` is set in `.env` and the dev server was restarted after editing `.env`.

**Render fails with "No route found"**
→ Mapbox Directions rejects very long cycling/walking routes. Switch to Car, or the app will automatically use OSRM for Bike/Walk.

**Port 5173 or 3002 already in use**
→ Kill the process using that port, or set `PORT=xxxx` in `.env` to change the server port.

**GPX file doesn't appear in the dropdown**
→ Run `npm run sync-gpx` after adding files to `/public`. The dropdown is driven by `src/gpxFiles.ts` which must be regenerated.

**Preview works but render produces a black video**
→ This usually means an async fetch didn't resolve before rendering. Check the terminal for `[Directions]` or `[Geocoding]` errors.

**Login fails with default credentials**
→ The default username is `admin` and password is `changeme`. Set `APP_USERNAME` and `APP_PASSWORD` in `.env`.

---

## Design system

The webapp UI uses a hand-crafted CSS design system (no component library). See **[DESIGN.md](./DESIGN.md)** for:
- All CSS custom properties (colour tokens, spacing, shadows)
- Layout structure (sidebar + preview panel)
- Every component pattern: field pill, radio toggle, custom dropdown, range slider, color picker, buttons
- How to add a new control following the existing patterns

---

## Contributing

- **Code style** — TypeScript strict mode, no `any` except where unavoidable (e.g. Node stream piping). Prettier is not configured; match the surrounding style.
- **Adding a new prop** — add it to `src/schema.ts` (with JSDoc), mirror it in `webapp/src/types.ts` and `DEFAULT_PROPS`, then wire it up in `MapComposition.tsx` and `PropsForm.tsx`.
- **Adding a new line style** — extend the `lineStyle` enum in `schema.ts` and add the SVG rendering case in `MapComposition.tsx` where `lineStyle` is consumed.
- **Commits** — one logical change per commit, present-tense imperative subject line (e.g. `Add wipe animation style`).
