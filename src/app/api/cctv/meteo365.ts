import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * Public weather / beach / port / city webcams published by meteo365.es.
 * HLS live video is referer-locked to their site, so we keep a snapshot here
 * and link out for the live stream — same pattern as Skyline stills.
 */
const INDEX_URL = 'https://meteo365.es/livecams/';
const PAGE_ORIGIN = 'https://meteo365.es';
const CACHE_TTL_MS = 15 * 60 * 1000;

interface LivecamPoint {
  slug: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  href: string;
  thumb?: string;
}

let cache: { cameras: CctvCamera[]; timestamp: number } | null = null;

function extractJsonArray(html: string, key: string): unknown[] | null {
  const needle = `${key}: [`;
  const idx = html.indexOf(needle);
  if (idx < 0) return null;
  const start = html.indexOf('[', idx);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(html.slice(start, i + 1));
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseLivecamsPoints(html: string): LivecamPoint[] {
  const raw = extractJsonArray(html, 'points');
  if (!raw) return [];

  const out: LivecamPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    const slug = typeof p.slug === 'string' ? p.slug : '';
    const name = typeof p.name === 'string' ? p.name : '';
    const href = typeof p.href === 'string' ? p.href : '';
    if (!slug || !name || !href || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat === 0 && lon === 0) continue;
    const thumb = typeof p.thumb === 'string' ? p.thumb : '';
    out.push({
      slug,
      name,
      location: typeof p.location === 'string' && p.location ? p.location : 'Spain',
      lat,
      lon,
      href,
      ...(thumb ? { thumb } : {}),
    });
  }
  return out;
}

export function parseLivecamPage(html: string): {
  streamUrl?: string;
  streamType?: string;
  poster?: string;
} {
  const streamUrl = html.match(/data-stream-url="([^"]+)"/)?.[1];
  const streamType = html.match(/data-stream-type="([^"]+)"/)?.[1];
  const posters = [...html.matchAll(/https:\/\/webcam(?:2)?\.meteo365\.es\/livecams\/[^"\s]+/g)]
    .map(m => m[0]);
  const poster = posters.find(url => url.includes('://webcam.meteo365.es/')) ?? posters[0];
  return { streamUrl, streamType, poster };
}

function proxied(url: string): string {
  return `/api/cctv/proxy?url=${encodeURIComponent(url)}`;
}

function isSnapshotType(streamType?: string): boolean {
  return streamType === 'jpeg' || streamType === 'jpeg-refresh' || streamType === 'jpg';
}

function cityName(location: string): string {
  return location === 'Malaga' ? 'Málaga' : location;
}

function posterFromStream(streamUrl?: string): string | undefined {
  if (!streamUrl) return undefined;
  const match = streamUrl.match(/https:\/\/(webcam(?:2)?\.meteo365\.es)\/hls_live\/([^/.]+)\.m3u8/i);
  if (!match) return undefined;
  return `https://${match[1]}/livecams/${match[2]}/current.webp`;
}

/** Full-size still — never the catalog thumb, which is ~160px. */
export function preferredLivecamSnapshot(
  point: { slug: string },
  page: ReturnType<typeof parseLivecamPage>,
): string | undefined {
  if (isSnapshotType(page.streamType) && page.streamUrl) return page.streamUrl;
  if (page.poster) return page.poster;
  const fromStream = posterFromStream(page.streamUrl);
  if (fromStream) return fromStream;
  if (point.slug) return `https://webcam.meteo365.es/livecams/${point.slug}/current.webp`;
  return undefined;
}

function toCamera(point: LivecamPoint, page: ReturnType<typeof parseLivecamPage>): CctvCamera {
  const snapshot = preferredLivecamSnapshot(point, page);
  return {
    id: `meteo365-${point.slug}`,
    lat: point.lat,
    lng: point.lon,
    name: point.name,
    city: cityName(point.location),
    country: 'Spain',
    ...(snapshot ? { feed_url: proxied(snapshot) } : {}),
    external_url: `${PAGE_ORIGIN}${point.href}`,
    source: 'meteo365.es',
  };
}

async function loadMeteo365Cameras(): Promise<CctvCamera[]> {
  const indexRes = await stealthFetch(INDEX_URL, {
    signal: AbortSignal.timeout(15000),
  });
  if (!indexRes.ok) return cache?.cameras || [];

  const points = parseLivecamsPoints(await indexRes.text());
  const cameras: CctvCamera[] = [];
  const BATCH = 6;
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const mapped = await Promise.all(
      batch.map(async (point) => {
        try {
          const res = await stealthFetch(`${PAGE_ORIGIN}${point.href}`, {
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok) return toCamera(point, {});
          return toCamera(point, parseLivecamPage(await res.text()));
        } catch {
          return toCamera(point, {});
        }
      }),
    );
    cameras.push(...mapped);
  }

  return cameras;
}

export async function fetchMeteo365Cameras(): Promise<CctvCamera[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.cameras;
  }

  try {
    const cameras = await loadMeteo365Cameras();
    if (cameras.length > 0) {
      cache = { cameras, timestamp: Date.now() };
    }
    return cameras.length > 0 ? cameras : cache?.cameras || [];
  } catch (error) {
    console.error('Failed to fetch meteo365 cameras:', error);
    return cache?.cameras || [];
  }
}
