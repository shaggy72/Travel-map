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
    case 'plane':
      return (
        <path
          d="M10,0 L2,-5 L-2,-4 L-5,-2 L-10,-5 L-10,-2.5 L-3.5,0 L-10,2.5 L-10,5 L-5,2 L-2,4 L2,5 Z"
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
