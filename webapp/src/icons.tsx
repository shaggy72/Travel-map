import React from 'react';
import { RouteMarkerIcon } from '../../src/routeIcons';

type IconProps = { size?: number; strokeWidth?: number };

function Svg({ size = 18, strokeWidth = 1.9, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const RouteIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" /></Svg>
);
export const TagIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></Svg>
);
export const LineIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 17l6-6 4 4 8-8" /><circle cx="21" cy="7" r="1.4" /><circle cx="3" cy="17" r="1.4" /></Svg>
);
export const MapIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></Svg>
);
export const NoneIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M6.5 17.5l11-11" /></Svg>
);
export const BookmarkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 3h12v18l-6-4-6 4z" /></Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.3} {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const MinusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.3} {...p}><path d="M5 12h14" /></Svg>
);
export const ArrowIcon = (p: IconProps) => (
  <Svg strokeWidth={2.3} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}><path d="M6 9l6 6 6-6" /></Svg>
);
export const UpDownIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const UploadIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 16V5M7 10l5-5 5 5M5 20h14" /></Svg>
);
export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></Svg>
);

export function PlayIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.5v17l14-8.5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Vehicle glyphs — the exact same Material Symbols paths the video uses for
 *  the route-tip marker badge (src/routeIcons.tsx), so the sidebar buttons
 *  match what appears on the map. type: car | camper | plane | bike | walk. */
export function VehicleIcon({ type, size = 20 }: { type: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <RouteMarkerIcon type={type} fill="currentColor" />
    </svg>
  );
}
