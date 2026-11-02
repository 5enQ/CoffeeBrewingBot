import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudSync, CloudTimeoutError, withTimeout } from '../../src/data/sync';
import type { CloudKV } from '../../src/platform/types';

const never = <T,>() => new Promise<T>(() => {});
// a client that never calls the CloudStorage callback back (Telegram Desktop for macOS, issue #2)
const hung: CloudKV = { getItems: () => never(), setItem: () => never(), removeItems: () => never(), getKeys: () => never() };
const mem = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => { m.set(k, v); } }; };

afterEach(() => { vi.useRealTimers(); });

describe('cloud call timeout', () => {
  it('passes a settled value through', async () => {
    await expect(withTimeout(Promise.resolve(5), 100)).resolves.toBe(5);
    await expect(withTimeout(Promise.reject(new Error('x')), 100)).rejects.toThrow('x');
  });

  it('a hung cloud makes pull and push fail instead of hanging', async () => {
    vi.useFakeTimers();
    const s = new CloudSync(hung, mem(), 1000);
    await s.init();
    const pull = s.pull([]);
    const pullDone = expect(pull).rejects.toBeInstanceOf(CloudTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await pullDone;
    const push = s.push({ m: 'x' });
    const pushDone = expect(push).rejects.toBeInstanceOf(CloudTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await pushDone;
  });
});
