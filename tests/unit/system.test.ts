import { describe, expect, it } from 'vitest';
import { systemOf } from '../../src/data/tester';

describe('short system line for testers\' reports', () => {
  it('names the system and the built-in browser', () => {
    expect(systemOf('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36')).toBe('Android 14 · WebView 130');
    expect(systemOf('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36')).toBe('Android 13 · Chrome 129');
    expect(systemOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148')).toBe('iOS 17.5');
    expect(systemOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')).toBe('Windows · Chrome 130');
    expect(systemOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15')).toBe('macOS · Safari 17');
  });
});
