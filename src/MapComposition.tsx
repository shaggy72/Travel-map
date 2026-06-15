import React, { useState, useEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import {
  MAJOR_CITIES,
  calcZoomAndCenter, calcZoomAndCenterFromPoints,
  buildProjection, buildMapUrl, buildDirectionsUrl, buildOsrmUrl, buildFlightArc,
} from "./mapData";
import { easeInOutCubic, easeOutCubic, windowT } from "./easing";
import { useMapboxImage, useGeocode, useGpxTrack, useRoute } from "./useMapboxImages";
import { RouteMarkerIcon } from "./routeIcons";
import { MapSchema } from "./schema";

// ── City font registry ────────────────────────────────────────────────────
// system: no download needed. googleParam: Google Fonts family+variant string.
const CITY_FONT_MAP: Record<string, { family: string; googleParam?: string }> = {
  Helvetica:    { family: "'Helvetica Neue', Arial, sans-serif" },
  Inter:        { family: "Inter, 'Segoe UI', sans-serif",             googleParam: "Inter:wght@400;500;700" },
  Georgia:      { family: "Georgia, 'Times New Roman', serif" },
  Oswald:       { family: "Oswald, 'Helvetica Neue', sans-serif",      googleParam: "Oswald:wght@400;500;700" },
  Merriweather: { family: "'Merriweather', Georgia, serif",             googleParam: "Merriweather:wght@400;700" },
};

// ── Palette ───────────────────────────────────────────────────────────────
const C = {
  bg:        "#ffffff",
  route:     "#e53935",
  dot:       "#ffffff",
  shadow:    "rgba(0,0,0,0.85)",
  cityDot:   "#1a1a1a",
  cityLabel: "#555555",
};

// ── Timing proportions (relative to total duration) ──────────────────────
// All timing is computed at runtime from durationInFrames in the component.
const LABEL_FONT_SIZE = 40;
const LABEL_PADDING   = 24; // 12px left + 12px right
// Approximate avg char width ratio per font family (bold, 40px).
// Wider fonts get a larger multiplier so the box doesn't clip the text.
const LABEL_CHAR_W_MAP: Record<string, number> = {
  Helvetica:    0.65,
  Inter:        0.64,
  Georgia:      0.68,
  Oswald:       0.52, // condensed
  Merriweather: 0.70,
};

function labelBoxWidth(text: string, font = 'Helvetica'): number {
  const ratio = LABEL_CHAR_W_MAP[font] ?? 0.65;
  return Math.ceil(text.length * ratio * LABEL_FONT_SIZE + LABEL_PADDING);
}

// ── Per-frame label animation state ──────────────────────────────────────
interface LabelAnimState {
  clipX: number; clipY: number; clipW: number; clipH: number;
  opacity: number; transform: string;
}

/**
 * Compute clip-rect + optional opacity/transform for a label box.
 * `t` is raw linear progress 0→1; easing is applied internally per animation.
 */
function getLabelAnim(
  animation: string,
  t: number,
  lx: number, ly: number,
  fw: number, bh: number,
  dotX: number,
  label: string,
): LabelAnimState {
  const cx = lx + fw / 2;
  const cy = ly + bh / 2;
  const e  = easeInOutCubic(t);
  const eo = easeOutCubic(t);

  switch (animation) {
    case 'right-to-left': {
      const w = e * fw;
      return { clipX: lx + fw - w, clipY: ly, clipW: w, clipH: bh, opacity: 1, transform: '' };
    }
    case 'fade':
      return { clipX: lx, clipY: ly, clipW: fw, clipH: bh, opacity: e, transform: '' };

    case 'scale': {
      const s = Math.max(0.001, e);
      return { clipX: lx, clipY: ly, clipW: fw, clipH: bh, opacity: e,
               transform: `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})` };
    }
    case 'slide-up': {
      // label slides up into the clip region (bh = full box height as slide distance)
      const dy = (1 - eo) * bh;
      return { clipX: lx, clipY: ly, clipW: fw, clipH: bh, opacity: e, transform: `translate(0 ${dy})` };
    }
    case 'typewriter': {
      // step-reveal: one character at a time
      const n = Math.ceil(t * label.length);
      const w = n === 0 ? 0 : Math.min(n * (LABEL_CHAR_W_MAP['Helvetica'] * LABEL_FONT_SIZE) + LABEL_PADDING / 2, fw);
      return { clipX: lx, clipY: ly, clipW: w, clipH: bh, opacity: 1, transform: '' };
    }
    case 'wipe-from-dot': {
      // expands outward from the dot position
      const left  = dotX - e * (dotX - lx);
      const right = dotX + e * (lx + fw - dotX);
      return { clipX: left, clipY: ly, clipW: Math.max(0, right - left), clipH: bh, opacity: 1, transform: '' };
    }
    case 'left-to-right':
    default:
      return { clipX: lx, clipY: ly, clipW: e * fw, clipH: bh, opacity: 1, transform: '' };
  }
}

const DEBOUNCE_MS = 800;

/** Outer shell — debounces address/file input so fetches only fire after the user stops typing. */
export const MapComposition: React.FC<MapSchema> = (props) => {
  const [committedStart, setCommittedStart] = useState(props.startAddress);
  const [committedEnd,   setCommittedEnd]   = useState(props.endAddress);
  const [committedGpx,   setCommittedGpx]   = useState(props.gpxFile);

  useEffect(() => {
    const t = setTimeout(() => setCommittedStart(props.startAddress), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [props.startAddress]);

  useEffect(() => {
    const t = setTimeout(() => setCommittedEnd(props.endAddress), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [props.endAddress]);

  useEffect(() => {
    const t = setTimeout(() => setCommittedGpx(props.gpxFile), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [props.gpxFile]);

  return (
    <MapCompositionInner
      key={`${props.mode}|${committedGpx}|${committedStart}|${committedEnd}`}
      {...props}
      startAddress={committedStart}
      endAddress={committedEnd}
      gpxFile={committedGpx}
    />
  );
};

const MapCompositionInner: React.FC<MapSchema> = ({
  mode, travelMode, startAddress, endAddress, startLabel, endLabel,
  mapStyle, mapBgColor,
  zoomMode, zoom: manualZoom, gpxFile,
  labelMode, labelAnimation, labelFont,
  lineColor, lineWidth, pinSize, lineStyle, pencilStrength, labelBgColor, labelTextColor,
  routeMarker, routeMarkerSize,
  flightCurve,
  minPopulation,
  cityFont,
  cityUppercase,
  cityColorBig, cityColorMedium, cityColorSmall,
  citySizeBig, citySizeMedium, citySizeSmall,
  showElevationProfile, elevationColor, elevationBgColor,
  elevationLeft, elevationTop, elevationWidth, elevationHeight,
}) => {
  const frame = useCurrentFrame();

  // ── Load Google Font if needed (works in both browser preview and Remotion render) ──
  useEffect(() => {
    const fontData = CITY_FONT_MAP[cityFont];
    if (!fontData?.googleParam) return; // system font — nothing to fetch

    const handle = delayRender(`Loading city font: ${cityFont}`);
    let done = false;
    const finish = () => { if (!done) { done = true; continueRender(handle); } };

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontData.googleParam}&display=swap`;
    link.addEventListener("load", async () => {
      try { await document.fonts.ready; } finally { finish(); }
    });
    link.addEventListener("error", finish);
    document.head.appendChild(link);

    return finish; // ensure handle resolves if effect re-runs or component unmounts
  }, [cityFont]);
  const { width, height, durationInFrames: dur } = useVideoConfig();

  // ── Mode: directions — geocode both addresses ─────────────────────────
  const startCoords = useGeocode(mode === "directions" ? startAddress : null);
  const endCoords   = useGeocode(mode === "directions" ? endAddress   : null);

  // ── Mode: GPX — parse track file ──────────────────────────────────────
  const gpxData       = useGpxTrack(mode === "gpx" ? gpxFile : null);
  const gpxCoords     = gpxData?.track      ?? null;
  const gpxElevations = gpxData?.elevations ?? [];

  // ── Compute center + zoom ─────────────────────────────────────────────
  const directionsReady = mode === "directions" && startCoords !== null && endCoords !== null;
  const gpxReady        = mode === "gpx" && gpxCoords !== null && gpxCoords.length > 1;
  const ready           = directionsReady || gpxReady;

  const { center, zoom: autoZoom } = (() => {
    // Pass width/height so the fit-to-bounds calculation works for every format
    if (directionsReady) return calcZoomAndCenter(startCoords!, endCoords!, width, height);
    if (gpxReady)        return calcZoomAndCenterFromPoints(gpxCoords!, width, height);
    return { center: [4.52, 47.37] as [number, number], zoom: 5.5 };
  })();

  const zoom = zoomMode === "auto" ? autoZoom : manualZoom;
  // Build projection centred on the actual canvas dimensions (not the portrait default)
  const proj = buildProjection(center, zoom, width, height);

  // ── Fetch map tile ─────────────────────────────────────────────────────
  // Always build a URL (even when mapStyle === 'none') so the delayRender
  // handle inside useMapboxImage always resolves.  We use a cheap fallback
  // style when "No map" is selected so the fetch doesn't error out.
  // Pass width/height so the tile request matches the output format exactly.
  const mapUrl  = buildMapUrl(center, zoom, mapStyle === 'none' ? 'mapbox/light-v11' : mapStyle, width, height);
  const tileUrl = useMapboxImage(mapUrl);

  // ── Route: directions fetches API; flight uses a local arc; GPX uses parsed coords ──
  // Mapbox rejects long cycling/walking routes — use OSRM for those profiles.
  // Flight mode computes a great-circle arc synchronously — no API call needed.
  const routeUrl = directionsReady && travelMode !== 'flight'
    ? travelMode === 'driving'
      ? buildDirectionsUrl(startCoords!, endCoords!)
      : buildOsrmUrl(startCoords!, endCoords!, travelMode === 'cycling' ? 'cycling' : 'foot')
    : null;
  const rawRoute  = useRoute(routeUrl);
  const flightArc = directionsReady && travelMode === 'flight'
    ? buildFlightArc(startCoords!, endCoords!)
    : null;
  const rawCoords = mode === 'gpx' ? gpxCoords
                  : travelMode === 'flight' ? flightArc
                  : rawRoute;

  // Project at render time so zoom changes re-project without re-fetching
  const projectedPoints = rawCoords
    ? rawCoords.map((c) => proj(c) as [number, number] | null)
               .filter((p): p is [number, number] => p !== null)
    : null;

  // For flight mode, bow the arc away from the straight chord in screen space.
  // Each point is lifted perpendicular to the start→end vector by a sine curve —
  // maxLift = (flightCurve/100) * chordLength, peaking at the midpoint.
  // Perpendicular direction: CW rotation of chord = (dy, -dx) → upward on screen
  // for a left-to-right route, which matches the conventional flight-path look.
  const routePoints = (() => {
    if (!projectedPoints || projectedPoints.length < 2) return projectedPoints;
    if (travelMode !== 'flight' || !flightCurve) return projectedPoints;
    const [x0, y0] = projectedPoints[0];
    const [x1, y1] = projectedPoints[projectedPoints.length - 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    if (chordLen === 0) return projectedPoints;
    // CW perpendicular (upward on screen for east→west routes)
    const px = dy / chordLen;
    const py = -dx / chordLen;
    const maxLift = (flightCurve / 100) * chordLen * 0.5; // 0.5 so value 100 = half chord
    return projectedPoints.map(([x, y], i) => {
      const t = i / (projectedPoints.length - 1);
      const lift = maxLift * Math.sin(Math.PI * t);
      return [x + px * lift, y + py * lift] as [number, number];
    });
  })();

  // ── Marker pixel positions ─────────────────────────────────────────────
  const resolvedStart = mode === "directions" ? startCoords
                      : gpxReady ? gpxCoords![0] : null;
  const resolvedEnd   = mode === "directions" ? endCoords
                      : gpxReady ? gpxCoords![gpxCoords!.length - 1] : null;

  const startPx = resolvedStart ? (proj(resolvedStart) ?? [0, 0]) : [0, 0];
  const endPx   = resolvedEnd   ? (proj(resolvedEnd)   ?? [0, 0]) : [0, 0];

  // ── Scaled timing (proportional to total duration) ───────────────────
  const routeStart   = 0;
  const routeEnd     = Math.round(dur * 0.867);  //  ~4.33s of 5s
  const endFadeIn    = Math.round(dur * 0.800);  //  ~4.00s of 5s
  const endFadeEnd   = Math.round(dur * 0.947);  //  ~4.73s of 5s
  const startBoxEnd  = Math.round(dur * 0.267);  //  ~1.33s of 5s
  const endBoxEnd    = Math.round(dur * 0.967);  //  ~4.83s of 5s

  // ── No fade-in — map is fully visible from frame 0 ───────────────────
  const mapOpacity = 1;

  // ── Route progress ────────────────────────────────────────────────────
  const routeT       = easeInOutCubic(windowT(frame, routeStart, routeEnd));
  const visibleCount = routePoints
    ? Math.max(1, Math.floor(routeT * routePoints.length))
    : 0;
  const visiblePts = routePoints ? routePoints.slice(0, visibleCount) : [];
  const routeD = visiblePts.length > 1
    ? "M " + visiblePts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")
    : "";

  // ── Elevation profile ─────────────────────────────────────────────────
  // Box position and size are driven by props (all in % of canvas dimensions)
  // so the user can place and size it freely in the form.
  const ELEV_LEFT = Math.round((elevationLeft   / 100) * width);
  const ELEV_TOP  = Math.round((elevationTop    / 100) * height);
  const ELEV_W    = Math.round((elevationWidth  / 100) * width);
  const ELEV_H    = Math.round((elevationHeight / 100) * height);
  const ELEV_PAD  = Math.round(ELEV_H * 0.12);

  const elevProfile = (() => {
    if (!showElevationProfile || mode !== 'gpx' || gpxElevations.length < 2) return null;
    const total   = gpxElevations.length;
    const visible = Math.max(2, Math.round((visibleCount / (routePoints?.length ?? total)) * total));
    const slice   = gpxElevations.slice(0, visible);
    const minE    = Math.min(...slice);
    const maxE    = Math.max(...gpxElevations); // full range stays stable throughout animation
    const range   = Math.max(maxE - minE, 1);

    const pts = slice.map((e, i) => [
      ELEV_LEFT + (i / (total - 1)) * ELEV_W,
      ELEV_TOP + ELEV_PAD + (1 - (e - minE) / range) * (ELEV_H - 2 * ELEV_PAD),
    ] as [number, number]);

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const last  = pts[pts.length - 1];
    const areaD = `${lineD} L${last[0].toFixed(1)},${ELEV_TOP + ELEV_H} L${ELEV_LEFT},${ELEV_TOP + ELEV_H} Z`;

    return { lineD, areaD, minE, maxE };
  })();

  // ── Route tip marker ──────────────────────────────────────────────────────
  // The marker badge follows the leading point of the drawn line.
  const markerActive = routeMarker !== 'none' && visiblePts.length >= 2;
  const markerTip = markerActive ? visiblePts[visiblePts.length - 1] : null;

  // Icon is always upright — no rotation applied.

  // Scale factor: design space is ±10 units; badge radius = routeMarkerSize / 2.
  // Divide by 18 so the icon fills ~55 % of the badge diameter, leaving clear
  // breathing room between the icon silhouette and the badge edge.
  const markerR     = (routeMarkerSize ?? 60) / 2;
  const markerScale = markerR / 18;

  // ── Endpoint opacities ────────────────────────────────────────────────
  const startO = 1;
  const endO   = labelMode === 'on' ? 1
               : easeOutCubic(windowT(frame, endFadeIn, endFadeEnd));

  // ── Label box dimensions ─────────────────────────────────────────────
  const startFullW = labelBoxWidth(startLabel, labelFont);
  const endFullW   = labelBoxWidth(endLabel,   labelFont);

  // ── Label box positioning ─────────────────────────────────────────────
  const LABEL_EDGE = 20;
  const BOX_H      = 52;
  const DOT_R      = pinSize;
  const LABEL_GAP  = 8;

  // Pick the label placement (above / below / left / right of the pin) that
  // minimises overlap with the route.  Strategy:
  //   1. Initial score = dot product of candidate direction with the "away" vector
  //      (direction that points away from the route body at the pin).
  //   2. Collision penalty = number of route points that fall inside an expanded
  //      label box (with 15 px padding), excluding points very close to the pin
  //      itself (those are always near every candidate).  Each overlapping point
  //      subtracts 0.3 from the score, so even a handful of overlapping points
  //      will override the directional preference.
  //   3. After scoring, only candidates that fit within the canvas are considered.
  const lookPct = Math.max(1, Math.floor((routePoints?.length ?? 0) * 0.06));

  // "Away" direction for start = opposite of route departure direction.
  const startAway: [number, number] = (() => {
    if (!routePoints || routePoints.length < 2) return [-1, 0];
    const i = Math.min(lookPct, routePoints.length - 1);
    const dx = routePoints[0][0] - routePoints[i][0];
    const dy = routePoints[0][1] - routePoints[i][1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / len, dy / len];
  })();
  // "Away" direction for end = arrival direction (route body is behind the pin).
  const endAway: [number, number] = (() => {
    if (!routePoints || routePoints.length < 2) return [1, 0];
    const n = routePoints.length;
    const i = Math.max(0, n - 1 - lookPct);
    const dx = routePoints[n - 1][0] - routePoints[i][0];
    const dy = routePoints[n - 1][1] - routePoints[i][1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / len, dy / len];
  })();

  // True line-segment vs expanded-box intersection test.
  // Returns true if the segment (x1,y1)→(x2,y2) crosses the AABB [bx,bx+bw]×[by,by+bh].
  function segHitsBox(
    x1: number, y1: number, x2: number, y2: number,
    bx: number, by: number, bw: number, bh: number,
  ): boolean {
    if (Math.max(x1,x2) < bx || Math.min(x1,x2) > bx+bw) return false;
    if (Math.max(y1,y2) < by || Math.min(y1,y2) > by+bh) return false;
    if (x1>=bx&&x1<=bx+bw&&y1>=by&&y1<=by+bh) return true;
    if (x2>=bx&&x2<=bx+bw&&y2>=by&&y2<=by+bh) return true;
    const dx = x2-x1, dy = y2-y1;
    const crossV = (xv: number) => {
      if (Math.abs(dx)<1e-9) return false;
      const t=(xv-x1)/dx; if(t<0||t>1) return false;
      const yt=y1+t*dy; return yt>=by&&yt<=by+bh;
    };
    const crossH = (yh: number) => {
      if (Math.abs(dy)<1e-9) return false;
      const t=(yh-y1)/dy; if(t<0||t>1) return false;
      const xt=x1+t*dx; return xt>=bx&&xt<=bx+bw;
    };
    return crossV(bx)||crossV(bx+bw)||crossH(by)||crossH(by+bh);
  }

  function bestLabelPos(
    px: number, py: number,
    [ax, ay]: [number, number],
    boxW: number,
  ): { x: number; y: number } {
    const candidates = [
      { x: px - boxW / 2,                 y: py - DOT_R - LABEL_GAP - BOX_H, score: -ay }, // above
      { x: px - boxW / 2,                 y: py + DOT_R + LABEL_GAP,          score:  ay }, // below
      { x: px - DOT_R - LABEL_GAP - boxW, y: py - BOX_H / 2,                  score: -ax }, // left
      { x: px + DOT_R + LABEL_GAP,        y: py - BOX_H / 2,                  score:  ax }, // right
    ];

    // Penalise any candidate whose expanded box is crossed by a route segment.
    // Expand by half the line width so even the stroke edge is counted.
    // Points very close to the pin are skipped to avoid penalising all candidates.
    if (routePoints && routePoints.length >= 2) {
      const PIN_IGNORE = DOT_R + LABEL_GAP + 5;
      const EXP = lineWidth / 2 + 4; // expand box by stroke radius + small margin
      for (const c of candidates) {
        let hits = 0;
        for (let j = 1; j < routePoints.length; j++) {
          const [x1, y1] = routePoints[j - 1];
          const [x2, y2] = routePoints[j];
          // Skip segments whose midpoint is too close to the pin
          const mx = (x1+x2)/2, my = (y1+y2)/2;
          if (Math.sqrt((mx-px)**2+(my-py)**2) <= PIN_IGNORE) continue;
          if (segHitsBox(x1,y1,x2,y2, c.x-EXP, c.y-EXP, boxW+2*EXP, BOX_H+2*EXP)) hits++;
        }
        c.score -= hits * 3; // one crossing segment is enough to strongly disfavour this slot
      }
    }

    const fits = candidates.filter(c =>
      c.x >= LABEL_EDGE && c.x + boxW <= width  - LABEL_EDGE &&
      c.y >= LABEL_EDGE && c.y + BOX_H <= height - LABEL_EDGE
    );
    const pool = fits.length > 0 ? fits : candidates;
    pool.sort((a, b) => b.score - a.score);
    const best = pool[0];
    return {
      x: Math.max(LABEL_EDGE, Math.min(best.x, width  - LABEL_EDGE - boxW)),
      y: Math.max(LABEL_EDGE, Math.min(best.y, height - LABEL_EDGE - BOX_H)),
    };
  }

  const { x: startLabelX, y: startLabelY } = bestLabelPos(startPx[0], startPx[1], startAway, startFullW);
  const { x: endLabelX,   y: endLabelY   } = bestLabelPos(endPx[0],   endPx[1],   endAway,   endFullW);

  // ── Label animation state ─────────────────────────────────────────────
  // 'on'  → t=1 (fully revealed immediately, no animation)
  // 'animated' → t runs 0→1 over the reveal window
  // 'off' → labels not rendered; t=0 as safe fallback
  const startT = labelMode === 'on' ? 1 : windowT(frame, 0, startBoxEnd);
  const endT   = labelMode === 'on' ? 1 : windowT(frame, endFadeIn, endBoxEnd);
  const startAnim = getLabelAnim(labelAnimation, startT, startLabelX, startLabelY, startFullW, BOX_H, startPx[0], startLabel);
  const endAnim   = getLabelAnim(labelAnimation, endT,   endLabelX,   endLabelY,   endFullW,   BOX_H, endPx[0],   endLabel);

  return (
    <AbsoluteFill style={{ background: mapStyle === 'none' ? mapBgColor : C.bg }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <clipPath id="startClip">
            <rect x={startAnim.clipX} y={startAnim.clipY} width={startAnim.clipW} height={startAnim.clipH} />
          </clipPath>
          <clipPath id="endClip">
            <rect x={endAnim.clipX} y={endAnim.clipY} width={endAnim.clipW} height={endAnim.clipH} />
          </clipPath>

          {/* ── Pencil filters (only mounted when needed) ─────────────── */}
          {lineStyle === "pencil" && <>
            <filter id="pencilA" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed={42} result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise"
                scale={lineWidth * pencilStrength * 0.15}
                xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="pencilB" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed={17} result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise"
                scale={lineWidth * pencilStrength * 0.09}
                xChannelSelector="R" yChannelSelector="G"/>
            </filter>
          </>}
        </defs>

        {/* ── Map tile ──────────────────────────────────────────────────── */}
        {tileUrl && mapStyle !== 'none' && (
          <image
            href={tileUrl}
            x={0} y={0}
            width={width} height={height}
            preserveAspectRatio="none"
            opacity={mapOpacity}
          />
        )}

        {/* ── Major city dots + labels ──────────────────────────────────── */}
        {/* minPopulation === 0 is the "hide all" sentinel                   */}
        <g opacity={mapOpacity}>
          {MAJOR_CITIES.filter((c) => minPopulation > 0 && c.pop >= minPopulation).map(({ name, lnglat, pop }) => {
            const px = proj(lnglat);
            if (!px) return null;
            const [cx, cy] = px;
            if (cx < 0 || cx > width || cy < 0 || cy > height) return null;

            // ── Three-tier font sizing ─────────────────────────────────────
            const isBig    = pop > 1_000_000;
            const isMedium = pop > 200_000 && pop <= 1_000_000;
            const fontSize   = isBig ? citySizeBig : isMedium ? citySizeMedium : citySizeSmall;
            const fontWeight = isBig ? "700" : "500";
            const fill       = isBig ? cityColorBig : isMedium ? cityColorMedium : cityColorSmall;
            const dotR       = isBig ? 4 : isMedium ? 3 : 2;

            return (
              <g key={name}>
                <circle cx={cx} cy={cy} r={dotR} fill={C.cityDot} />
                <text
                  x={cx + 6} y={cy + fontSize * 0.35}
                  fontSize={fontSize}
                  fontFamily={CITY_FONT_MAP[cityFont]?.family ?? "'Helvetica Neue', Arial, sans-serif"}
                  fontWeight={fontWeight}
                  fill={fill}
                  letterSpacing={cityUppercase ? 1.2 : 0.3}
                  style={{ textTransform: cityUppercase ? "uppercase" : "none" }}
                >
                  {name}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Road route line ───────────────────────────────────────────── */}
        {routeD && (lineStyle === "pencil" ? (
          // ── Pencil: two displaced strokes for hand-drawn feel ─────────
          <>
            <path
              d={routeD} fill="none" stroke={lineColor}
              strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round"
              opacity={0.85} filter="url(#pencilA)"
            />
            <path
              d={routeD} fill="none" stroke={lineColor}
              strokeWidth={lineWidth * 0.55} strokeLinecap="round" strokeLinejoin="round"
              opacity={0.35} filter="url(#pencilB)"
            />
          </>
        ) : (
          // ── Dasharray styles ──────────────────────────────────────────
          (() => {
            const w = lineWidth;
            const dashProps: Record<string, string | undefined> = {
              solid:       undefined,
              dashed:      `${w * 4} ${w * 2}`,
              dotted:      `0 ${w * 2.5}`,
              "long-dash": `${w * 8} ${w * 2.5}`,
              "dash-dot":  `${w * 4} ${w * 2} 0 ${w * 2}`,
            };
            const dashArray = dashProps[lineStyle];
            return (
              <path
                d={routeD} fill="none" stroke={lineColor}
                strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round"
                {...(dashArray ? { strokeDasharray: dashArray } : {})}
              />
            );
          })()
        ))}

        {/* ── Elevation profile ─────────────────────────────────────────── */}
        {elevProfile && (
          <g>
            <rect x={ELEV_LEFT} y={ELEV_TOP} width={ELEV_W} height={ELEV_H}
              rx={8} fill={elevationBgColor} />
            <path d={elevProfile.areaD}
              fill={elevationColor} fillOpacity={0.15} stroke="none" />
            <path d={elevProfile.lineD}
              fill="none" stroke={elevationColor} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
            <text x={ELEV_LEFT + 10} y={ELEV_TOP + ELEV_PAD + 16}
              fontSize={22} fill={elevationColor} fillOpacity={0.65}
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {Math.round(elevProfile.maxE)}m
            </text>
            <text x={ELEV_LEFT + 10} y={ELEV_TOP + ELEV_H - 10}
              fontSize={22} fill={elevationColor} fillOpacity={0.65}
              fontFamily="'Helvetica Neue', Arial, sans-serif">
              {Math.round(elevProfile.minE)}m
            </text>
          </g>
        )}

        {/* ── Start marker ──────────────────────────────────────────────── */}
        {/* Pin dot always visible; label box only when labelMode !== 'off' */}
        {labelMode !== 'off' && (
        <g opacity={startO}>
          <g clipPath="url(#startClip)" opacity={startAnim.opacity}>
            <g transform={startAnim.transform || undefined}>
              <rect
                x={startLabelX} y={startLabelY}
                width={startFullW} height={BOX_H} rx={6}
                fill={labelBgColor}
              />
              <text
                x={startLabelX + 12} y={startLabelY + 40}
                fontSize={40}
                fontFamily={CITY_FONT_MAP[labelFont]?.family ?? "'Helvetica Neue', Arial, sans-serif"}
                fontWeight="700"
                fill={labelTextColor}
                letterSpacing={0.4}
              >
                {startLabel}
              </text>
            </g>
          </g>
        </g>
        )}
        <circle cx={startPx[0]} cy={startPx[1]} r={pinSize} fill={lineColor} />

        {/* ── End marker (fades in when line arrives) ───────────────────── */}
        {labelMode !== 'off' && (
        <g opacity={endO}>
          <g clipPath="url(#endClip)" opacity={endAnim.opacity}>
            <g transform={endAnim.transform || undefined}>
              <rect
                x={endLabelX} y={endLabelY}
                width={endFullW} height={BOX_H} rx={6}
                fill={labelBgColor}
              />
              <text
                x={endLabelX + 12} y={endLabelY + 40}
                fontSize={40}
                fontFamily={CITY_FONT_MAP[labelFont]?.family ?? "'Helvetica Neue', Arial, sans-serif"}
                fontWeight="700"
                fill={labelTextColor}
                letterSpacing={0.4}
              >
                {endLabel}
              </text>
            </g>
          </g>
        </g>
        )}
        <circle cx={endPx[0]} cy={endPx[1]} r={pinSize} opacity={endO} fill={lineColor} />

        {/* ── Route tip marker badge ────────────────────────────────────── */}
        {/* Rendered last so it always appears on top of the pin dots.       */}
        {markerActive && markerTip && (
          <g transform={`translate(${markerTip[0].toFixed(1)},${markerTip[1].toFixed(1)})`}>
            <circle r={markerR} fill={lineColor}/>
            <g transform={`scale(${markerScale.toFixed(4)})`}>
              <RouteMarkerIcon type={routeMarker} color={lineColor}/>
            </g>
          </g>
        )}

      </svg>
    </AbsoluteFill>
  );
};
