import { describe, it, expect } from 'vitest';
import { mapRwsCamera, rwsPageSlug } from './netherlands';

describe('rwsPageSlug', () => {
  it('builds the slug used on rwsverkeersinfo.nl', () => {
    expect(rwsPageSlug('A1', 'Amersfoort')).toBe('a1-amersfoort');
    expect(rwsPageSlug('A9', 'knooppunt Holendrecht')).toBe('a9-holendrecht');
  });
});

describe('mapRwsCamera', () => {
  it('maps a published RWS index row to a camera with snapshot proxy', () => {
    const cam = mapRwsCamera({
      id: 4,
      inmovesId: '62',
      lat: 52.185241,
      lng: 5.41449,
      road: 'A1',
      near: 'Amersfoort',
      title: 'A1 — Amersfoort',
    });
    expect(cam).toMatchObject({
      id: 'rws-4',
      name: 'A1 — Amersfoort',
      city: 'Amersfoort',
      country: 'Netherlands',
      source: 'Rijkswaterstaat',
      external_url: 'https://www.rwsverkeersinfo.nl/cameras/4/a1-amersfoort',
    });
    expect(cam?.feed_url).toContain(encodeURIComponent('https://cameras.measureeverything.io/api/snapshot?id=62'));
  });

  it('drops rows outside the Netherlands bounding box', () => {
    expect(mapRwsCamera({
      id: 1,
      inmovesId: 'x',
      lat: 48,
      lng: 5,
      road: 'A1',
      near: 'Nowhere',
      title: 'Outside NL',
    })).toBeNull();
  });
});
