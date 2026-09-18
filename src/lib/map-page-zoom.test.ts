import { describe, it, expect } from 'vitest';
import { attachBrowserZoomGuard, clampZoom, isBrowserZoomWheel, preventBrowserZoom } from './map-page-zoom';

describe('isBrowserZoomWheel', () => {
  it('treats a trackpad pinch (ctrl+wheel) as browser zoom', () => {
    expect(isBrowserZoomWheel({ ctrlKey: true, metaKey: false })).toBe(true);
  });

  it('treats cmd+wheel the same way', () => {
    expect(isBrowserZoomWheel({ ctrlKey: false, metaKey: true })).toBe(true);
  });

  it('leaves a normal map scroll alone', () => {
    expect(isBrowserZoomWheel({ ctrlKey: false, metaKey: false })).toBe(false);
  });
});

describe('preventBrowserZoom', () => {
  it('cancels the pinch and leaves a plain wheel untouched', () => {
    const pinch = { ctrlKey: true, metaKey: false, preventDefault() { this.called = true; }, called: false };
    expect(preventBrowserZoom(pinch as unknown as WheelEvent)).toBe(true);
    expect(pinch.called).toBe(true);

    const plain = { ctrlKey: false, metaKey: false, preventDefault() { this.called = true; }, called: false };
    expect(preventBrowserZoom(plain as unknown as WheelEvent)).toBe(false);
    expect(plain.called).toBe(false);
  });
});

describe('clampZoom', () => {
  it('stays inside the map camera range', () => {
    expect(clampZoom(22, 1.5, 18)).toBe(18);
    expect(clampZoom(0, 1.5, 18)).toBe(1.5);
    expect(clampZoom(12, 1.5, 18)).toBe(12);
  });
});

describe('attachBrowserZoomGuard', () => {
  it('listens on the target and cleans up', () => {
    const types = new Set<string>();
    const target = {
      addEventListener(type: string) { types.add(type); },
      removeEventListener(type: string) { types.delete(type); },
    };
    const detach = attachBrowserZoomGuard(target as unknown as EventTarget);
    expect(types.has('wheel')).toBe(true);
    expect(types.has('gesturestart')).toBe(true);
    detach();
    expect(types.size).toBe(0);
  });
});
