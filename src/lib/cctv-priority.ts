/**
 * OSIRIS — CCTV refresh priority for Málaga / Costa del Sol hotspots.
 *
 * Ayto. Málaga traffic stills are one URL per camera; they only look live when
 * re-fetched often. Puerta Blanca, Avenida Molière and Alhaurín de la Torre
 * get the fastest cadence; the rest of Málaga city is next; everything else
 * keeps the global default.
 */

export const PUERTA_BLANCA = { lat: 36.688, lng: -4.458, radiusKm: 1.5 };

export const ALHAURIN_DE_LA_TORRE = { lat: 36.661, lng: -4.562, radiusKm: 7 };

export const MALAGA_BBOX = {
  south: 36.65,
  north: 36.78,
  west: -4.55,
  east: -4.30,
};

/** Málaga city through Estepona / Marbella — used for preview-tile ranking. */
export const COSTA_DEL_SOL_BBOX = {
  south: 36.35,
  north: 36.75,
  west: -5.25,
  east: -4.35,
};

export interface CctvLocation {
  lat?: number;
  lng?: number;
  city?: string;
  name?: string;
}

export interface GridCamera extends CctvLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  feed_url?: string;
  stream_url?: string;
  stream_type?: string;
  source?: string;
}

/** Higher rank → faster refresh and preferred for preview tiles. */
export function cctvPriorityRank(cam: CctvLocation): number {
  const name = cam.name ?? '';
  const city = (cam.city ?? '').toLowerCase();

  if (/molier|sacaba|misericordia|puerta blanca|mainake|eduardo toldr|alhaur[ií]n/i.test(name)) {
    return 3;
  }
  if (/alhaur[ií]n/.test(city)) return 3;

  if (cam.lat != null && cam.lng != null) {
    if (distanceKm(cam, PUERTA_BLANCA) <= PUERTA_BLANCA.radiusKm) return 3;
    if (distanceKm(cam, ALHAURIN_DE_LA_TORRE) <= ALHAURIN_DE_LA_TORRE.radiusKm) return 3;
    if (inMalagaBbox(cam.lat, cam.lng)) return 2;
  }
  if (city === 'málaga' || city === 'malaga') return 2;
  return 0;
}

export function inMalagaBbox(lat: number, lng: number): boolean {
  return lat >= MALAGA_BBOX.south && lat <= MALAGA_BBOX.north
    && lng >= MALAGA_BBOX.west && lng <= MALAGA_BBOX.east;
}

export function inCostaDelSolBbox(lat: number, lng: number): boolean {
  return lat >= COSTA_DEL_SOL_BBOX.south && lat <= COSTA_DEL_SOL_BBOX.north
    && lng >= COSTA_DEL_SOL_BBOX.west && lng <= COSTA_DEL_SOL_BBOX.east;
}

/** Default wall — EDUARDO TOLDRÁ + both Molière cams + Sacaba. */
export const PUERTA_BLANCA_PRESET: RegExp[] = [
  /^eduardo toldr/i,
  /^avda\.?\s*molier[eé]?$/i,
  /avda\s*molier[eé]?\s*-\s*pato/i,
  /sacaba/i,
];

export function pickPuertaBlancaGrid(all: GridCamera[], limit = 4): GridCamera[] {
  const playable = all.filter(c => c.feed_url?.trim() || c.stream_url?.trim());
  const picked: GridCamera[] = [];

  for (const re of PUERTA_BLANCA_PRESET) {
    const match = playable.find(c => re.test(c.name) && !picked.some(p => p.id === c.id));
    if (match) picked.push(match);
    if (picked.length >= limit) return picked.slice(0, limit);
  }

  return picked.slice(0, limit);
}

/** Jabalcuza first, then the closest labeled Alhaurín-corridor stills. */
export const ALHAURIN_PRESET: RegExp[] = [
  /jabalcuza|^alhaur[ií]n de la torre/i,
  /a-7 km 995/i,
  /a-357 km 61/i,
  /a-357 km 60/i,
];

export function pickAlhaurinGrid(all: GridCamera[], limit = 4): GridCamera[] {
  const playable = all.filter(c => c.feed_url?.trim() || c.stream_url?.trim());
  const picked: GridCamera[] = [];

  for (const re of ALHAURIN_PRESET) {
    const match = playable.find(c => re.test(c.name) && !picked.some(p => p.id === c.id));
    if (match) picked.push(match);
    if (picked.length >= limit) return picked.slice(0, limit);
  }

  const extras = playable
    .filter(c => !picked.some(p => p.id === c.id))
    .filter(c => (
      /alhaur[ií]n/i.test(c.name)
      || /alhaur[ií]n|cártama|campanillas/i.test(c.city ?? '')
      || distanceKm(c, ALHAURIN_DE_LA_TORRE) <= ALHAURIN_DE_LA_TORRE.radiusKm
    ))
    .sort((a, b) => distanceKm(a, ALHAURIN_DE_LA_TORRE) - distanceKm(b, ALHAURIN_DE_LA_TORRE));

  return [...picked, ...extras].slice(0, limit);
}

function distanceKm(a: { lat?: number; lng?: number }, b: { lat: number; lng: number }): number {
  if (a.lat == null || a.lng == null) return Infinity;
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 85;
  return Math.hypot(dLat, dLng);
}
