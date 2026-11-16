/**
 * No pinch zoom: the app is laid out for the screen it is on, like a native one.
 * iOS ignores user-scalable=no in the viewport tag (since iOS 10), so the pinch is also stopped here:
 * WebKit's gesture events, a two-finger move, and a quick second tap (double-tap zoom).
 * maximum-scale=1 in the tag also keeps iOS from zooming in on a focused field.
 */
export function noPinchZoom(doc: Document = document) {
  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) doc.addEventListener(type, stop, { passive: false });
  doc.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || ((e as TouchEvent & { scale?: number }).scale ?? 1) !== 1) stop(e);
  }, { passive: false });
}
