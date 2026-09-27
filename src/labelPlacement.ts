/**
 * labelPlacement.ts — picks where a start/end label box goes around its pin so
 * it doesn't cover the route line. Pure functions (no React/Remotion), used by
 * MapComposition.tsx; kept separate so the placement can be tested on its own.
 */

export type Pt = [number, number];

export interface PlacementOpts {
  width: number;          // canvas size
  height: number;
  boxH: number;           // label box height
  edge: number;           // min distance from the canvas edge
  dotR: number;           // pin (or marker badge) radius
  gap: number;            // space between pin and box
  routePoints: Pt[] | null;
  expand: number;         // collision corridor around the line (stroke / marker badge)
}

/** True if segment (x1,y1)→(x2,y2) touches the box [bx, bx+bw] × [by, by+bh]. */
export function segHitsBox(
  x1: number, y1: number, x2: number, y2: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  if (Math.max(x1, x2) < bx || Math.min(x1, x2) > bx + bw) return false;
  if (Math.max(y1, y2) < by || Math.min(y1, y2) > by + bh) return false;
  if (x1 >= bx && x1 <= bx + bw && y1 >= by && y1 <= by + bh) return true;
  if (x2 >= bx && x2 <= bx + bw && y2 >= by && y2 <= by + bh) return true;
  const dx = x2 - x1, dy = y2 - y1;
  const crossV = (xv: number) => {
    if (Math.abs(dx) < 1e-9) return false;
    const t = (xv - x1) / dx; if (t < 0 || t > 1) return false;
    const yt = y1 + t * dy; return yt >= by && yt <= by + bh;
  };
  const crossH = (yh: number) => {
    if (Math.abs(dy) < 1e-9) return false;
    const t = (yh - y1) / dy; if (t < 0 || t > 1) return false;
    const xt = x1 + t * dx; return xt >= bx && xt <= bx + bw;
  };
  return crossV(bx) || crossV(bx + bw) || crossH(by) || crossH(by + bh);
}

/**
 * Best top-left corner for a label box of width `boxW` next to the pin at
 * (px, py). `away` is the unit vector pointing away from the route body at
 * that pin (the preferred side when nothing collides).
 *
 * Eight slots (4 sides + 4 diagonals) are each shifted INTO the canvas before
 * scoring. Until 2026-09-27 slots sticking out past the edge were discarded
 * before the collision check, so with a pin near the edge (Brussels at the
 * right edge of a transatlantic flight) the only slot left was often the one
 * the route ran through — and it was picked anyway.
 */
export function bestLabelPos(
  px: number, py: number, [ax, ay]: Pt, boxW: number, o: PlacementOpts,
): { x: number; y: number } {
  const { width, height, boxH, edge, dotR, gap, routePoints, expand } = o;
  const g  = dotR + gap;
  const gd = g * Math.SQRT1_2;
  const d  = Math.SQRT1_2;
  const raw = [
    { x: px - boxW / 2,  y: py - g - boxH,  score: -ay },                   // above
    { x: px - boxW / 2,  y: py + g,         score:  ay },                   // below
    { x: px - g - boxW,  y: py - boxH / 2,  score: -ax },                   // left
    { x: px + g,         y: py - boxH / 2,  score:  ax },                   // right
    { x: px - gd - boxW, y: py - gd - boxH, score: (-ax - ay) * d - 0.05 }, // above-left
    { x: px + gd,        y: py - gd - boxH, score: ( ax - ay) * d - 0.05 }, // above-right
    { x: px - gd - boxW, y: py + gd,        score: (-ax + ay) * d - 0.05 }, // below-left
    { x: px + gd,        y: py + gd,        score: ( ax + ay) * d - 0.05 }, // below-right
  ];
  const clampX = (x: number) => Math.max(edge, Math.min(x, width  - edge - boxW));
  const clampY = (y: number) => Math.max(edge, Math.min(y, height - edge - boxH));

  const candidates = raw.map(c => {
    const x = clampX(c.x), y = clampY(c.y);
    // Small penalty for how far the slot had to be shifted, so an unshifted
    // slot still wins a tie.
    let score = c.score - (Math.abs(x - c.x) + Math.abs(y - c.y)) / 400;
    // A shift can push the box back over the pin/marker itself — rule that out.
    const nx = Math.max(x, Math.min(px, x + boxW));
    const ny = Math.max(y, Math.min(py, y + boxH));
    if ((nx - px) ** 2 + (ny - py) ** 2 < (dotR + gap / 2) ** 2) score -= 50;
    return { x, y, score };
  });

  if (routePoints && routePoints.length >= 2) {
    // Segments inside the pin/badge's own footprint are unavoidably close to
    // every slot — skip them so they don't penalise all slots equally. Must
    // stay below the box's near edge (dotR + gap) or the incoming line can cut
    // a box corner untested (bug fixed 2026-09-25).
    for (const c of candidates) {
      let hits = 0;
      for (let j = 1; j < routePoints.length; j++) {
        const [x1, y1] = routePoints[j - 1];
        const [x2, y2] = routePoints[j];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        if (Math.hypot(mx - px, my - py) <= dotR) continue;
        if (segHitsBox(x1, y1, x2, y2, c.x - expand, c.y - expand, boxW + 2 * expand, boxH + 2 * expand)) hits++;
      }
      c.score -= hits * 3; // one crossing segment is enough to strongly disfavour a slot
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return { x: candidates[0].x, y: candidates[0].y };
}
