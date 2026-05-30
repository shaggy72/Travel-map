import React, { useState, useEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import {
  CANVAS_W, CANVAS_H,
  MAJOR_CITIES,
  calcZoomAndCenter, calcZoomAndCenterFromPoints,
  buildProjection, buildMapUrl, buildDirectionsUrl, buildOsrmUrl,
} from "./mapData";
import { easeInOutCubic, easeOutCubic, windowT } from "./easing";
import { useMapboxImage, useGeocode, useGpxTrack, useRoute } from "./useMapboxImages";
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
const LABEL_CHAR_W    = 0.65 * LABEL_FONT_SIZE; // avg char width for bold Helvetica Neue
const LABEL_PADDING   = 24;                       // 12px left + 12px right

function labelBoxWidth(text: string): number {
  return Math.ceil(text.length * LABEL_CHAR_W + LABEL_PADDING);
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
      const w = n === 0 ? 0 : Math.min(n * LABEL_CHAR_W + LABEL_PADDING / 2, fw);
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
  labelMode, labelAnimation,
  lineColor, lineWidth, lineStyle, pencilStrength, labelBgColor, labelTextColor,
  minPopulation,
  cityFont,
  cityUppercase,
  cityColorBig, cityColorMedium, cityColorSmall,
  citySizeBig, citySizeMedium, citySizeSmall,
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
  const gpxCoords = useGpxTrack(mode === "gpx" ? gpxFile : null);

  // ── Compute center + zoom ─────────────────────────────────────────────
  const directionsReady = mode === "directions" && startCoords !== null && endCoords !== null;
  const gpxReady        = mode === "gpx" && gpxCoords !== null && gpxCoords.length > 1;
  const ready           = directionsReady || gpxReady;

  const { center, zoom: autoZoom } = (() => {
    if (directionsReady) return calcZoomAndCenter(startCoords!, endCoords!);
    if (gpxReady)        return calcZoomAndCenterFromPoints(gpxCoords!);
    return { center: [4.52, 47.37] as [number, number], zoom: 5.5 };
  })();

  const zoom = zoomMode === "auto" ? autoZoom : manualZoom;
  const proj = buildProjection(center, zoom);

  // ── Fetch map tile ─────────────────────────────────────────────────────
  // Always build a URL (even when mapStyle === 'none') so the delayRender
  // handle inside useMapboxImage always resolves.  We use a cheap fallback
  // style when "No map" is selected so the fetch doesn't error out.
  const mapUrl  = buildMapUrl(center, zoom, mapStyle === 'none' ? 'mapbox/light-v11' : mapStyle);
  const tileUrl = useMapboxImage(mapUrl);

  // ── Route: directions fetches API; GPX uses parsed coords directly ─────
  // Mapbox rejects long cycling/walking routes — use OSRM for those profiles
  const routeUrl = directionsReady
    ? travelMode === 'driving'
      ? buildDirectionsUrl(startCoords!, endCoords!)
      : buildOsrmUrl(startCoords!, endCoords!, travelMode === 'cycling' ? 'cycling' : 'foot')
    : null;
  const rawRoute = useRoute(routeUrl);
  const rawCoords = mode === "directions" ? rawRoute : gpxCoords;

  // Project at render time so zoom changes re-project without re-fetching
  const routePoints = rawCoords
    ? rawCoords.map((c) => proj(c) as [number, number] | null)
               .filter((p): p is [number, number] => p !== null)
    : null;

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

  // ── Endpoint opacities ────────────────────────────────────────────────
  const startO = 1;
  const endO   = labelMode === 'on' ? 1
               : easeOutCubic(windowT(frame, endFadeIn, endFadeEnd));

  // ── Label box dimensions ─────────────────────────────────────────────
  const startFullW = labelBoxWidth(startLabel);
  const endFullW   = labelBoxWidth(endLabel);

  // ── Label box positioning — clamped so labels never go off-screen ─────
  const LABEL_EDGE = 20; // min px from canvas edge
  const BOX_H      = 52;
  const DOT_R      = 6;
  const LABEL_GAP  = 8;  // clear gap between dot edge and label box

  // Horizontal: clamp so right edge stays within canvas
  const startLabelX = Math.max(LABEL_EDGE,
    Math.min(startPx[0] - 2, CANVAS_W - LABEL_EDGE - startFullW));
  const endLabelX   = Math.max(LABEL_EDGE,
    Math.min(endPx[0] - 2,   CANVAS_W - LABEL_EDGE - endFullW));

  // Vertical: label sits above the dot with a gap; flips below if too close to top
  const startLabelY = startPx[1] - DOT_R - LABEL_GAP - BOX_H >= LABEL_EDGE
    ? startPx[1] - DOT_R - LABEL_GAP - BOX_H
    : startPx[1] + DOT_R + LABEL_GAP;
  const endLabelY   = endPx[1] - DOT_R - LABEL_GAP - BOX_H >= LABEL_EDGE
    ? endPx[1] - DOT_R - LABEL_GAP - BOX_H
    : endPx[1] + DOT_R + LABEL_GAP;

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
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
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
            width={CANVAS_W} height={CANVAS_H}
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
            if (cx < 0 || cx > CANVAS_W || cy < 0 || cy > CANVAS_H) return null;

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

        {/* ── Start marker ──────────────────────────────────────────────── */}
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
                fontFamily="'Helvetica Neue', Arial, sans-serif"
                fontWeight="700"
                fill={labelTextColor}
                letterSpacing={0.4}
              >
                {startLabel}
              </text>
            </g>
          </g>
          {/* Dot drawn after label so it's always visible on top */}
          <circle cx={startPx[0]} cy={startPx[1]} r={6} fill={lineColor} />
          <circle cx={startPx[0]} cy={startPx[1]} r={3} fill={C.dot} />
        </g>
        )}

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
                fontFamily="'Helvetica Neue', Arial, sans-serif"
                fontWeight="700"
                fill={labelTextColor}
                letterSpacing={0.4}
              >
                {endLabel}
              </text>
            </g>
          </g>
          {/* Dot drawn after label so it's always visible on top */}
          <circle cx={endPx[0]} cy={endPx[1]} r={6} fill={lineColor} />
          <circle cx={endPx[0]} cy={endPx[1]} r={3} fill={C.dot} />
        </g>
        )}

      </svg>
    </AbsoluteFill>
  );
};
