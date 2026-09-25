import React from 'react';

/**
 * SVG icon components for the route tip marker badge.
 *
 * All five icons are the official Google Material Symbols glyphs (Apache-2.0
 * licensed), not hand-drawn — the original hand-drawn set was replaced
 * 2026-09-25 after user feedback on the plane icon ("lijkt meer op een vis").
 * Each glyph's original path is embedded unmodified inside a
 * `<g transform="scale(0.025) translate(-480,480)">` wrapper, which recentres
 * Material's 960×960 (viewBox "0 -960 960 960") grid on the origin and scales
 * it into this project's ±10-unit design space — the same recipe for every
 * icon, so relative sizing between icons matches Google's own design grid.
 * No per-icon rotation was needed: car/shuttle/bike/walk are already
 * naturally right-facing (or symmetric) in their source orientation; only
 * `flight` (naturally nose-up, for "departure") needed a 90° reorientation,
 * done by hand-transforming its points directly rather than via a `<g>`
 * rotate, since that path was already being simplified (rounded nose → sharp
 * point) — see the comment on that case below.
 *
 * Unlike the old hand-drawn icons, none of these need a badge-colour cutout
 * for "transparent" details (no windshields/wheel-hubs to punch out) — every
 * icon is a single flat white silhouette, so `RouteMarkerIcon` no longer
 * takes a `color` prop.
 *
 * @param type - one of the supported marker values from the schema
 */
export function RouteMarkerIcon({ type }: { type: string }) {
  switch (type) {

    // ── Car — Material Symbols "directions_car" ───────────────────────────
    case 'car':
      return (
        <g transform="scale(0.025) translate(-480,480)">
          <path fill="white" d="M240-200v40q0 17-11.5 28.5T200-120h-40q-17 0-28.5-11.5T120-160v-320l84-240q6-18 21.5-29t34.5-11h440q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-120h-40q-17 0-28.5-11.5T720-160v-40H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"/>
        </g>
      );

    // ── Camper — Material Symbols "airport_shuttle" (closest official glyph;
    //    there is no dedicated "camper van" icon in Material Symbols) ──────
    case 'camper':
      return (
        <g transform="scale(0.025) translate(-480,480)">
          <path fill="white" d="M240-200q-50 0-85-35t-35-85H40v-360q0-33 23.5-56.5T120-760h560l240 240v200h-80q0 50-35 85t-85 35q-50 0-85-35t-35-85H360q0 50-35 85t-85 35Zm360-360h160L640-680h-40v120Zm-240 0h160v-120H360v120Zm-240 0h160v-120H120v120Zm120 290q21 0 35.5-14.5T290-320q0-21-14.5-35.5T240-370q-21 0-35.5 14.5T190-320q0 21 14.5 35.5T240-270Zm480 0q21 0 35.5-14.5T770-320q0-21-14.5-35.5T720-370q-21 0-35.5 14.5T670-320q0 21 14.5 35.5T720-270ZM120-400h32q17-18 39-29t49-11q27 0 49 11t39 29h304q17-18 39-29t49-11q27 0 49 11t39 29h32v-80H120v80Zm720-80H120h720Z"/>
        </g>
      );

    // ── Aeroplane (top-down view, nose at right) ─────────────────────────────
    // Google Material Symbols "flight" glyph, traced from the official path
    // and reoriented by hand: original viewBox is 0..960/-960..0 with the
    // nose pointing up; recentred on its 800×800 bounding box, rotated 90°
    // clockwise (nose-up → nose-right, matching this project's convention),
    // then scaled ×0.025 to fit the ±10 design space. Source path:
    // https://github.com/google/material-design-icons materialsymbolsoutlined/flight
    // "M340-80v-60l80-60v-220L80-320v-80l340-200v-220q0-25 17.5-42.5T480-880
    //  q25 0 42.5 17.5T540-820v220l340 200v80L540-420v220l80 60v60l-140-40-140 40Z"
    // (the small rounded nose bezier is simplified to a sharp point — invisible
    // at badge scale). Hand-transformed rather than wrapped in a `<g rotate>`
    // because of that simplification; the other icons need no rotation so
    // they keep the original path data unmodified inside a `<g transform>`.
    case 'plane':
      return (
        <path
          fill="white"
          d="M-10,-3.5 L-8.5,-3.5 L-7,-1.5 L-1.5,-1.5 L-4,-10 L-2,-10 L3,-1.5 L8.5,-1.5 L10,0 L8.5,1.5 L3,1.5 L-2,10 L-4,10 L-1.5,1.5 L-7,1.5 L-8.5,3.5 L-10,3.5 L-9,0 Z"
        />
      );

    // ── Bicycle — Material Symbols "pedal_bike" ────────────────────────────
    case 'bike':
      return (
        <g transform="scale(0.025) translate(-480,480)">
          <path fill="white" d="M200-160q-85 0-142.5-57.5T0-360q0-85 58.5-142.5T200-560q77 0 129.5 46T396-400h26l-72-200h-70v-80h200v80h-44l14 40h192l-58-160H480v-80h104q26 0 46.5 14t29.5 38l68 186h32q83 0 141.5 58.5T960-362q0 84-58 143t-142 59q-72 0-126.5-45T564-320H396q-14 69-68 114.5T200-160Zm0-80q41 0 70.5-22.5T312-320H200v-80h112q-12-36-41.5-58T200-480q-51 0-85.5 34.5T80-360q0 50 34.5 85t85.5 35Zm308-160h56q5-23 13.5-43t22.5-37H478l30 80Zm252 160q51 0 85.5-35t34.5-85q0-51-34.5-85.5T760-480h-4l40 106-76 28-38-106q-20 17-31 40t-11 52q0 50 34.5 85t85.5 35ZM196-360Zm564 0Z"/>
        </g>
      );

    // ── Walking person — Material Symbols "directions_walk" ────────────────
    case 'walk':
      return (
        <g transform="scale(0.025) translate(-480,480)">
          <path fill="white" d="m280-40 112-564-72 28v136h-80v-188l202-86q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q26 42 70.5 69T760-520v80q-70 0-125-29t-94-74l-25 123 84 80v300h-80v-260l-84-64-72 324h-84Zm260-700q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"/>
        </g>
      );

    default:
      return null;
  }
}
