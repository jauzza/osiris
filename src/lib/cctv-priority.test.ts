import { describe, it, expect } from 'vitest';
import {
  cctvPriorityRank,
  pickPuertaBlancaGrid,
  pickAlhaurinGrid,
  PUERTA_BLANCA,
  ALHAURIN_DE_LA_TORRE,
  inMalagaBbox,
  inCostaDelSolBbox,
} from './cctv-priority';

describe('cctvPriorityRank', () => {
  it('ranks Avenida Molière at the top', () => {
    expect(cctvPriorityRank({ name: 'AVDA. MOLIERE', lat: 36.689, lng: -4.461 })).toBe(3);
  });

  it('ranks Puerta Blanca proximity highly', () => {
    expect(cctvPriorityRank({ name: 'GUINDOS', lat: PUERTA_BLANCA.lat, lng: PUERTA_BLANCA.lng })).toBe(3);
  });

  it('ranks Alhaurín de la Torre at the top', () => {
    expect(cctvPriorityRank({
      name: 'Alhaurín de la Torre',
      lat: ALHAURIN_DE_LA_TORRE.lat,
      lng: ALHAURIN_DE_LA_TORRE.lng,
    })).toBe(3);
  });

  it('ranks nearby Alhaurín pins by proximity', () => {
    expect(cctvPriorityRank({
      name: 'A-357 km 12',
      lat: ALHAURIN_DE_LA_TORRE.lat + 0.005,
      lng: ALHAURIN_DE_LA_TORRE.lng,
    })).toBe(3);
  });

  it('ranks the A-7 Alhaurín slip by proximity', () => {
    expect(cctvPriorityRank({
      name: 'A-7 km 995.3',
      lat: 36.6779,
      lng: -4.5263,
    })).toBe(3);
  });

  it('ranks other Málaga city cams above default', () => {
    expect(cctvPriorityRank({ name: 'ALAMEDA', lat: 36.72, lng: -4.42, city: 'Málaga' })).toBe(2);
  });

  it('leaves unrelated cams at default rank', () => {
    expect(cctvPriorityRank({ name: 'A1 — Amersfoort', lat: 52.2, lng: 5.4, city: 'Amersfoort' })).toBe(0);
  });
});

describe('inMalagaBbox', () => {
  it('includes Puerta Blanca', () => {
    expect(inMalagaBbox(PUERTA_BLANCA.lat, PUERTA_BLANCA.lng)).toBe(true);
  });
});

describe('inCostaDelSolBbox', () => {
  it('includes Alhaurín de la Torre and Marbella', () => {
    expect(inCostaDelSolBbox(ALHAURIN_DE_LA_TORRE.lat, ALHAURIN_DE_LA_TORRE.lng)).toBe(true);
    expect(inCostaDelSolBbox(36.51, -4.88)).toBe(true);
  });
});

describe('pickPuertaBlancaGrid', () => {
  it('picks EDUARDO TOLDRÁ, both Molière cams, and Sacaba', () => {
    const pool = [
      { id: '1', name: 'EDUARDO TOLDRÁ', lat: 36.689, lng: -4.461, feed_url: '/a.jpg' },
      { id: '2', name: 'AVDA. MOLIERE', lat: 36.689, lng: -4.461, feed_url: '/b.jpg' },
      { id: '3', name: 'AVDA MOLIERE - PATO', lat: 36.688, lng: -4.459, feed_url: '/c.jpg' },
      { id: '4', name: 'SACABA', lat: 36.687, lng: -4.447, feed_url: '/d.jpg' },
    ];
    const grid = pickPuertaBlancaGrid(pool, 4);
    expect(grid.map(c => c.id)).toEqual(['1', '2', '3', '4']);
  });
});

describe('pickAlhaurinGrid', () => {
  it('picks Jabalcuza then the A-7 / A-357 approaches', () => {
    const pool = [
      { id: 'dgt-x', name: 'A-45 km 10', lat: 36.7, lng: -4.5, city: 'Málaga', feed_url: '/x.jpg' },
      { id: 'dgt-60', name: 'A-357 km 60.2 — Alhaurín / Cártama', lat: 36.716, lng: -4.556, city: 'Alhaurín de la Torre', feed_url: '/60.jpg' },
      { id: 'dgt-995', name: 'A-7 km 995 — Alhaurín / Torremolinos', lat: 36.678, lng: -4.526, city: 'Alhaurín de la Torre', feed_url: '/995.jpg' },
      { id: 'meteo', name: 'Alhaurín de la Torre', lat: 36.655, lng: -4.562, city: 'Alhaurín de la Torre', feed_url: '/j.jpg' },
      { id: 'dgt-61', name: 'A-357 km 61.8 — Alhaurín / Cártama', lat: 36.712, lng: -4.539, city: 'Alhaurín de la Torre', feed_url: '/61.jpg' },
    ];
    expect(pickAlhaurinGrid(pool, 4).map(c => c.id)).toEqual(['meteo', 'dgt-995', 'dgt-61', 'dgt-60']);
  });
});
