import { delayRender, continueRender, cancelRender, staticFile } from "remotion";
import { useEffect, useState } from "react";
import { MAPBOX_TOKEN } from "./mapData";

/** Fetches a single Mapbox static image and returns a data URL (or null while loading).
 *  Pass null to skip fetching (e.g. while geocoding is still in progress). */
export function useMapboxImage(url: string | null): string | null {
  const [handle] = useState(() => delayRender("Fetching Mapbox tile"));
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return; // wait until URL is ready
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
          setImageUrl(reader.result as string);
          continueRender(handle);
        };
        reader.readAsDataURL(b as Blob);
      })
      .catch((err) => cancelRender(err));
  }, [url]);

  return imageUrl;
}

/** Geocodes a place name to [lng, lat] using the Mapbox Geocoding API.
 *  Pass null to skip (e.g. in GPX mode) — no delayRender handle is created. */
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
  }, []);

  return coords;
}

/** Parses a GPX file from the /public folder and returns raw [lng, lat] coordinates.
 *  Pass null to skip. */
export function useGpxTrack(filename: string | null): [number, number][] | null {
  const [handle] = useState(() =>
    filename ? delayRender(`Parsing GPX: ${filename}`) : null
  );
  const [coords, setCoords] = useState<[number, number][] | null>(null);

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
        const points: [number, number][] = trkpts.map((pt) => [
          parseFloat(pt.getAttribute("lon") ?? "0"),
          parseFloat(pt.getAttribute("lat") ?? "0"),
        ]);
        setCoords(points);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, []);

  return coords;
}

/** Fetches a Mapbox Directions route and returns raw [lng, lat] coordinates (or null while loading).
 *  Projection is intentionally NOT applied here — do it in the component so zoom changes
 *  re-project without re-fetching. Pass null url to skip fetching.
 *
 *  State tracks {url, coords} together so that when the URL changes (e.g. travel mode switch)
 *  the old coords are cleared immediately — preventing stale routes from showing. */
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

    if (!url) return;

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
