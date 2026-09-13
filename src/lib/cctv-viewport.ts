/**
 * OSIRIS — CCTV viewport planning.
 *
 * The catalogue is ~17k cameras / ~8 MB if you ask for every region at once.
 * The map only needs the cameras around the current view, and at globe zoom
 * it does not need any of them: a worldwide scatter of dots is unreadable and
 * the request is what made first paint wait three seconds.
 *
 * Region membership is the same set of boxes the CCTV route has always used;
 * this module just makes them testable and lets a bbox/radius expand a point
 * into neighbouring regions instead of ignoring radius.
 */

import { haversine } from './geo';

export const CCTV_MIN_FETCH_ZOOM = 5;
/** Safety cap on a viewport response so a wide bbox cannot dump the catalogue. */
export const CCTV_VIEWPORT_CAP = 4000;
/** Preview tiles stay off until street-level zoom — see CctvPreviews. */
export const CCTV_PREVIEW_MIN_ZOOM = 13;
export const CCTV_PREVIEW_MAX_TILES = 8;
export const CCTV_PREVIEW_MAX_VIDEO_TILES = 4;

export interface GeoBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface CctvViewport {
  lat: number;
  lng: number;
  zoom: number;
  radiusKm: number;
}

export interface CctvCam {
  id?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export type CctvQuery = {
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
  bbox?: GeoBox | null;
  /** True when the caller actually sent lat/lng, including 0,0. */
  hasCoords?: boolean;
  countOnly?: boolean;
};

export type CctvPlan =
  | { mode: 'empty'; regions: string[]; clip: null; cap: null }
  | { mode: 'count'; regions: 'all' | string[]; clip: null; cap: null }
  | { mode: 'fetch'; regions: 'all' | string[]; clip: GeoBox | null; cap: number | null };

/** Visible half-width-ish, shrinking as the operator zooms in. */
export function radiusKmForZoom(zoom: number): number {
  if (zoom >= 14) return 12;
  if (zoom >= 12) return 25;
  if (zoom >= 10) return 40;
  if (zoom >= 8) return 80;
  if (zoom >= 7) return 150;
  if (zoom >= 6) return 280;
  return 450;
}

export function shouldFetchCctv(zoom: number): boolean {
  return zoom >= CCTV_MIN_FETCH_ZOOM;
}

export function viewportChangedEnough(prev: CctvViewport | null, next: CctvViewport): boolean {
  if (!prev) return true;
  if (Math.abs(next.zoom - prev.zoom) >= 0.75) return true;
  const movedKm = haversine([prev.lng, prev.lat], [next.lng, next.lat]);
  return movedKm > next.radiusKm * 0.35;
}

export function boxFromCenter(lat: number, lng: number, radiusKm: number): GeoBox {
  const dLat = radiusKm / 111;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusKm / (111 * Math.max(0.2, Math.abs(cos)));
  return {
    south: clampLat(lat - dLat),
    north: clampLat(lat + dLat),
    west: wrapLng(lng - dLng),
    east: wrapLng(lng + dLng),
  };
}

export function parseBbox(raw: string | null | undefined): GeoBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map(s => Number(s.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (south > north) return null;
  return { west, south, east, north };
}

export function formatBbox(box: GeoBox): string {
  return `${box.west},${box.south},${box.east},${box.north}`;
}

export function inBbox(lat: number, lng: number, box: GeoBox): boolean {
  if (lat < box.south || lat > box.north) return false;
  if (box.west <= box.east) return lng >= box.west && lng <= box.east;
  return lng >= box.west || lng <= box.east;
}

export function intersectBoxes(a: GeoBox, b: GeoBox): GeoBox | null {
  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);
  if (south > north) return null;
  const aWraps = a.west > a.east;
  const bWraps = b.west > b.east;
  if (aWraps || bWraps) return a;
  const west = Math.max(a.west, b.west);
  const east = Math.min(a.east, b.east);
  if (west > east) return null;
  return { south, north, west, east };
}

export function filterCamerasToBbox<T extends CctvCam>(cameras: T[], box: GeoBox | null): T[] {
  if (!box) return cameras;
  return cameras.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number' && inBbox(c.lat, c.lng, box));
}

/** Drop cameras that have panned well outside the current fetch radius. */
export function mergeCamerasForViewport<T extends CctvCam>(
  existing: T[],
  incoming: T[],
  view: Pick<CctvViewport, 'lat' | 'lng' | 'radiusKm'>,
): T[] {
  const keepKm = Math.max(view.radiusKm * 2, view.radiusKm + 15);
  const byId = new Map<string, T>();
  for (const cam of existing) {
    if (!cam?.id) continue;
    if (typeof cam.lat !== 'number' || typeof cam.lng !== 'number') continue;
    if (haversine([view.lng, view.lat], [cam.lng, cam.lat]) <= keepKm) {
      byId.set(String(cam.id), cam);
    }
  }
  for (const cam of incoming) {
    if (cam?.id) byId.set(String(cam.id), cam);
  }
  return [...byId.values()];
}

export function slimCamera(cam: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: cam.id,
    lat: cam.lat,
    lng: cam.lng,
    name: cam.name,
    source: cam.source,
  };
  for (const key of ['city', 'country', 'feed_url', 'stream_url', 'stream_type', 'external_url'] as const) {
    const value = cam[key];
    if (value != null && value !== '') out[key] = value;
  }
  return out;
}

