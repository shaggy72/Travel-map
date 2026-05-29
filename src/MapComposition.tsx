import React, { useState, useEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  CANVAS_W, CANVAS_H,
  MAJOR_CITIES,
  calcZoomAndCenter, calcZoomAndCenterFromPoints,
  buildProjection, buildMapUrl, buildDirectionsUrl,
} from "./mapData";
import { easeInOutCubic, easeOutCubic, windowT } from "./easing";
import { useMapboxImage, useGeocode, useGpxTrack, useRoute } from "./useMapboxImages";
import { MapSchema } from "./schema";

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
  zoomMode, zoom: manualZoom, gpxFile,
  lineColor, lineWidth, lineStyle, pencilStrength, labelBgColor, labelTextColor,
  minPopulation,
}) => {
  const frame = useCurrentFrame();
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
  const mapUrl  = ready ? buildMapUrl(center, zoom) : null;
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
  const fadeInEnd    = Math.round(dur * 0.067);  //  ~0.33s of 5s
  const routeStart   = fadeInEnd;
  const routeEnd     = Math.round(dur * 0.867);  //  ~4.33s of 5s
  const endFadeIn    = Math.round(dur * 0.800);  //  ~4.00s of 5s
  const endFadeEnd   = Math.round(dur * 0.947);  //  ~4.73s of 5s
  const startBoxEnd  = Math.round(dur * 0.267);  //  ~1.33s of 5s
  const endBoxEnd    = Math.round(dur * 0.967);  //  ~4.83s of 5s

  // ── Global fade-in ────────────────────────────────────────────────────
  const mapOpacity = easeOutCubic(windowT(frame, 0, fadeInEnd));

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
  const startO = mapOpacity;
  const endO   = easeOutCubic(windowT(frame, endFadeIn, endFadeEnd));

  // ── Label box reveal (left → right) ──────────────────────────────────
  const startFullW = labelBoxWidth(startLabel);
  const endFullW   = labelBoxWidth(endLabel);
  const startBoxW  = easeInOutCubic(windowT(frame, fadeInEnd,  startBoxEnd)) * startFullW;
  const endBoxW    = easeInOutCubic(windowT(frame, endFadeIn,  endBoxEnd))   * endFullW;

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
            <rect x={startPx[0] - 2} y={startPx[1] - 50} width={startBoxW} height={52} />
          </clipPath>
          <clipPath id="endClip">
            <rect x={endPx[0] - 2} y={endPx[1] - 50} width={endBoxW} height={52} />
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
        <g opacity={mapOpacity}>
          {MAJOR_CITIES.filter((c) => c.pop >= minPopulation).map(({ name, lnglat }) => {
            const px = proj(lnglat);
            if (!px) return null;
            const [cx, cy] = px;
            if (cx < 0 || cx > CANVAS_W || cy < 0 || cy > CANVAS_H) return null;
            return (
              <g key={name}>
                <circle cx={cx} cy={cy} r={3} fill={C.cityDot} />
                <text
                  x={cx + 6} y={cy + 4}
                  fontSize={40}
                  fontFamily="'Helvetica Neue', Arial, sans-serif"
                  fontWeight="500"
                  fill={C.cityLabel}
                  letterSpacing={0.3}
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
        <g opacity={startO}>
          <circle cx={startPx[0]} cy={startPx[1]} r={6} fill={lineColor} />
          <circle cx={startPx[0]} cy={startPx[1]} r={3} fill={C.dot} />
          <g clipPath="url(#startClip)">
            <rect
              x={startPx[0] - 2} y={startPx[1] - 50}
              width={startFullW} height={52} rx={6}
              fill={labelBgColor}
            />
            <text
              x={startPx[0] + 10} y={startPx[1] - 10}
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

        {/* ── End marker (fades in when line arrives) ───────────────────── */}
        <g opacity={endO}>
          <circle cx={endPx[0]} cy={endPx[1]} r={6} fill={lineColor} />
          <circle cx={endPx[0]} cy={endPx[1]} r={3} fill={C.dot} />
          <g clipPath="url(#endClip)">
            <rect
              x={endPx[0] - 2} y={endPx[1] - 50}
              width={endFullW} height={52} rx={6}
              fill={labelBgColor}
            />
            <text
              x={endPx[0] + 10} y={endPx[1] - 10}
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

      </svg>
    </AbsoluteFill>
  );
};
