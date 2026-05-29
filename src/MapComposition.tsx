import React, { useState, useEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import {
  CANVAS_W, CANVAS_H,
  MAJOR_CITIES,
  calcZoomAndCenter, calcZoomAndCenterFromPoints,
  buildProjection, buildMapUrl, buildDirectionsUrl,
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
  mode, startAddress, endAddress, startLabel, endLabel,
  mapStyle,
  zoomMode, zoom: manualZoom, gpxFile,
  labelMode,
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
  // Always build the URL — center/zoom always has a valid fallback value,
  // so the map stays visible while GPX data or geocoding is still loading.
  const mapUrl  = buildMapUrl(center, zoom, mapStyle);
  const tileUrl = useMapboxImage(mapUrl);

  // ── Route: directions fetches API; GPX uses parsed coords directly ─────
  const routeUrl = directionsReady ? buildDirectionsUrl(startCoords!, endCoords!) : null;
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

  // ── Label box reveal (left → right) ──────────────────────────────────
  const startFullW = labelBoxWidth(startLabel);
  const endFullW   = labelBoxWidth(endLabel);
  // 'on'       → full width immediately, no animation
  // 'animated' → left-to-right reveal (original behaviour)
  // 'off'      → 0 (labels not rendered anyway, but safe fallback)
  const startBoxW  = labelMode === 'on' ? startFullW
                   : labelMode === 'animated' ? easeInOutCubic(windowT(frame, 0,         startBoxEnd)) * startFullW
                   : 0;
  const endBoxW    = labelMode === 'on' ? endFullW
                   : labelMode === 'animated' ? easeInOutCubic(windowT(frame, endFadeIn, endBoxEnd))   * endFullW
                   : 0;

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

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <clipPath id="startClip">
            <rect x={startLabelX} y={startLabelY} width={startBoxW} height={BOX_H} />
          </clipPath>
          <clipPath id="endClip">
            <rect x={endLabelX} y={endLabelY} width={endBoxW} height={BOX_H} />
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
        {tileUrl && (
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
          <g clipPath="url(#startClip)">
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
          {/* Dot drawn after label so it's always visible on top */}
          <circle cx={startPx[0]} cy={startPx[1]} r={6} fill={lineColor} />
          <circle cx={startPx[0]} cy={startPx[1]} r={3} fill={C.dot} />
        </g>
        )}

        {/* ── End marker (fades in when line arrives) ───────────────────── */}
        {labelMode !== 'off' && (
        <g opacity={endO}>
          <g clipPath="url(#endClip)">
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
          {/* Dot drawn after label so it's always visible on top */}
          <circle cx={endPx[0]} cy={endPx[1]} r={6} fill={lineColor} />
          <circle cx={endPx[0]} cy={endPx[1]} r={3} fill={C.dot} />
        </g>
        )}

      </svg>
    </AbsoluteFill>
  );
};
