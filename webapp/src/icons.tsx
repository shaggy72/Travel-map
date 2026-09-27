import React from 'react';

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
export const CarIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 16v-4l2.5-5h11L20 12v4z" /><path d="M4 12h16" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></Svg>
);
export const BikeIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l2 7" /><path d="M13.5 6H16" /></Svg>
);
export const WalkIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="13" cy="4.5" r="1.8" /><path d="M11 21l2-6-3-3 1-4 4 3 3 1M10 12l-2 3" /></Svg>
);
export const PlaneIcon = (p: IconProps) => (
  <Svg strokeWidth={1.7} {...p}><path d="M21 15v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5z" /></Svg>
);
export const CamperIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 17V8a2 2 0 0 1 2-2h10l5 5v6z" /><path d="M15 6v5h5M3 11h12" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="16.5" cy="17.5" r="1.8" /></Svg>
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
