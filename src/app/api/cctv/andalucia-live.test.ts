import { describe, it, expect } from 'vitest';
import {
  decodeHtml,
  parseAndaluciaPlayer,
  placeForTitle,
} from './andalucia-live';

describe('decodeHtml', () => {
  it('strips WP entities and tags', () => {
    expect(decodeHtml('Playa de Sacaba &#8211; Málaga')).toBe('Playa de Sacaba – Málaga');
  });
});

describe('parseAndaluciaPlayer', () => {
  it('reads a Sacaba YouTube embed', () => {
    expect(parseAndaluciaPlayer(
      '<iframe src="https://www.youtube.com/embed/otsP-2Hh7jg?autoplay=1"></iframe>',
    )).toEqual({ youtubeId: 'otsP-2Hh7jg' });
  });

  it('reads ipcamlive and HLS players', () => {
    expect(parseAndaluciaPlayer(
      'https://g0.ipcamlive.com/player/player.php?alias=webcamsbc&autoplay=1',
    )).toEqual({ ipcamlive: { host: 'g0.ipcamlive.com', alias: 'webcamsbc' } });

    expect(parseAndaluciaPlayer(
      'https://cdn-003.whatsupcams.com/hls/es_duquesa01.m3u8',
    )).toEqual({ hlsUrl: 'https://cdn-003.whatsupcams.com/hls/es_duquesa01.m3u8' });
  });
});

describe('placeForTitle', () => {
  it('maps known Málaga province locations', () => {
    expect(placeForTitle('Webcam Málaga 01 – Playa de Sacaba')?.name).toBe('Playa de Sacaba');
    expect(placeForTitle('Webcam Benalmádena 1 – Hotel Sunset Beach Club')?.city).toBe('Benalmádena');
    expect(placeForTitle('Webcam Torremolinos – Promenade')?.city).toBe('Torremolinos');
    expect(placeForTitle('Webcam Alhaurín de la Torre')?.city).toBe('Alhaurín de la Torre');
  });
});
