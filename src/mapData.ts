import { geoMercator } from "d3-geo";

// ── Canvas (portrait 9:16) ────────────────────────────────────────────────
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
export const FPS = 30;
export const DURATION_FRAMES = 5 * FPS; // 150 frames

// ── Mapbox token ──────────────────────────────────────────────────────────
// Read from the MAPBOX_TOKEN environment variable (set in .env, which is gitignored).
// Vite substitutes process.env.MAPBOX_TOKEN at build time via vite.config.ts `define`.
// Remotion's bundler does the same substitution automatically.
export const MAPBOX_TOKEN: string = process.env.MAPBOX_TOKEN ?? '';

// ── Mapbox style slug ─────────────────────────────────────────────────────
export const MAPBOX_STYLE = "shaggy72/cmpma5agg000101qr4tt68gad";

// ── Projection utilities ──────────────────────────────────────────────────
// For @2x Mapbox static images: scale = 162.98 × 2^zoom
const SCALE_BASE = 162.98;

const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Calculate the map center and zoom level to fit two coordinates in the canvas. */
export function calcZoomAndCenter(
  a: [number, number],
  b: [number, number]
): { center: [number, number]; zoom: number } {
  // Mercator midpoint
  const centerLng = (a[0] + b[0]) / 2;
  const avgMercY  = (mercY(a[1]) + mercY(b[1])) / 2;
  const centerLat = (Math.atan(Math.exp(avgMercY)) * 360) / Math.PI - 90;

  // Scale to fit both points with padding (PAD = fraction of full canvas used)
  const PAD      = 0.85;
  const dLng     = Math.abs(a[0] - b[0]) * (Math.PI / 180);
  const dMercY   = Math.abs(mercY(a[1]) - mercY(b[1]));

  const scaleFromLng = dLng  > 0 ? CANVAS_W * PAD / dLng  : Infinity;
  const scaleFromLat = dMercY > 0 ? CANVAS_H * PAD / dMercY : Infinity;
  const scale = Math.min(scaleFromLng, scaleFromLat);
  const zoom  = Math.log2(scale / SCALE_BASE);

  return { center: [centerLng, centerLat], zoom };
}

/** Calculate center and zoom to fit an array of coordinates (e.g. a GPX track). */
export function calcZoomAndCenterFromPoints(
  points: [number, number][]
): { center: [number, number]; zoom: number } {
  const minLng = Math.min(...points.map((p) => p[0]));
  const maxLng = Math.max(...points.map((p) => p[0]));
  const minLat = Math.min(...points.map((p) => p[1]));
  const maxLat = Math.max(...points.map((p) => p[1]));
  return calcZoomAndCenter([minLng, minLat], [maxLng, maxLat]);
}

/** Build a d3-geo Mercator projection matching a Mapbox @2x static tile. */
export function buildProjection(center: [number, number], zoom: number) {
  return geoMercator()
    .center(center)
    .scale(SCALE_BASE * Math.pow(2, zoom))
    .translate([CANVAS_W / 2, CANVAS_H / 2]);
}

/** Build the Mapbox Static Images API URL. */
export function buildMapUrl(center: [number, number], zoom: number, style: string = MAPBOX_STYLE): string {
  const z = zoom.toFixed(2);
  return (
    `https://api.mapbox.com/styles/v1/${style}/static/` +
    `${center[0]},${center[1]},${z}/540x960@2x?access_token=${MAPBOX_TOKEN}`
  );
}

/** Build the Mapbox Directions API URL (driving only — Mapbox rejects long cycling/walking routes). */
export function buildDirectionsUrl(
  start: [number, number],
  end: [number, number],
): string {
  return (
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${start[0]},${start[1]};${end[0]},${end[1]}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
  );
}

/** Build an OSRM URL for cycling or walking.
 *  Uses routing.openstreetmap.de which runs separate OSRM backends per profile
 *  (routed-bike / routed-foot) — the same servers that power openstreetmap.org routing.
 *  router.project-osrm.org only has a car profile and ignores cycling/foot requests.
 *  The path segment is always "driving" because each server has one compiled profile. */
export function buildOsrmUrl(
  start: [number, number],
  end: [number, number],
  profile: 'cycling' | 'foot',
): string {
  const backend = profile === 'cycling' ? 'routed-bike' : 'routed-foot';
  return (
    `https://routing.openstreetmap.de/${backend}/route/v1/driving/` +
    `${start[0]},${start[1]};${end[0]},${end[1]}` +
    `?overview=full&geometries=geojson`
  );
}

