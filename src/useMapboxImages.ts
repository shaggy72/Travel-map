/**
 * useMapboxImages.ts — React hooks that fetch all async data required by MapComposition.
 *
 * All four hooks use Remotion's `delayRender` / `continueRender` mechanism so that
 * the Remotion renderer waits for the fetch to complete before capturing each frame.
 * Without these, the renderer would capture a blank or stale frame.
 *
 * Hooks:
 *   useMapboxImage  — fetches a Mapbox static tile and returns a data URL
 *   useGeocode      — geocodes a place name to [lng, lat] via Mapbox Geocoding API
 *   useGpxTrack     — parses a .gpx file from /public into [lng, lat] coordinates
 *   useRoute        — fetches a driving/cycling/walking route and returns coordinates
 */
import { delayRender, continueRender, cancelRender, staticFile } from "remotion";
import { useEffect, useState } from "react";
import { MAPBOX_TOKEN } from "./mapData";

/**
 * Fetches a single Mapbox Static Images tile and returns a `data:` URL (or null while loading).
 *
 * Why a data URL instead of a plain `src` attribute?
 * Remotion's headless renderer runs in Puppeteer and may not have network access to
 * external URLs during frame capture.  Converting the tile to a data URL via FileReader
 * embeds the image bytes directly in the DOM, guaranteeing it is available on every frame.
 *
 * The `delayRender` handle is created once on mount (via `useState` initialiser) and
 * released in `continueRender` when the image is ready.  `cancelRender` is called on
 * network errors so Remotion aborts instead of hanging indefinitely.
 *
 * @param url - Mapbox Static Images API URL, or null to skip (e.g. while geocoding is pending)
 * @returns   Base64 data URL for the tile image, or null while loading
 */
export function useMapboxImage(url: string | null): string | null {
  const [handle] = useState(() => delayRender("Fetching Mapbox tile"));
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return; // wait until URL is ready

    // Guard against stale fetches: if the URL changes while a previous fetch is
    // still in flight, ignore its result.  Without this, a slow fallback tile
    // (loaded before geocoding completes) can arrive *after* the correct tile
    // and overwrite it — misaligning the route with the map.
    let cancelled = false;

    fetch(url)
      .then((r) => {
        if (!r.ok) {
          return r.text().then((text) => {
            throw new Error(`Mapbox tile error ${r.status}: ${text}`);
          });
        }
        return r.blob();
      })
      .then((b) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (cancelled) return; // discard result — a newer fetch has superseded this one
          setImageUrl(reader.result as string);
          continueRender(handle);
        };
        reader.readAsDataURL(b as Blob);
      })
      .catch((err) => { if (!cancelled) cancelRender(err); });

    return () => { cancelled = true; };
  }, [url]);

  return imageUrl;
}

/**
 * Geocodes a free-text address to [lng, lat] using the Mapbox Geocoding API.
 *
 * The fetch is triggered once on mount — the address is expected to be stable
 * (debounced upstream in MapComposition via a `key` prop change), so a `[]`
 * dependency array is correct here.  Re-geocoding on every render would cause
 * a new `delayRender` handle to accumulate on each keystroke.
 *
 * Pass null to skip entirely (e.g. in GPX mode) — no handle is created and
 * no fetch is fired, which avoids blocking the renderer on unused data.
 *
 * @param address - Human-readable place name, or null to skip
 * @returns       [longitude, latitude] pair, or null while geocoding is in progress
 */
export function useGeocode(address: string | null): [number, number] | null {
  const [handle] = useState(() =>
    address ? delayRender(`Geocoding: ${address}`) : null
  );
  const [coords, setCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!address || handle === null) return;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${encodeURIComponent(address)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!data.features || data.features.length === 0) {
          cancelRender(new Error(`Geocoding failed for: "${address}"`));
          return;
        }
        const [lng, lat] = data.features[0].center as [number, number];
        setCoords([lng, lat]);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return coords;
}

/**
/** Parsed GPX data returned by useGpxTrack. */
export interface GpxData {
  /** [longitude, latitude] pairs for every <trkpt> in the file. */
  track:      [number, number][];
  /** Elevation in metres for each trackpoint, parallel to `track`.
   *  Empty array when the file contains no <ele> tags. */
  elevations: number[];
}

