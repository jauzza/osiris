import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';
import { youtubeEmbedUrl } from '@/lib/youtube';

/**
 * Public beach / plaza / marina webcams catalogued by Andalucía Live.
 * These are operator-published tourism feeds (YouTube, ipcamlive, Skyline),
 * not municipal traffic cameras.
 */
const CATALOG_URL =
  'https://andalucialive.com/wp-json/wp/v2/posts?categories=363&per_page=100';
const EXTRA_IDS_URL =
  'https://andalucialive.com/wp-json/wp/v2/posts?include=12083';
const CACHE_TTL_MS = 15 * 60 * 1000;

interface WpPost {
  id: number;
  slug: string;
  link: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  cmb2?: { video_player_settings?: { vm_video_url?: string } };
}

interface Place {
  match: RegExp;
  lat: number;
  lng: number;
  city: string;
  name: string;
}

const PLACES: Place[] = [
  { match: /sacaba/i, lat: 36.6868, lng: -4.4465, city: 'Málaga', name: 'Playa de Sacaba' },
  { match: /sabinillas/i, lat: 36.3792, lng: -5.1964, city: 'Manilva', name: 'Playa de Sabinillas' },
  { match: /duquesa/i, lat: 36.3564, lng: -5.2335, city: 'Manilva', name: 'Puerto de la Duquesa' },
  { match: /benalaur/i, lat: 36.5933, lng: -5.2614, city: 'Benalauría', name: 'Benalauría' },
  { match: /casares|playa ancha/i, lat: 36.3768, lng: -5.2234, city: 'Casares', name: 'Casares - Playa Ancha' },
  { match: /campillos|laguna dulce/i, lat: 37.0550, lng: -4.8510, city: 'Campillos', name: 'Laguna Dulce' },
  { match: /marina de estepona/i, lat: 36.4152, lng: -5.1548, city: 'Estepona', name: 'Marina de Estepona' },
  { match: /para[ií]so golf/i, lat: 36.4690, lng: -5.0470, city: 'Estepona', name: 'El Paraíso Golf Club' },
  { match: /torre del mar|v[eé]lez/i, lat: 36.7432, lng: -4.0964, city: 'Torre del Mar', name: 'Playa de Torre del Mar' },
  { match: /montejaque.*pano|panor/i, lat: 36.7365, lng: -5.2480, city: 'Montejaque', name: 'Montejaque - Panorama' },
  { match: /montejaque/i, lat: 36.7358, lng: -5.2500, city: 'Montejaque', name: 'Montejaque - Ayuntamiento' },
  { match: /sunset beach|benalm/i, lat: 36.5804, lng: -4.5168, city: 'Benalmádena', name: 'Benalmádena - Sunset Beach Club' },
  { match: /torremolinos/i, lat: 36.6204, lng: -4.4996, city: 'Torremolinos', name: 'Torremolinos' },
  { match: /fuengirola/i, lat: 36.5400, lng: -4.6247, city: 'Fuengirola', name: 'Fuengirola' },
  { match: /alhaur[ií]n/i, lat: 36.6610, lng: -4.5620, city: 'Alhaurín de la Torre', name: 'Alhaurín de la Torre' },
  { match: /mijas/i, lat: 36.5270, lng: -4.6390, city: 'Mijas', name: 'Mijas Costa' },
  { match: /marbella/i, lat: 36.5100, lng: -4.8820, city: 'Marbella', name: 'Marbella' },
  { match: /estepona/i, lat: 36.4250, lng: -5.1490, city: 'Estepona', name: 'Estepona' },
];

export interface AndaluciaPlayer {
  youtubeId?: string;
  ipcamlive?: { host: string; alias: string };
  skylineUrl?: string;
  iframeUrl?: string;
  hlsUrl?: string;
}