// ── Major cities (dot + label) ────────────────────────────────────────────
// `pop` = city-proper population (approximate, recent estimates).
// Filter in MapComposition using the `minPopulation` prop.
export interface City { name: string; lnglat: [number, number]; pop: number }

export const MAJOR_CITIES: City[] = [
  // ── France ───────────────────────────────────────────────────────────────
  { name: "Paris",            lnglat: [ 2.3522,  48.8566], pop: 2_161_000 },
  { name: "Marseille",        lnglat: [ 5.3698,  43.2965], pop:   870_000 },
  { name: "Lyon",             lnglat: [ 4.8357,  45.7640], pop:   522_000 },
  { name: "Toulouse",         lnglat: [ 1.4442,  43.6047], pop:   493_000 },
  { name: "Nice",             lnglat: [ 7.2620,  43.7102], pop:   342_000 },
  { name: "Nantes",           lnglat: [-1.5534,  47.2184], pop:   320_000 },
  { name: "Montpellier",      lnglat: [ 3.8767,  43.6108], pop:   295_000 },
  { name: "Strasbourg",       lnglat: [ 7.7521,  48.5734], pop:   290_000 },
  { name: "Bordeaux",         lnglat: [-0.5792,  44.8378], pop:   261_000 },
  { name: "Lille",            lnglat: [ 3.0573,  50.6292], pop:   234_000 },
  { name: "Rennes",           lnglat: [-1.6778,  48.1173], pop:   221_000 },
  { name: "Reims",            lnglat: [ 4.0317,  49.2583], pop:   183_000 },
  { name: "Toulon",           lnglat: [ 5.9280,  43.1242], pop:   176_000 },
  { name: "Le Havre",         lnglat: [ 0.1077,  49.4938], pop:   172_000 },
  { name: "Saint-Étienne",    lnglat: [ 4.3872,  45.4397], pop:   172_000 },
  { name: "Grenoble",         lnglat: [ 5.7245,  45.1885], pop:   160_000 },
  { name: "Angers",           lnglat: [-0.5541,  47.4784], pop:   156_000 },
  { name: "Dijon",            lnglat: [ 5.0415,  47.3220], pop:   155_000 },
  { name: "Nîmes",            lnglat: [ 4.3601,  43.8367], pop:   151_000 },
  { name: "Aix-en-Provence",  lnglat: [ 5.4474,  43.5297], pop:   143_000 },
  { name: "Clermont-Ferrand", lnglat: [ 3.0863,  45.7772], pop:   143_000 },
  { name: "Brest",            lnglat: [-4.4862,  48.3905], pop:   140_000 },
  { name: "Tours",            lnglat: [ 0.6848,  47.3941], pop:   136_000 },
  { name: "Amiens",           lnglat: [ 2.2957,  49.8942], pop:   135_000 },
  { name: "Limoges",          lnglat: [ 1.2595,  45.8336], pop:   131_000 },
  { name: "Besançon",         lnglat: [ 6.0243,  47.2378], pop:   117_000 },
  { name: "Metz",             lnglat: [ 6.1757,  49.1193], pop:   115_000 },
  { name: "Perpignan",        lnglat: [ 2.8959,  42.6976], pop:   121_000 },
  { name: "Orléans",          lnglat: [ 1.9097,  47.9029], pop:   116_000 },
  { name: "Rouen",            lnglat: [ 1.0993,  49.4432], pop:   111_000 },
  { name: "Mulhouse",         lnglat: [ 7.3388,  47.7508], pop:   111_000 },
  { name: "Caen",             lnglat: [-0.3707,  49.1829], pop:   107_000 },
  { name: "Nancy",            lnglat: [ 6.1844,  48.6921], pop:   104_000 },
  { name: "Avignon",          lnglat: [ 4.8055,  43.9493], pop:    93_000 },
  { name: "Valence",          lnglat: [ 4.8924,  44.9334], pop:    63_000 },
  { name: "Troyes",           lnglat: [ 4.0833,  48.2997], pop:    60_000 },
  { name: "Orange",           lnglat: [ 4.8090,  44.1378], pop:    29_000 },

  // ── Belgium ──────────────────────────────────────────────────────────────
  { name: "Brussels",   lnglat: [ 4.3517,  50.8503], pop: 1_218_000 },
  { name: "Antwerp",    lnglat: [ 4.4025,  51.2194], pop:   530_000 },
  { name: "Ghent",      lnglat: [ 3.7174,  51.0543], pop:   265_000 },
  { name: "Charleroi",  lnglat: [ 4.4442,  50.4113], pop:   202_000 },
  { name: "Liège",      lnglat: [ 5.5716,  50.6326], pop:   197_000 },
  { name: "Bruges",     lnglat: [ 3.2247,  51.2093], pop:   118_000 },
  { name: "Namur",      lnglat: [ 4.8672,  50.4669], pop:   113_000 },

  // ── Netherlands ──────────────────────────────────────────────────────────
  { name: "Amsterdam",  lnglat: [ 4.9041,  52.3676], pop:   921_000 },
  { name: "Rotterdam",  lnglat: [ 4.4777,  51.9244], pop:   651_000 },
  { name: "The Hague",  lnglat: [ 4.3007,  52.0705], pop:   550_000 },
  { name: "Utrecht",    lnglat: [ 5.1214,  52.0907], pop:   361_000 },
  { name: "Eindhoven",  lnglat: [ 5.4697,  51.4416], pop:   238_000 },

  // ── Germany ──────────────────────────────────────────────────────────────
  { name: "Berlin",      lnglat: [13.4050,  52.5200], pop: 3_645_000 },
  { name: "Hamburg",     lnglat: [ 9.9937,  53.5753], pop: 1_852_000 },
  { name: "Munich",      lnglat: [11.5820,  48.1351], pop: 1_488_000 },
  { name: "Cologne",     lnglat: [ 6.9603,  50.9333], pop: 1_084_000 },
  { name: "Frankfurt",   lnglat: [ 8.6821,  50.1109], pop:   764_000 },
  { name: "Stuttgart",   lnglat: [ 9.1829,  48.7758], pop:   635_000 },
  { name: "Düsseldorf",  lnglat: [ 6.7735,  51.2217], pop:   620_000 },
  { name: "Leipzig",     lnglat: [12.3731,  51.3397], pop:   605_000 },
  { name: "Dortmund",    lnglat: [ 7.4653,  51.5136], pop:   587_000 },
  { name: "Essen",       lnglat: [ 7.0116,  51.4556], pop:   583_000 },
  { name: "Bremen",      lnglat: [ 8.8017,  53.0793], pop:   563_000 },
  { name: "Dresden",     lnglat: [13.7384,  51.0504], pop:   556_000 },
  { name: "Hanover",     lnglat: [ 9.7320,  52.3759], pop:   532_000 },
  { name: "Nuremberg",   lnglat: [11.0775,  49.4521], pop:   515_000 },
  { name: "Bonn",        lnglat: [ 7.0982,  50.7374], pop:   329_000 },
  { name: "Münster",     lnglat: [ 7.6261,  51.9607], pop:   316_000 },
  { name: "Mannheim",    lnglat: [ 8.4669,  49.4875], pop:   309_000 },
  { name: "Karlsruhe",   lnglat: [ 8.4037,  49.0069], pop:   308_000 },
  { name: "Augsburg",    lnglat: [10.8978,  48.3705], pop:   296_000 },
  { name: "Aachen",      lnglat: [ 6.0839,  50.7753], pop:   249_000 },
  { name: "Freiburg",    lnglat: [ 7.8421,  47.9990], pop:   231_000 },
  { name: "Mainz",       lnglat: [ 8.2791,  49.9929], pop:   218_000 },
  { name: "Erfurt",      lnglat: [11.0299,  50.9848], pop:   214_000 },
  { name: "Rostock",     lnglat: [12.1400,  54.0887], pop:   208_000 },
  { name: "Kassel",      lnglat: [ 9.4797,  51.3127], pop:   202_000 },

  // ── United Kingdom ───────────────────────────────────────────────────────
  { name: "London",     lnglat: [-0.1276,  51.5074], pop: 8_982_000 },
  { name: "Birmingham", lnglat: [-1.8904,  52.4862], pop: 1_145_000 },
  { name: "Leeds",      lnglat: [-1.5491,  53.8008], pop:   793_000 },
  { name: "Glasgow",    lnglat: [-4.2518,  55.8642], pop:   635_000 },
  { name: "Manchester", lnglat: [-2.2426,  53.4808], pop:   555_000 },
  { name: "Edinburgh",  lnglat: [-3.1883,  55.9533], pop:   536_000 },
  { name: "Liverpool",  lnglat: [-2.9916,  53.4084], pop:   498_000 },
  { name: "Bristol",    lnglat: [-2.5879,  51.4545], pop:   470_000 },

  // ── Switzerland ──────────────────────────────────────────────────────────
  { name: "Zurich",    lnglat: [8.5417,  47.3769], pop: 434_000 },
  { name: "Geneva",    lnglat: [6.1432,  46.2044], pop: 203_000 },
  { name: "Basel",     lnglat: [7.5886,  47.5596], pop: 178_000 },
  { name: "Lausanne",  lnglat: [6.6323,  46.5197], pop: 140_000 },
  { name: "Bern",      lnglat: [7.4474,  46.9481], pop: 134_000 },

  // ── Austria ──────────────────────────────────────────────────────────────
  { name: "Vienna",    lnglat: [16.3738,  48.2082], pop: 1_931_000 },
  { name: "Graz",      lnglat: [15.4395,  47.0707], pop:   291_000 },
  { name: "Linz",      lnglat: [14.2858,  48.3069], pop:   205_000 },
  { name: "Salzburg",  lnglat: [13.0550,  47.8095], pop:   155_000 },
  { name: "Innsbruck", lnglat: [11.3948,  47.2692], pop:   132_000 },

  // ── Spain ────────────────────────────────────────────────────────────────
  { name: "Madrid",    lnglat: [-3.7038,  40.4168], pop: 3_305_000 },
  { name: "Barcelona", lnglat: [ 2.1734,  41.3851], pop: 1_620_000 },
  { name: "Valencia",  lnglat: [-0.3763,  39.4699], pop:   800_000 },
  { name: "Seville",   lnglat: [-5.9845,  37.3891], pop:   685_000 },
  { name: "Zaragoza",  lnglat: [-0.8773,  41.6560], pop:   675_000 },
  { name: "Málaga",    lnglat: [-4.4214,  36.7213], pop:   578_000 },
  { name: "Bilbao",    lnglat: [-2.9253,  43.2630], pop:   346_000 },

  // ── Italy ────────────────────────────────────────────────────────────────
  { name: "Rome",     lnglat: [12.4964,  41.9028], pop: 2_873_000 },
  { name: "Milan",    lnglat: [ 9.1900,  45.4654], pop: 1_352_000 },
  { name: "Naples",   lnglat: [14.2681,  40.8518], pop:   959_000 },
  { name: "Turin",    lnglat: [ 7.6869,  45.0703], pop:   870_000 },
  { name: "Palermo",  lnglat: [13.3614,  38.1157], pop:   674_000 },
  { name: "Genoa",    lnglat: [ 8.9463,  44.4056], pop:   583_000 },
  { name: "Bologna",  lnglat: [11.3426,  44.4949], pop:   391_000 },
  { name: "Florence", lnglat: [11.2558,  43.7696], pop:   367_000 },
  { name: "Venice",   lnglat: [12.3155,  45.4408], pop:   261_000 },
  { name: "Verona",   lnglat: [10.9916,  45.4384], pop:   258_000 },

  // ── Portugal ─────────────────────────────────────────────────────────────
  { name: "Lisbon", lnglat: [-9.1393,  38.7223], pop: 548_000 },
  { name: "Porto",  lnglat: [-8.6291,  41.1579], pop: 238_000 },

  // ── Scandinavia ──────────────────────────────────────────────────────────
  { name: "Stockholm",  lnglat: [18.0686,  59.3293], pop:   975_000 },
  { name: "Copenhagen", lnglat: [12.5683,  55.6761], pop:   794_000 },
  { name: "Oslo",       lnglat: [10.7522,  59.9139], pop:   693_000 },
  { name: "Helsinki",   lnglat: [24.9384,  60.1699], pop:   658_000 },
  { name: "Gothenburg", lnglat: [11.9746,  57.7089], pop:   583_000 },
  { name: "Malmö",      lnglat: [13.0358,  55.6050], pop:   347_000 },

  // ── Central & Eastern Europe ─────────────────────────────────────────────
  { name: "Warsaw",   lnglat: [21.0122,  52.2297], pop: 1_861_000 },
  { name: "Budapest", lnglat: [19.0402,  47.4979], pop: 1_756_000 },
  { name: "Prague",   lnglat: [14.4378,  50.0755], pop: 1_357_000 },
  { name: "Kraków",   lnglat: [19.9450,  50.0647], pop:   780_000 },
  { name: "Athens",   lnglat: [23.7275,  37.9838], pop:   664_000 },

  // ── Luxembourg ───────────────────────────────────────────────────────────
  { name: "Luxembourg", lnglat: [6.1319,  49.6116], pop: 125_000 },
];
