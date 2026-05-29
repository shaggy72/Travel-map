// Cubic easing functions — all take t in [0,1] and return [0,1]
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeInOutQuart = (t: number): number =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

export const easeOutCubic = (t: number): number =>
  1 - Math.pow(1 - t, 3);

export const easeInCubic = (t: number): number => t * t * t;

// Interpolate between two numbers with an easing function
export const interpolateEased = (
  t: number,
  from: number,
  to: number,
  ease: (t: number) => number = easeInOutCubic
): number => from + (to - from) * ease(Math.max(0, Math.min(1, t)));

// Clamp t to [0,1] window defined by startAt/endAt (both in [0,1])
export const windowT = (t: number, startAt: number, endAt: number): number =>
  Math.max(0, Math.min(1, (t - startAt) / (endAt - startAt)));
