import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';
import { cachedSource } from '@/lib/sourceCache';

/**
 * OSIRIS — Netherlands public cameras
 *
 * Highway: 26 official Rijkswaterstaat motorway cameras (INMOVES), catalogued
 * with coordinates via the public RWS Verkeersinformatie listing.
 * Snapshots are proxied from the same published stills the RWS site shows.
 *
 * Tourism / city: SkylineWebcams operator-published feeds (external live pages).
 */

const RWS_CAMERA_INDEX = 'https://cameras.measureeverything.io/api/cameras';
const RWS_INFO_BASE = 'https://www.rwsverkeersinfo.nl/cameras';
const SNAPSHOT_BASE = 'https://cameras.measureeverything.io/api/snapshot';

const NL_BOUNDS = { minLat: 50.6, maxLat: 53.7, minLng: 3.0, maxLng: 7.4 };

export interface RwsCameraRecord {
  id: number;
  inmovesId: string;
  lat: number;
  lng: number;
  road: string;
  near: string;
  title: string;
  location_description?: string;
}

/** Slug used on rwsverkeersinfo.nl/cameras/{id}/{slug}. */
export function rwsPageSlug(road: string, near: string): string {
  const place = near
    .replace(/^knooppunt\s+/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${road.toLowerCase()}-${place}`;
}

function proxied(url: string): string {
  return `/api/cctv/proxy?url=${encodeURIComponent(url)}`;
}

export function mapRwsCamera(rec: RwsCameraRecord): CctvCamera | null {
  const lat = Number(rec.lat);
  const lng = Number(rec.lng);
  if (!rec.inmovesId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < NL_BOUNDS.minLat || lat > NL_BOUNDS.maxLat) return null;
  if (lng < NL_BOUNDS.minLng || lng > NL_BOUNDS.maxLng) return null;

  const slug = rwsPageSlug(rec.road, rec.near);
  const name = rec.title || `${rec.road} — ${rec.near}`;

  return {
    id: `rws-${rec.id}`,
    lat,
    lng,
    name,
    city: rec.near.replace(/^knooppunt\s+/i, ''),
    country: 'Netherlands',
    feed_url: proxied(`${SNAPSHOT_BASE}?id=${encodeURIComponent(rec.inmovesId)}`),
    external_url: `${RWS_INFO_BASE}/${rec.id}/${slug}`,
    source: 'Rijkswaterstaat',
  };
}

async function loadRwsCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(RWS_CAMERA_INDEX, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`RWS index HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const cameras: CctvCamera[] = [];
  for (const row of data as RwsCameraRecord[]) {
    const cam = mapRwsCamera(row);
    if (cam) cameras.push(cam);
  }
  console.log(`[OSIRIS] Netherlands cameras — Rijkswaterstaat: ${cameras.length}`);
  return cameras;
}

// SkylineWebcams — https://www.skylinewebcams.com/en/webcam/netherlands.html
const SKYLINE_NETHERLANDS: CctvCamera[] = [
  { id: 'sky-nl-dam-square', lat: 52.3732, lng: 4.8936, name: 'Amsterdam — Dam Square', city: 'Amsterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/amsterdam-dam-square.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-damrak', lat: 52.3759, lng: 4.8975, name: 'Amsterdam — Damrak', city: 'Amsterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/amsterdam-damrak-street.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-singel', lat: 52.3770, lng: 4.8880, name: 'Amsterdam — Singel Canal', city: 'Amsterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/amsterdam-singel-canal.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-amsterdam-center', lat: 52.3676, lng: 4.9041, name: 'Amsterdam — City Center', city: 'Amsterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/city-center.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-amsterdam-streets', lat: 52.3700, lng: 4.8950, name: 'Amsterdam — Streets', city: 'Amsterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/streets.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-centraal', lat: 52.3791, lng: 4.9003, name: 'Amsterdam — Centraal Station', city: 'Amsterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/amsterdam-centraal.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-erasmus', lat: 51.9103, lng: 4.4863, name: 'Rotterdam — Erasmus Bridge', city: 'Rotterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/south-holland/rotterdam/erasmus-bridge.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-rotterdam-port', lat: 51.9496, lng: 4.1410, name: 'Rotterdam — Port', city: 'Rotterdam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/south-holland/rotterdam/port-of-rotterdam.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-scheveningen', lat: 52.1069, lng: 4.2764, name: 'The Hague — Scheveningen Boulevard', city: 'The Hague', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/south-holland/the-hague/scheveningen-boulevard.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-scheveningen-marina', lat: 52.1020, lng: 4.2710, name: 'The Hague — Scheveningen Marina', city: 'The Hague', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/south-holland/the-hague/scheveningen-den-haag-marina.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-kijkduin', lat: 52.0673, lng: 4.2208, name: 'The Hague — Kijkduin Beach', city: 'The Hague', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/south-holland/the-hague/kijkduin-beach.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-utrecht', lat: 52.0907, lng: 5.1214, name: 'Utrecht — Skyline', city: 'Utrecht', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/utrecht/utrecht/skyline-utrecht.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-zandvoort', lat: 52.3713, lng: 4.5337, name: 'Zandvoort — Beach', city: 'Zandvoort', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/zandvoort/zandvoort-beach.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-zandvoort-boul', lat: 52.3705, lng: 4.5310, name: 'Zandvoort — Boulevard', city: 'Zandvoort', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/zandvoort/zandvoort-boulevard.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-renesse', lat: 51.7320, lng: 3.7730, name: 'Renesse — Beach', city: 'Renesse', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/zeeland/renesse/renesse-beach.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-renesse-center', lat: 51.7335, lng: 3.7760, name: 'Renesse — City Center', city: 'Renesse', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/zeeland/renesse/city-center-of-renesse.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-volendam', lat: 52.4950, lng: 5.0700, name: 'Volendam — Harbor', city: 'Volendam', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/volendam/volendam.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-hoek-van-holland', lat: 51.9770, lng: 4.1300, name: 'Hoek van Holland — Beach', city: 'Hoek van Holland', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/south-holland/hoek-van-holland/hoek-van-holland.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-vlissingen', lat: 51.4420, lng: 3.5730, name: 'Vlissingen — Boulevard', city: 'Vlissingen', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/zeeland/vlissingen/vlissingen.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-vrouwenpolder', lat: 51.7240, lng: 3.6710, name: 'Vrouwenpolder — Beach', city: 'Vrouwenpolder', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/zeeland/vrouwenpolder/vrouwenpolder.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-groede', lat: 51.3780, lng: 3.5050, name: 'Groede — Beach', city: 'Groede', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/zeeland/groede/groede-beach.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-ameland', lat: 53.4510, lng: 5.7590, name: 'Ameland — Ferry Terminal', city: 'Ameland', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/friesland/ameland/ameland.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-sneek', lat: 53.0330, lng: 5.6590, name: 'Sneek — De Kolk', city: 'Sneek', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/friesland/sneek/de-kolk.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-leeuwarden', lat: 53.2010, lng: 5.7950, name: 'Leeuwarden — Oldehove', city: 'Leeuwarden', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/friesland/leeuwarden/leeuwarden-oldehove.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-lauwersoog', lat: 53.4110, lng: 6.1990, name: 'Lauwersoog — Ferry Terminal', city: 'Lauwersoog', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/groningen/lauwersoog/lauwersoog-ferry-terminal.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-vlieland', lat: 53.2440, lng: 4.9990, name: 'Oost-Vlieland', city: 'Vlieland', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/friesland/vlieland/oost-vlieland.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-helmond', lat: 51.4810, lng: 5.6610, name: 'Helmond — Railway Crossing', city: 'Helmond', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-brabant/helmond/helmond.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-ijsselstein', lat: 52.0190, lng: 5.0430, name: 'IJsselstein — Stork Nest', city: 'IJsselstein', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/utrecht/ijsselstein/ijsselstein-stork-nest.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-breda-airport', lat: 51.5650, lng: 4.9310, name: 'Breda — International Airport', city: 'Breda', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/north-brabant/breda/breda-international-airport.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-groenlo', lat: 52.0410, lng: 6.6110, name: 'Groenlo — Marveld Amusement Park', city: 'Groenlo', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/gelderland/groenlo/groenlo-netherlands.html', source: 'SkylineWebcams' },
  { id: 'sky-nl-urk', lat: 52.6610, lng: 5.6010, name: 'Urk — Werkhaven Port', city: 'Urk', country: 'Netherlands', external_url: 'https://www.skylinewebcams.com/en/webcam/netherlands/flevoland/urk/werkhaven.html', source: 'SkylineWebcams' },
];

async function loadNetherlandsCameras(): Promise<CctvCamera[]> {
  let rws: CctvCamera[] = [];
  try {
    rws = await loadRwsCameras();
  } catch (error) {
    console.error('Failed to fetch Rijkswaterstaat cameras:', error);
  }
  return [...rws, ...SKYLINE_NETHERLANDS];
}

export const fetchNetherlandsCameras = cachedSource('netherlands', loadNetherlandsCameras);
