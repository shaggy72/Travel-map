/**
 * easing.ts — timing and interpolation utilities for Remotion animations.
 *
 * All easing functions take a normalised progress value `t` in [0, 1] and
 * return a remapped value in [0, 1].  Feed them a linear frame clock and get
 * back a smooth, physically-plausible curve for animating opacity, position,
 * scale, etc.
 *
 * Usage pattern in a Remotion component:
 *   const frame = useCurrentFrame();
 *   const { durationInFrames } = useVideoConfig();
 *   const t = frame / durationInFrames;           // raw linear 0 → 1
 *   const value = interpolateEased(t, 0, 100);    // eased 0 → 100
 */

/**
 * Smooth acceleration then deceleration — the most natural general-purpose ease.
 * Equivalent to CSS `cubic-bezier(0.645, 0.045, 0.355, 1.000)`.
 * @param t - Linear progress in [0, 1]
 * @returns Eased value in [0, 1]
 */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Stronger version of easeInOutCubic — faster acceleration, sharper snap at end.
 * Useful for elements that need more "pop" (e.g. scale reveals).
 * @param t - Linear progress in [0, 1]
 * @returns Eased value in [0, 1]
 */
export const easeInOutQuart = (t: number): number =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

/**
 * Starts fast and decelerates to a smooth stop — good for elements that "arrive"
 * (e.g. a label sliding into place, a marker appearing).
 * @param t - Linear progress in [0, 1]
 * @returns Eased value in [0, 1]
 */
export const easeOutCubic = (t: number): number =>
  1 - Math.pow(1 - t, 3);

/**
 * Starts slow and accelerates — good for elements that "depart" or build up speed.
 * @param t - Linear progress in [0, 1]
 * @returns Eased value in [0, 1]
 */
export const easeInCubic = (t: number): number => t * t * t;

/**
 * Interpolate between two numbers using an easing function.
 * Clamps `t` to [0, 1] before applying the ease so out-of-range frames are safe.
 *
 * @param t    - Linear progress (any range; clamped internally to [0, 1])
 * @param from - Output value when t = 0
 * @param to   - Output value when t = 1
 * @param ease - Easing function to apply (default: easeInOutCubic)
 * @returns    Interpolated value between `from` and `to`
 *
 * @example
 *   // Animate opacity from 0 to 1 over the first half of the video
 *   const opacity = interpolateEased(frame / (dur / 2), 0, 1);
 */
export const interpolateEased = (
  t: number,
  from: number,
  to: number,
  ease: (t: number) => number = easeInOutCubic
): number => from + (to - from) * ease(Math.max(0, Math.min(1, t)));

/**
 * Normalise a frame number to [0, 1] within a sub-window of the animation.
 * Returns 0 before the window starts and 1 after it ends.
 * Combine with an easing function to animate a property for only part of the video.
 *
 * @param t       - Current linear progress in [0, 1] (e.g. frame / durationInFrames)
 * @param startAt - Progress value where the window begins (in [0, 1])
 * @param endAt   - Progress value where the window ends (in [0, 1])
 * @returns       Normalised progress within the window, clamped to [0, 1]
 *
 * @example
 *   // Animate the end label during the last 20 % of the video
 *   const t = windowT(frame / dur, 0.8, 1.0);
 *   const opacity = easeOutCubic(t);
 */
export const windowT = (t: number, startAt: number, endAt: number): number =>
  Math.max(0, Math.min(1, (t - startAt) / (endAt - startAt)));