export function planCctvQuery(q: CctvQuery): CctvPlan {
  const region = q.region?.trim() || null;

  if (q.countOnly && !region && !q.hasCoords && !q.bbox) {
    return { mode: 'count', regions: 'all', clip: null, cap: null };
  }

  if (region === 'all') {
    return q.countOnly
      ? { mode: 'count', regions: 'all', clip: null, cap: null }
      : { mode: 'fetch', regions: 'all', clip: null, cap: null };
  }

  if (region) {
    const regions = region.split(',').map(s => s.trim()).filter(Boolean);
    return {
      mode: q.countOnly ? 'count' : 'fetch',
      regions,
      clip: q.bbox ?? null,
      cap: q.countOnly ? null : CCTV_VIEWPORT_CAP,
    };
  }

  if (q.hasCoords && q.lat != null && q.lng != null) {
    const radius = q.radiusKm != null && q.radiusKm > 0 ? q.radiusKm : 10;
    let clip = boxFromCenter(q.lat, q.lng, radius);
    if (q.bbox) {
      const hit = intersectBoxes(clip, q.bbox);
      if (hit) clip = hit;
    }
    return {
      mode: q.countOnly ? 'count' : 'fetch',
      regions: getRegionsForBbox(clip),
      clip,
      cap: q.countOnly ? null : CCTV_VIEWPORT_CAP,
    };
  }

  if (q.bbox) {
    return {
      mode: q.countOnly ? 'count' : 'fetch',
      regions: getRegionsForBbox(q.bbox),
      clip: q.bbox,
      cap: q.countOnly ? null : CCTV_VIEWPORT_CAP,
    };
  }

  return { mode: 'empty', regions: [], clip: null, cap: null };
}

/**
 * Regions whose boxes contain this point. Radius is ignored here — expand to a
 * bbox and call getRegionsForBbox when the search area is larger than a pin.
 */
