/**
 * routeLabels.ts — turns route info into label text (country + city) for the
 * start/end labels (2026-09-27): used when From/To is edited, and by the
 * Labels band's "Same as route" toggle (for GPS tracks: the track's first and
 * last point, reverse-geocoded). Mapbox Geocoding v5, English names; the
 * country name is taken from our own COUNTRIES list by ISO code so it matches
 * what the country picker shows.
 */
import { COUNTRIES } from '../../src/countryData';

export interface Place {
  city:        string;
  countryCode: string; // lower-case ISO 3166-1 alpha-2, '' if unknown
  countryName: string;
}

interface Feature {
  text: string;
  place_type?: string[];
  properties?: { short_code?: string };
  context?: { id: string; text: string; short_code?: string }[];
}

const TOKEN = process.env.MAPBOX_TOKEN ?? '';

async function lookup(query: string, extra = ''): Promise<Place | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    + `?limit=1&language=en${extra}&access_token=${TOKEN}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const f: Feature | undefined = (await r.json()).features?.[0];
    if (!f) return null;
    const ctx = f.context ?? [];
    const types = f.place_type ?? [];
    const isCountry = types.includes('country');
    const code = (isCountry ? f.properties?.short_code : ctx.find(c => c.id.startsWith('country.'))?.short_code) ?? '';
    const countryCode = code.split('-')[0].toLowerCase();
    const known = COUNTRIES.find(c => c.code === countryCode);
    const city = types.includes('place') || types.includes('locality')
      ? f.text
      : ctx.find(c => c.id.startsWith('place.'))?.text
        ?? ctx.find(c => c.id.startsWith('locality.'))?.text
        ?? (isCountry ? '' : f.text);
    return {
      city,
      countryCode: known ? countryCode : '',
      countryName: known?.name ?? (isCountry ? f.text : ctx.find(c => c.id.startsWith('country.'))?.text ?? ''),
    };
  } catch {
    return null;
  }
}

/** Forward-geocode a free-text address ("Ghent, Belgium"). */
export function placeFromAddress(address: string): Promise<Place | null> {
  if (!address.trim()) return Promise.resolve(null);
  return lookup(address);
}

/** First and last point of a GPX track, reverse-geocoded. */
export async function placesFromGpx(file: string): Promise<[Place | null, Place | null]> {
  try {
    const r = await fetch(`/public/${encodeURIComponent(file)}`);
    if (!r.ok) return [null, null];
    const pts = [...(await r.text()).matchAll(/<(?:trkpt|rtept|wpt)\b[^>]*>/g)]
      .map(m => {
        const lat = /\blat="([-\d.]+)"/.exec(m[0])?.[1];
        const lon = /\blon="([-\d.]+)"/.exec(m[0])?.[1];
        return lat && lon ? [Number(lon), Number(lat)] as [number, number] : null;
      })
      .filter((p): p is [number, number] => p !== null);
    if (pts.length === 0) return [null, null];
    const at = ([lon, lat]: [number, number]) => lookup(`${lon},${lat}`, '&types=place,locality,region,country');
    return Promise.all([at(pts[0]), at(pts[pts.length - 1])]);
  } catch {
    return [null, null];
  }
}
