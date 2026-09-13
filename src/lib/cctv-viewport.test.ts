import { describe, it, expect } from 'vitest';
import {
  boxFromCenter,
  filterCamerasToBbox,
  getRegionsForBbox,
  getRegionsForPoint,
  inBbox,
  mergeCamerasForViewport,
  parseBbox,
  planCctvQuery,
  radiusKmForZoom,
  shouldFetchCctv,
  slimCamera,
  viewportChangedEnough,
  CCTV_MIN_FETCH_ZOOM,
  CCTV_PREVIEW_MAX_TILES,
  CCTV_PREVIEW_MAX_VIDEO_TILES,
  CCTV_PREVIEW_MIN_ZOOM,
  CCTV_VIEWPORT_CAP,
} from './cctv-viewport';

describe('getRegionsForPoint', () => {
  it('maps London to the TfL region, not the whole catalogue', () => {
    const regions = getRegionsForPoint(51.5074, -0.1278);
    expect(regions).toContain('uk');
    expect(regions).not.toContain('us-west');
    expect(regions).not.toContain('japan');
  });

  it('maps Málaga to Spain rather than every European feed', () => {
    const regions = getRegionsForPoint(36.7213, -4.4214);
    expect(regions).toContain('spain');
    expect(regions).not.toContain('uk');
    expect(regions).not.toContain('germany');
  });

  it('maps Seattle to the west-coast stack', () => {
    const regions = getRegionsForPoint(47.6062, -122.3321);
    expect(regions).toContain('us-west');
  });

  it('maps Jakarta without also paying for Japan', () => {
    const regions = getRegionsForPoint(-6.2088, 106.8456);
    expect(regions).toContain('seasia');
    expect(regions).not.toContain('japan');
    expect(regions).not.toContain('uk');
  });
});

describe('getRegionsForBbox', () => {
  it('unions regions that a wide European bbox covers', () => {
    const regions = getRegionsForBbox({ south: 41, north: 53, west: -5, east: 10 });
    expect(regions).toContain('france');
    expect(regions).toContain('spain');
  });

  it('does not explode a city bbox into region=all', () => {
    const regions = getRegionsForBbox(boxFromCenter(51.5, -0.12, 25));
    expect(regions.length).toBeLessThan(8);
    expect(regions).toContain('uk');
  });
});

describe('planCctvQuery', () => {
  it('does not fetch the world when the client sends no filter', () => {
    expect(planCctvQuery({})).toEqual({ mode: 'empty', regions: [], clip: null, cap: null });
  });

  it('keeps region=all as an explicit full-catalogue opt-in', () => {
    const plan = planCctvQuery({ region: 'all' });
    expect(plan.mode).toBe('fetch');
    expect(plan.regions).toBe('all');
    expect(plan.cap).toBeNull();
  });

  it('turns lat/lng/radius into a clipped viewport fetch', () => {
    const plan = planCctvQuery({ hasCoords: true, lat: 51.5, lng: -0.12, radiusKm: 25 });
    expect(plan.mode).toBe('fetch');
    expect(plan.regions).not.toBe('all');
    expect(plan.regions).toContain('uk');
    expect(plan.clip).toBeTruthy();
    expect(plan.cap).toBe(CCTV_VIEWPORT_CAP);
  });

  it('count=1 with no filter peeks the cache instead of fetching', () => {
    expect(planCctvQuery({ countOnly: true })).toMatchObject({ mode: 'count', regions: 'all' });
  });
});

describe('viewport fetch gating', () => {
  it('skips the globe zoom that used to trigger region=all', () => {
    expect(shouldFetchCctv(2.5)).toBe(false);
    expect(shouldFetchCctv(CCTV_MIN_FETCH_ZOOM)).toBe(true);
    expect(shouldFetchCctv(12)).toBe(true);
  });

  it('uses a city-scale radius at zoom 12, not a continent', () => {
    expect(radiusKmForZoom(12)).toBeLessThanOrEqual(40);
    expect(radiusKmForZoom(5)).toBeGreaterThan(200);
  });

  it('ignores tiny pans and refetches after a substantial move or zoom', () => {
    const here = { lat: 51.5, lng: -0.12, zoom: 12, radiusKm: 25 };
    expect(viewportChangedEnough(null, here)).toBe(true);
    expect(viewportChangedEnough(here, { ...here, lat: 51.501 })).toBe(false);
    expect(viewportChangedEnough(here, { ...here, lat: 51.8 })).toBe(true);
    expect(viewportChangedEnough(here, { ...here, zoom: 13.5 })).toBe(true);
  });
});

describe('camera clipping', () => {
  const london = { id: 'lon', lat: 51.5, lng: -0.12 };
  const seattle = { id: 'sea', lat: 47.6, lng: -122.3 };

  it('drops cameras outside the viewport box', () => {
    const box = boxFromCenter(51.5, -0.12, 30);
    expect(filterCamerasToBbox([london, seattle], box).map(c => c.id)).toEqual(['lon']);
  });

  it('keeps nearby already-loaded cameras when merging a new fetch', () => {
    const merged = mergeCamerasForViewport(
      [london, seattle],
      [{ id: 'oxf', lat: 51.75, lng: -1.26 }],
      { lat: 51.5, lng: -0.12, radiusKm: 25 },
    );
    const ids = merged.map(c => c.id);
    expect(ids).toContain('lon');
    expect(ids).toContain('oxf');
    expect(ids).not.toContain('sea');
  });

  it('handles a bbox that crosses the antimeridian', () => {
    const box = parseBbox('170,-10,-170,10')!;
    expect(inBbox(0, 175, box)).toBe(true);
    expect(inBbox(0, -175, box)).toBe(true);
    expect(inBbox(0, 0, box)).toBe(false);
  });
});

describe('slimCamera', () => {
  it('omits empty optional fields so viewport payloads stay small', () => {
    expect(slimCamera({
      id: 'a', lat: 1, lng: 2, name: 'Cam', source: 'X',
      city: '', country: 'UK', feed_url: 'https://x/a.jpg', stream_url: '',
    })).toEqual({
      id: 'a', lat: 1, lng: 2, name: 'Cam', source: 'X',
      country: 'UK', feed_url: 'https://x/a.jpg',
    });
  });
});

describe('preview budget', () => {
  it('keeps live tiles street-level and capped so the proxy is not a fan-out', () => {
    expect(CCTV_PREVIEW_MIN_ZOOM).toBeGreaterThanOrEqual(13);
    expect(CCTV_PREVIEW_MAX_TILES).toBeLessThanOrEqual(8);
    expect(CCTV_PREVIEW_MAX_VIDEO_TILES).toBeLessThanOrEqual(CCTV_PREVIEW_MAX_TILES);
  });
});
