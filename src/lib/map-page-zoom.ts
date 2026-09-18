/**
 * OSIRIS — keep pinch / ctrl-wheel on the dashboard, not the browser page.
 *
 * Trackpads (especially macOS) send pinch as a wheel event with ctrlKey set.
 * Once the map is at max zoom, the browser treats the same gesture as page
 * zoom, and the operator is stuck in a blown-up HUD they cannot map-zoom out of.
 */

export function isBrowserZoomWheel(event: Pick<WheelEvent, 'ctrlKey' | 'metaKey'>): boolean {
  return event.ctrlKey || event.metaKey;
}

/** Stops the browser from stealing a map pinch. Returns true when it did. */
export function preventBrowserZoom(event: WheelEvent): boolean {
  if (!isBrowserZoomWheel(event)) return false;
  event.preventDefault();
  return true;
}

export function clampZoom(zoom: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, zoom));
}

/** Safari pinch uses gesture events; those also blow up the page instead of the map. */
export function preventBrowserGesture(event: Event): void {
  event.preventDefault();
}

export function attachBrowserZoomGuard(target: EventTarget): () => void {
  const onWheel = (event: Event) => {
    preventBrowserZoom(event as WheelEvent);
  };
  const onGesture = (event: Event) => {
    preventBrowserGesture(event);
  };
  target.addEventListener('wheel', onWheel, { capture: true, passive: false });
  target.addEventListener('gesturestart', onGesture);
  target.addEventListener('gesturechange', onGesture);
  return () => {
    target.removeEventListener('wheel', onWheel, true);
    target.removeEventListener('gesturestart', onGesture);
    target.removeEventListener('gesturechange', onGesture);
  };
}
