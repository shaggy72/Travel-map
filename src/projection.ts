// Mercator projection helpers

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Point {
  x: number;
  y: number;
}

// Convert lat/lng to Mercator [0,1] normalized coordinates
export function mercatorProject(latLng: LatLng): Point {
  const x = (latLng.lng + 180) / 360;
  const sinLat = Math.sin((latLng.lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return { x, y };
}

// Map a normalized mercator point to canvas pixel coordinates
// given a viewport: center (normalized), scale (pixels per unit), canvas size
export function toCanvas(
  point: Point,
  centerNorm: Point,
  scale: number,
  canvasW: number,
  canvasH: number
): Point {
  return {
    x: (point.x - centerNorm.x) * scale + canvasW / 2,
    y: (point.y - centerNorm.y) * scale + canvasH / 2,
  };
}

// Compute scale such that a lat/lng bounding box fits within the canvas
export function fitScale(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  canvasW: number,
  canvasH: number,
  padding = 0.85
): number {
  const tl = mercatorProject({ lat: maxLat, lng: minLng });
  const br = mercatorProject({ lat: minLat, lng: maxLng });
  const dX = br.x - tl.x;
  const dY = br.y - tl.y;
  return Math.min((canvasW * padding) / dX, (canvasH * padding) / dY);
}

// Geographic center of a bounding box (mercator normalized)
export function bboxCenter(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Point {
  const tl = mercatorProject({ lat: maxLat, lng: minLng });
  const br = mercatorProject({ lat: minLat, lng: maxLng });
  return { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 };
}
