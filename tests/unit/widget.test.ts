import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { WIDGET_HTML, widgetData } from '../../worker/src/widget';

describe('the cold brew card', () => {
  it('fits Telegram: 32 KB of HTML and 4 KB compressed', () => {
    expect(Buffer.byteLength(WIDGET_HTML)).toBeLessThan(32_768);
    expect(deflateSync(Buffer.from(WIDGET_HTML), { level: 9 }).length).toBeLessThan(4096);
  });
  it('uses nothing the sandbox removes or blocks', () => {
    expect(WIDGET_HTML).not.toMatch(/<(input|select|textarea)|fetch\(|XMLHttpRequest|WebSocket|@import|@font-face|\bvh\b|https?:\/\//);
  });
  it('its state stays under 1 KB whatever the names', () => {
    const d = widgetData({ s: 1, e: 2, st: 'run', t: 'Колд брю'.repeat(20), r: 'р'.repeat(500), b: 'Эфиопия '.repeat(80) });
    expect(Buffer.byteLength(d)).toBeLessThan(1024);
    expect(JSON.parse(d)).toMatchObject({ s: 1, e: 2, st: 'run' });
  });
});