/**
 * Parses a GPX track file from the /public folder and returns track coordinates
 * plus per-point elevations (when the file contains <ele> tags).
 *
 * `staticFile(filename)` resolves to `/filename` which is served from /public in both
 * the Vite dev server (via the custom `serve-gpx` middleware) and the Remotion renderer
 * (which reads directly from the filesystem).
 *
 * The GPX file is parsed with DOMParser using the `application/xml` MIME type.
 * All `<trkpt>` elements are extracted and mapped to [lon, lat] pairs — note that
 * GPX uses `lon` for the longitude attribute, not `lng`.
 *
 * @param filename - GPX filename (e.g. "my-track.gpx") or null to skip
 * @returns        GpxData with track coords and elevations, or null while loading
 */
export function useGpxTrack(filename: string | null): GpxData | null {
  const [handle] = useState(() =>
    filename ? delayRender(`Parsing GPX: ${filename}`) : null
  );
  const [data, setData] = useState<GpxData | null>(null);

  useEffect(() => {
    if (!filename || handle === null) return;
    fetch(staticFile(filename))
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load GPX file: ${filename}`);
        return r.text();
      })
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        const trkpts = Array.from(doc.querySelectorAll("trkpt"));
        if (trkpts.length === 0) {
          cancelRender(new Error(`No trackpoints found in ${filename}`));
          return;
        }
        const track: [number, number][] = trkpts.map((pt) => [
          parseFloat(pt.getAttribute("lon") ?? "0"),
          parseFloat(pt.getAttribute("lat") ?? "0"),
        ]);
        // Parse <ele> only when every trackpoint carries one; otherwise return empty.
        const rawEle = trkpts.map(pt =>
          parseFloat(pt.querySelector("ele")?.textContent ?? "")
        );
        const elevations = rawEle.every(v => isFinite(v)) ? rawEle : [];
        setData({ track, elevations });
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}

/**
 * Fetches a route from the Mapbox Directions API (driving) or OSRM (cycling/walking)
 * and returns raw [lng, lat] coordinates — projection is NOT applied here so that
 * zoom changes re-project the polyline without re-fetching the route.
 *
 * Stale-route prevention:
 *   State tracks `{url, coords}` together.  When the URL changes (e.g. travel mode
 *   switch), `coords` is cleared to `null` immediately in the same `setEntry` call,
 *   so the old route disappears from the screen before the new one arrives.
 *   The hook returns `null` whenever the stored url doesn't match the current url.
 *
 * AbortController:
 *   Each effect run creates a new AbortController.  The cleanup function aborts any
 *   in-flight fetch when the URL changes or the component unmounts, preventing
 *   setState calls on stale requests.
 *
 * Why OSRM for cycling/walking?
 *   Mapbox Directions rejects routes longer than ~24 h travel time.  Long cycling or
 *   hiking trips exceed that limit.  routing.openstreetmap.de runs separate OSRM
 *   backends per profile (routed-bike / routed-foot) and has no such restriction.
 *
 * @param url - Route API URL (Mapbox or OSRM), or null to skip
 * @returns   Array of [longitude, latitude] route coordinates, or null while loading
 */
export function useRoute(url: string | null): [number, number][] | null {
  const [handle] = useState(() => delayRender("Fetching road route"));
  // Store {url, coords} together so we can clear coords the moment url changes
  const [entry, setEntry] = useState<{ url: string | null; coords: [number, number][] | null }>({
    url: null,
    coords: null,
  });

  useEffect(() => {
    const short = url ? url.replace(/access_token=.*/, '…token').substring(0, 80) : 'null';
    console.log('[useRoute] url changed →', short);

    // No route URL needed (flight mode, GPX mode) — release the handle immediately
    // so the Remotion renderer is not blocked waiting for a fetch that will never happen.
    if (!url) {
      continueRender(handle);
      return;
    }

    // Clear coords immediately so the old route disappears while the new one loads
    setEntry({ url, coords: null });

    let active = true;
    const controller = new AbortController();

    (async () => {
      try {
        const r = await fetch(url, { signal: controller.signal });
        const data = await r.json();
        if (!active) return;
        if (!r.ok || !data.routes || data.routes.length === 0) {
          console.warn(
            `[Directions] no route returned (status=${r.status} code=${data.code ?? '—'} msg="${data.message ?? ''}")`
          );
          continueRender(handle);
          return;
        }
        const raw: [number, number][] = data.routes[0].geometry.coordinates.map(
          (c: number[]) => [c[0], c[1]] as [number, number]
        );
        console.log('[useRoute] got', raw.length, 'points');
        setEntry({ url, coords: raw });
        continueRender(handle);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[Directions] fetch error:', err);
          continueRender(handle);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [url]);

  // Only return coords that belong to the current URL — never serve stale data
  return entry.url === url ? entry.coords : null;
}
