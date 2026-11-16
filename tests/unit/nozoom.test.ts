import { describe, expect, it } from 'vitest';
import { noPinchZoom } from '../../src/platform/nozoom';

const ev = (type: string, extra: object = {}) => Object.assign(new Event(type, { cancelable: true }), extra);

describe('no pinch zoom', () => {
  const doc = new EventTarget() as unknown as Document;
  noPinchZoom(doc);
  it("stops WebKit's gesture events", () => {
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) { const e = ev(t); doc.dispatchEvent(e); expect(e.defaultPrevented).toBe(true); }
  });
  it('stops a two-finger move and a scaled one', () => {
    const two = ev('touchmove', { touches: [{}, {}] }); doc.dispatchEvent(two); expect(two.defaultPrevented).toBe(true);
    const scaled = ev('touchmove', { touches: [{}], scale: 1.3 }); doc.dispatchEvent(scaled); expect(scaled.defaultPrevented).toBe(true);
  });
  it('leaves one-finger scrolling alone', () => {
    const one = ev('touchmove', { touches: [{}], scale: 1 }); doc.dispatchEvent(one); expect(one.defaultPrevented).toBe(false);
  });
});