export function getRegionsForPoint(lat: number, lng: number): string[] {
  const regions: string[] = [];
  if (lat > 49 && lat < 61 && lng > -8 && lng < 2) regions.push('uk');
  if (lat > 24 && lat < 49 && lng > -85 && lng < -66) regions.push('us-east');
  if (lat > 24 && lat < 49 && lng > -125 && lng < -100) regions.push('us-west');
  if (lat > 36.9 && lat < 42.1 && lng > -114.2 && lng < -108.9) regions.push('utah');
  if (lat > 41.9 && lat < 46.3 && lng > -124.6 && lng < -116.4) regions.push('oregon');
  if (lat > 34.9 && lat < 42.1 && lng > -120.1 && lng < -113.9) regions.push('nevada');
  if (lat > 24 && lat < 49 && lng > -105 && lng < -80) regions.push('us-central');
  if (lat > 41.6 && lat < 48.3 && lng > -90.5 && lng < -82.1) regions.push('michigan');
  if (lat > 37.7 && lat < 41.9 && lng > -88.2 && lng < -84.6) regions.push('indiana');
  if (lat > 28.8 && lat < 33.1 && lng > -94.2 && lng < -88.6) regions.push('louisiana');
  if (lat > 24.4 && lat < 31.1 && lng > -87.7 && lng < -79.9) regions.push('florida');
  if (lat > 30.3 && lat < 35.1 && lng > -85.7 && lng < -80.8) regions.push('georgia');
  if (lat > 33.8 && lat < 36.6 && lng > -84.4 && lng < -75.4) regions.push('northcarolina');
  if (lat > 31.3 && lat < 37.1 && lng > -115.0 && lng < -109.0) regions.push('arizona');
  if (lat > 42 && lat < 70 && lng > -141 && lng < -52) regions.push('canada');

  const inBulgaria = lat > 41 && lat < 44.5 && lng > 22 && lng < 29.5;
  const inGreece = lat > 34.5 && lat < 41.8 && lng > 19 && lng < 30;
  const inSerbia = lat > 42 && lat < 46.5 && lng > 18.8 && lng < 23.3;
  const inMacedonia = lat > 40.8 && lat < 42.8 && lng > 20.4 && lng < 23.2;
  const inRomania = lat > 43.5 && lat < 48.5 && lng > 20 && lng < 29.8;
  const inTurkey = lat > 35.5 && lat < 42.5 && lng > 25.5 && lng < 45;
  const inItaly = lat > 36 && lat < 47.5 && lng > 6.5 && lng < 18.5;
  const inCzechia = lat > 48.5 && lat < 51.1 && lng > 12 && lng < 18.9;
  const inSlovakia = lat > 47.7 && lat < 49.6 && lng > 16.8 && lng < 22.6;
  const inGermany = lat > 47 && lat < 55.1 && lng > 5.8 && lng < 15.1;
  const inFrance = lat > 42.3 && lat < 51.1 && lng > -5 && lng < 8.3;
  const inSpain = lat > 27 && lat < 43.8 && lng > -18.2 && lng < 4.4;
  const inNetherlands = lat > 50.6 && lat < 53.6 && lng > 3.2 && lng < 7.3;
  const inPoland = lat > 49.0 && lat < 55.0 && lng > 14.1 && lng < 24.1;
  const inFinland = lat > 59.5 && lat < 70.1 && lng > 20 && lng < 31.6;
  const inIceland = lat > 63.0 && lat < 67.0 && lng > -25.0 && lng < -13.0;
  const inBalkans = inBulgaria || inGreece || inSerbia || inMacedonia || inRomania || inTurkey;
  const inWesternEurope = inItaly || inCzechia || inSlovakia || inGermany || inFrance || inSpain || inNetherlands || inPoland || inFinland || inIceland;

  if (lat > 35 && lat < 72 && lng > -11 && lng < 40 && !inBalkans && !inWesternEurope) {
    regions.push('europe');
  }
  if (inBulgaria) regions.push('bulgaria');
  if (inGreece) regions.push('greece');
  if (inSerbia) regions.push('serbia');
  if (inMacedonia) regions.push('macedonia');
  if (inRomania) regions.push('romania');
  if (inTurkey) regions.push('turkey');
  if (inItaly) regions.push('italy');
  if (inCzechia) regions.push('czechia');
  if (inSlovakia) regions.push('slovakia');
  if (inGermany) regions.push('germany');
  if (inFrance) regions.push('france');
  if (inSpain) regions.push('spain');
  if (inNetherlands) regions.push('netherlands');
  if (inPoland) regions.push('poland');
  if (inFinland) regions.push('finland');
  if (inIceland) regions.push('iceland');

  const inMiddleEast = lat > 29 && lat < 34.5 && lng > 34 && lng < 36.5;
  if (inMiddleEast) regions.push('middle-east');

  if (lat > 24 && lat < 46 && lng > 122 && lng < 154) regions.push('japan');
  if (lat > 22.1 && lat < 22.6 && lng > 113.8 && lng < 114.4) regions.push('hongkong');
  if (lat > 21.9 && lat < 25.3 && lng > 119.5 && lng < 122.1) regions.push('taiwan');
  if (lat > 5.5 && lat < 20.5 && lng > 97.3 && lng < 105.7) regions.push('thailand');
  if (lat > -11 && lat < 46 && lng > 25 && lng < 155) regions.push('asia-live');
  if (lat > -10 && lat < 60 && lng > 60 && lng < 150) regions.push('asia');
  if (lat > 18 && lat < 46 && lng > 73.5 && lng < 146) regions.push('eastasia');
  if (lat > -11 && lat < 24 && lng > 92 && lng < 130) regions.push('seasia');
  if (lat > 5 && lat < 56 && lng > 25 && lng < 92) regions.push('westasia');
  if (lat > -45 && lat < -10 && lng > 110 && lng < 155) regions.push('asia');
  if (lat > -47.5 && lat < -34 && lng > 166 && lng < 179) regions.push('newzealand');
  if (lat > -56 && lat < 33 && lng > -119 && lng < -34) regions.push('latam-live');
  if (lat > -35 && lat < 36 && lng > -26 && lng < 57) regions.push('africa-live');
  if (lat > 35 && lat < 72 && lng > -32 && lng < 32) regions.push('europe-live');

  return [...new Set(regions)];
}

/** @deprecated Use getRegionsForPoint / getRegionsForBbox. Kept as the old route signature. */
export function getRegionsForBounds(lat: number, lng: number, radiusKm = 0): string[] {
  if (!radiusKm || radiusKm <= 0) return getRegionsForPoint(lat, lng);
  return getRegionsForBbox(boxFromCenter(lat, lng, radiusKm));
}

export function getRegionsForBbox(box: GeoBox): string[] {
  const found = new Set<string>();
  for (const [lat, lng] of samplePoints(box)) {
    for (const region of getRegionsForPoint(lat, lng)) found.add(region);
  }
  return [...found];
}

function samplePoints(box: GeoBox): Array<[number, number]> {
  const midLat = (box.south + box.north) / 2;
  const midLng = box.west <= box.east
    ? (box.west + box.east) / 2
    : wrapLng((box.west + box.east + 360) / 2);
  return [
    [midLat, midLng],
    [box.south, box.west],
    [box.south, box.east],
    [box.north, box.west],
    [box.north, box.east],
    [midLat, box.west],
    [midLat, box.east],
    [box.south, midLng],
    [box.north, midLng],
  ];
}

function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

function wrapLng(lng: number): number {
  return ((lng + 540) % 360) - 180;
}
