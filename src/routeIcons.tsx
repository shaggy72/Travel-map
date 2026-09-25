import React from 'react';

/**
 * SVG icon components for the route tip marker badge.
 *
 * Each icon is drawn in a ±10-unit design space, centered at the origin, and
 * faces right (→).  The caller applies a translate + rotate transform so the
 * badge follows the tip of the route line and points in the direction of travel.
 *
 * @param type  - one of the supported marker values from the schema
 * @param color - the badge background colour (= lineColor), reused for cutout
 *                details such as windshields and wheel hubs so they read as
 *                "transparent" holes in the white icon silhouette.
 */
export function RouteMarkerIcon({ type, color }: { type: string; color: string }) {
  switch (type) {

    // ── Car (side view, front at right) ─────────────────────────────────────
    case 'car':
      return (
        <>
          {/* Body */}
          <path d="M-10,4 L-10,0 L-7,-5 L-2,-8 L6,-8 L9,-4 L10,-4 L10,4 Z" fill="white"/>
          {/* Windshield cutout — badge colour makes it look transparent */}
          <polygon points="-5,-1 -3,-6 4,-6 7,-2" fill={color}/>
          {/* Wheels */}
          <circle cx="-5.5" cy="5" r="4" fill="white"/>
          <circle cx="5.5" cy="5" r="4" fill="white"/>
          {/* Wheel hubs */}
          <circle cx="-5.5" cy="5" r="1.5" fill={color}/>
          <circle cx="5.5" cy="5" r="1.5" fill={color}/>
        </>
      );

    // ── Camper van (VW T1 Bus with surfboard, front at right) ───────────────────
    case 'camper':
      return (
        <>
          {/* Surfboard on roof — tapers at both ends */}
          <path d="M-8,-6.5 Q0,-8.5 8,-7 L8,-6 Q0,-7.5 -8,-5.5 Z" fill="white"/>
          {/* Surfboard fin at rear-left end */}
          <path d="M-6,-6.5 L-8,-9 L-4,-6.5 Z" fill="white"/>
          {/* Roof rack posts connecting body to surfboard */}
          <line x1="-2" y1="-6" x2="-2" y2="-6.5" stroke={color} strokeWidth="0.8"/>
          <line x1="3"  y1="-6" x2="3"  y2="-6.5" stroke={color} strokeWidth="0.8"/>
          {/* VW Bus body: flat rear + flat roof + rounded front nose */}
          <path d="M-9,3 L-9,-6 L5,-6 Q9,-6 9,-1 L9,3 Z" fill="white"/>
          {/* Windshield cutout (badge colour = reads as transparent) */}
          <polygon points="5,-5.5 8.5,-2 8.5,0.5 5,0.5" fill={color}/>
          {/* Side window band — three windows across the upper body */}
          <rect x="-8" y="-5.5" width="11.5" height="3.5" rx="0.5" fill={color}/>
          {/* Wheels — protrude below body bottom (y = 3) for natural silhouette */}
          <circle cx="-5"  cy="5.5" r="4"   fill="white"/>
          <circle cx="4.5" cy="5.5" r="4"   fill="white"/>
          {/* Wheel hubs */}
          <circle cx="-5"  cy="5.5" r="1.5" fill={color}/>
          <circle cx="4.5" cy="5.5" r="1.5" fill={color}/>
        </>
      );

    // ── Aeroplane (top-down view, nose at right) ─────────────────────────────
    // Google Material Symbols "flight" glyph (Apache-2.0), traced from the
    // official path and reoriented: original viewBox is 0..960/-960..0 with
    // the nose pointing up; recentred on its 800×800 bounding box, rotated 90°
    // clockwise (nose-up → nose-right, matching this project's convention),
    // then scaled ×0.025 to fit the ±10 design space. Source path:
    // https://github.com/google/material-design-icons materialsymbolsoutlined/flight
    // "M340-80v-60l80-60v-220L80-320v-80l340-200v-220q0-25 17.5-42.5T480-880
    //  q25 0 42.5 17.5T540-820v220l340 200v80L540-420v220l80 60v60l-140-40-140 40Z"
    // (the small rounded nose bezier is simplified to a sharp point — invisible
    // at badge scale). Replaces the earlier hand-drawn version, which read as a
    // fish/arrow rather than a plane — verified by rendering both in a browser.
    case 'plane':
      return (
        <path
          d="M-10,-3.5 L-8.5,-3.5 L-7,-1.5 L-1.5,-1.5 L-4,-10 L-2,-10 L3,-1.5 L8.5,-1.5 L10,0 L8.5,1.5 L3,1.5 L-2,10 L-4,10 L-1.5,1.5 L-7,1.5 L-8.5,3.5 L-10,3.5 L-9,0 Z"
          fill="white"
        />
      );

    // ── Bicycle (side view, front wheel at right) ────────────────────────────
    case 'bike':
      return (
        <>
          {/* Rear wheel */}
          <circle cx="-5" cy="3" r="5" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Front wheel */}
          <circle cx="5" cy="3" r="5" fill="none" stroke="white" strokeWidth="2.5"/>
          {/* Frame: rear axle → apex → front axle */}
          <polyline
            points="-5,3 0,-4 5,3"
            stroke="white" strokeWidth="2.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
          />
          {/* Seat */}
          <line x1="-2" y1="-4" x2="2" y2="-4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          {/* Fork + handlebar */}
          <line x1="4.5" y1="-4" x2="4.5" y2="-7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="3" y1="-7" x2="6" y2="-7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </>
      );

    // ── Walking person (side view, facing right) ─────────────────────────────
    case 'walk':
      return (
        <>
          {/* Head */}
          <circle cx="2" cy="-7" r="2.5" fill="white"/>
          {/* Torso (slight forward lean) */}
          <line x1="2" y1="-4.5" x2="1" y2="1" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Leading arm */}
          <line x1="1.5" y1="-2.5" x2="6" y2="-0.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          {/* Trailing arm */}
          <line x1="1.5" y1="-2.5" x2="-3" y2="-1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          {/* Leading leg */}
          <line x1="1" y1="1" x2="5" y2="8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Trailing leg */}
          <line x1="1" y1="1" x2="-3" y2="8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      );

    default:
      return null;
  }
}
