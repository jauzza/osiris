import { describe, it, expect } from 'vitest';
import { parseLivecamsPoints, parseLivecamPage, preferredLivecamSnapshot } from './meteo365';

describe('parseLivecamsPoints', () => {
  it('reads the published map catalog', () => {
    const html = `
      window.__livecamsData = {
        lang: "en",
        points: [{"slug":"malaga-misericordia","name":"Malaga — La Misericordia Beach","location":"Malaga","region":"malaga","lat":36.68321,"lon":-4.445876,"thumb":"/assets/v4/img/livecams/thumbs/misericordia.webp","href":"/livecams/malaga-misericordia.php"}]
      };
    `;
    expect(parseLivecamsPoints(html)).toEqual([
      {
        slug: 'malaga-misericordia',
        name: 'Malaga — La Misericordia Beach',
        location: 'Malaga',
        lat: 36.68321,
        lon: -4.445876,
        href: '/livecams/malaga-misericordia.php',
        thumb: '/assets/v4/img/livecams/thumbs/misericordia.webp',
      },
    ]);
  });

  it('skips a catalog with no usable points', () => {
    expect(parseLivecamsPoints('<html></html>')).toEqual([]);
  });
});

describe('parseLivecamPage', () => {
  it('reads the public HLS player attributes and poster', () => {
    const html = `
      <div class="livecam-player"
           data-livecam-player
           data-stream-type="hls"
           data-stream-url="https://webcam2.meteo365.es/hls_live/misericordia.m3u8">
      <img src="https://webcam2.meteo365.es/livecams/misericordia/current.webp">
    `;
    expect(parseLivecamPage(html)).toEqual({
      streamUrl: 'https://webcam2.meteo365.es/hls_live/misericordia.m3u8',
      streamType: 'hls',
      poster: 'https://webcam2.meteo365.es/livecams/misericordia/current.webp',
    });
  });

  it('prefers webcam.meteo365.es posters over webcam2', () => {
    const html = `
      <img src="https://webcam2.meteo365.es/livecams/alhaurindelatorre/current.webp">
      <div data-stream-type="hls"
           data-stream-url="https://webcam.meteo365.es/hls_live/alhaurindelatorre.m3u8"></div>
      <img src="https://webcam.meteo365.es/livecams/alhaurindelatorre/current.webp">
    `;
    expect(parseLivecamPage(html)).toEqual({
      streamUrl: 'https://webcam.meteo365.es/hls_live/alhaurindelatorre.m3u8',
      streamType: 'hls',
      poster: 'https://webcam.meteo365.es/livecams/alhaurindelatorre/current.webp',
    });
  });
});

describe('preferredLivecamSnapshot', () => {
  it('uses the full-size current.webp from the slug, not a catalog thumb', () => {
    expect(preferredLivecamSnapshot({ slug: 'alhaurindelatorre' }, {}))
      .toBe('https://webcam.meteo365.es/livecams/alhaurindelatorre/current.webp');
  });

  it('keeps a jpeg snapshot URL when the page says the stream is a still', () => {
    expect(preferredLivecamSnapshot(
      { slug: 'x' },
      { streamType: 'jpeg', streamUrl: 'https://webcam.meteo365.es/livecams/x/current.jpg' },
    )).toBe('https://webcam.meteo365.es/livecams/x/current.jpg');
  });
});