const YT_EMBED = /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/;
const YT_WATCH = /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/;
const IPCAM = /https?:\/\/(g\d+\.ipcamlive\.com)\/player\/player\.php\?alias=([^"'&\s<]+)/i;
const SKYLINE = /https?:\/\/www\.skylinewebcams\.com\/[^"'?\s<]+/;
const HLS = /https?:\/\/[^"'\s<]+\.m3u8[^"'\s<]*/i;
const OTHER_IFRAME = /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i;

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAndaluciaPlayer(html: string): AndaluciaPlayer {
  const yt = html.match(YT_EMBED)?.[1] || html.match(YT_WATCH)?.[1];
  const ip = html.match(IPCAM);
  const sky = html.match(SKYLINE)?.[0];
  const hls = html.match(HLS)?.[0];
  const iframe = html.match(OTHER_IFRAME)?.[1];
  const iframeUrl = iframe && !/youtube|ipcamlive|skylinewebcams|google|facebook|doubleclick|\.m3u8/i.test(iframe)
    ? iframe.replace(/&amp;/g, '&')
    : undefined;

  return {
    ...(yt ? { youtubeId: yt } : {}),
    ...(ip ? { ipcamlive: { host: ip[1], alias: decodeURIComponent(ip[2]) } } : {}),
    ...(sky ? { skylineUrl: sky } : {}),
    ...(hls ? { hlsUrl: hls.replace(/&amp;/g, '&') } : {}),
    ...(iframeUrl ? { iframeUrl } : {}),
  };
}

export function placeForTitle(title: string): Place | null {
  return PLACES.find(p => p.match.test(title)) ?? null;
}

function toCamera(post: WpPost): CctvCamera | null {
  const title = decodeHtml(post.title?.rendered || '');
  const place = placeForTitle(`${title} ${post.slug}`);
  if (!place) return null;

  const blob = `${post.cmb2?.video_player_settings?.vm_video_url || ''}\n${post.content?.rendered || ''}`;
  const player = parseAndaluciaPlayer(blob);

  const camera: CctvCamera = {
    id: `andlive-${post.id}`,
    lat: place.lat,
    lng: place.lng,
    name: place.name,
    city: place.city,
    country: 'Spain',
    external_url: post.link,
    source: 'Andalucía Live',
  };

  if (player.youtubeId) {
    camera.stream_url = youtubeEmbedUrl(player.youtubeId);
    camera.stream_type = 'iframe';
    return camera;
  }
  if (player.ipcamlive) {
    camera.stream_url = `https://${player.ipcamlive.host}/player/player.php?alias=${player.ipcamlive.alias}`;
    camera.stream_type = 'iframe';
    return camera;
  }
  if (player.hlsUrl) {
    camera.stream_url = player.hlsUrl;
    camera.stream_type = 'hls';
    return camera;
  }
  if (player.iframeUrl) {
    camera.stream_url = player.iframeUrl;
    camera.stream_type = 'iframe';
    return camera;
  }
  if (player.skylineUrl) {
    camera.external_url = player.skylineUrl.split('?')[0];
    camera.source = 'SkylineWebcams';
    return camera;
  }
  return null;
}

let cache: { cameras: CctvCamera[]; timestamp: number } | null = null;

async function loadPosts(url: string): Promise<WpPost[]> {
  const res = await stealthFetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data as WpPost[] : [];
}

async function loadAndaluciaLiveCameras(): Promise<CctvCamera[]> {
  const [catalog, extra] = await Promise.all([
    loadPosts(CATALOG_URL),
    loadPosts(EXTRA_IDS_URL),
  ]);
  const seen = new Set<number>();
  const cameras: CctvCamera[] = [];
  for (const post of [...catalog, ...extra]) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    const camera = toCamera(post);
    if (camera) cameras.push(camera);
  }
  return cameras;
}

export async function fetchAndaluciaLiveCameras(): Promise<CctvCamera[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.cameras;
  }

  try {
    const cameras = await loadAndaluciaLiveCameras();
    if (cameras.length > 0) {
      cache = { cameras, timestamp: Date.now() };
    }
    return cameras.length > 0 ? cameras : cache?.cameras || [];
  } catch (error) {
    console.error('Failed to fetch Andalucía Live cameras:', error);
    return cache?.cameras || [];
  }
}
