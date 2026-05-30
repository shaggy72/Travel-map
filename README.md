# Travel Map Animation

A web app that lets you configure a travel-route animation and export it as an MP4 video. You pick a start and end point (or upload a GPX track), choose a map style, travel mode, line and label appearance, and the app renders a smooth animated map using [Remotion](https://www.remotion.dev/).

---

## Prerequisites

- **Node.js ≥ 18**
- A **Mapbox account** (free tier is enough) — you need an access token for:
  - Map tile backgrounds (Mapbox Static Images API)
  - Address geocoding (Mapbox Geocoding API)
  - Driving directions (Mapbox Directions API)

  → Paste your token into `src/mapData.ts`, replacing the value of `MAPBOX_TOKEN`.

> **Keep the repository private** — the Mapbox token is currently stored in source code.

---

## Project structure

```
europe-map-animation/
├── src/                  Remotion composition (the animation itself)
│   ├── MapComposition.tsx    Main animated component (SVG map, route, labels, cities)
│   ├── schema.ts             Zod schema — all configurable props with defaults
│   ├── mapData.ts            Map maths, projection, API URL builders
│   ├── useMapboxImages.ts    React hooks: tile fetch, geocoding, GPX parse, route fetch
│   ├── easing.ts             Easing and timing utilities
│   └── Root.tsx              Remotion composition entry point
│
├── webapp/src/           React config UI + live preview player
│   ├── App.tsx               App shell: auth, render button, layout
│   ├── PropsForm.tsx         Sidebar form with all animation controls
│   ├── PreviewPlayer.tsx     Remotion Player wrapper (lazy-loaded)
│   ├── ColorPicker.tsx       Custom HSV color picker with alpha support
│   ├── types.ts              TypeScript mirror of schema.ts (no Zod dependency)
│   └── styles.css            All UI styles
│
├── public/               GPX track files (served at / in dev, /public in prod)
├── server/               Upload server — handles GPX file uploads + render triggers
└── scripts/              Helper scripts (sync GPX file list, etc.)
```

---

## Setup

```bash
npm install
```

---

## Running in development

```bash
npm run dev
```

This starts two processes concurrently:
- **Config webapp** on `http://localhost:5173` — the main UI
- **Upload server** on `http://localhost:3002` — handles GPX uploads and render API calls

Alternatively, run the Remotion Studio (frame-scrubber preview):

```bash
npm start
```

---

## Configuring a route

1. Open `http://localhost:5173` and log in
2. **Mode — Directions**: enter a start and end address, pick travel mode (Car / Bike / Walk)
3. **Mode — GPX**: upload a `.gpx` track file and select it from the dropdown
4. Adjust **Map style**, **Line** (color, width, style), **Labels** (animation, colors)
5. Set **Duration** (seconds) and optionally adjust city label density
6. The live preview on the right updates as you change settings

---

## Rendering to MP4

**Via the webapp:** click **⬇ Render & Download MP4** in the sidebar. Rendering takes roughly 2–5 minutes for a 5-second animation. The file downloads automatically when done.

**Via CLI:**
```bash
npm run build
```

---

## Key services

| Service | Used for | API key needed? |
|---|---|---|
| Mapbox Static Images | Map tile background | Yes (`MAPBOX_TOKEN`) |
| Mapbox Geocoding | Address → coordinates | Yes (same token) |
| Mapbox Directions | Driving routes | Yes (same token) |
| routing.openstreetmap.de | Cycling & walking routes | **No** |
| Google Fonts | UI font (Inter) + travel mode icons (Material Symbols) | No |

Cycling and walking use OpenStreetMap's OSRM backends (`routed-bike` / `routed-foot`) because Mapbox Directions rejects long-distance cycling/walking routes.

---

## Adding GPX tracks

1. Drop `.gpx` files into the `/public` folder
2. Run `npm run sync-gpx` — this regenerates `src/gpxFiles.ts` so the files appear in the UI dropdown
3. Or use the **Upload GPX** button in the webapp (calls the upload server at :3002)

---

## Tech stack

| Library | Role |
|---|---|
| [Remotion v4](https://remotion.dev) | Frame-by-frame React → MP4 rendering |
| Vite + React 18 | Config webapp bundler + UI |
| [D3-geo](https://github.com/d3/d3-geo) | Mercator map projection |
| [Zod](https://zod.dev) | Prop schema definition and validation |
| TypeScript | Type safety across both the animation and webapp |
