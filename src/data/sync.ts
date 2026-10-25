/**
 * Синхронизация через Telegram CloudStorage.
 *
 * В облаке:
 *   idx          — оглавление: для каждой корзины хеш содержимого и число частей
 *   <корзина>_N  — части сжатой корзины по 4096 символов (m — метаданные, k — пачки, bYYYYMM — заварки месяца)
 *
 * Скачиваются только корзины, у которых хеш отличается от последнего применённого;
 * загружаются только те, что изменились. Оглавление пишется последним.
 */
import { CLOUD_LIMITS, type CloudKV } from '../platform/types';
import { hash, packText, unpackText } from './codec';
import { FORMAT, fromBuckets, type Remote } from './persist';
import type { DB } from './store';

const IDX = 'idx';
const STATE_KEY = 'brewbook.sync.v1';
const BATCH = 40;

/** корзина → [хеш JSON, число частей, символов в облаке] */
interface Manifest { f: number; t: number; b: Record<string, [string, number, number?]> }

export interface SyncUsage { chars: number; keys: number }
export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  at?: number;
  error?: string;
  usage?: SyncUsage;
}

interface LocalState { applied: Record<string, string>; usage?: SyncUsage; at?: number }

export class CloudFullError extends Error {}

const partKey = (name: string, i: number) => `${name}_${i}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const split = (s: string, n: number) => range(Math.ceil(s.length / n) || 1).map((i) => s.slice(i * n, (i + 1) * n));

export class CloudSync {
  private remote: Manifest | null = null;
  private st: LocalState = { applied: {} };

  private cloud: CloudKV;
  private local: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };

  constructor(cloud: CloudKV, local: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> }) {
    this.cloud = cloud;
    this.local = local;
  }

  async init() {
    try {
      const raw = await this.local.get(STATE_KEY);
      if (raw) this.st = { applied: {}, ...JSON.parse(raw) };
    } catch { /* начнём с нуля */ }
    return this.st;
  }

  private save() { return this.local.set(STATE_KEY, JSON.stringify(this.st)); }

  private async manifest(): Promise<Manifest | null> {
    const v = (await this.cloud.getItems([IDX]))[IDX];
    if (!v) return null;
    try {
      const m = JSON.parse(v) as Manifest;
      if (m.f > FORMAT) throw new Error('Данные в облаке записаны более новой версией приложения — обновите его');
      return m;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Данные')) throw e;
      return null;
    }
  }

  private async getMany(keys: string[]) {
    const out: Record<string, string> = {};
    for (let i = 0; i < keys.length; i += BATCH) Object.assign(out, await this.cloud.getItems(keys.slice(i, i + BATCH)));
    return out;
  }

  /** Скачать изменившиеся корзины. null — в облаке нет ничего нового. */
  async pull(localGear: DB['gear']): Promise<{ remote: Remote; names: Record<string, string> } | null> {
    const man = await this.manifest();
    this.remote = man;
    if (!man) return null;
    const changed = Object.entries(man.b).filter(([name, [h]]) => this.st.applied[name] !== h);
    if (!changed.length) return null;
    const values = await this.getMany(changed.flatMap(([name, [, n]]) => range(n).map((i) => partKey(name, i))));
    const buckets: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const [name, [h, n]] of changed) {
      const parts = range(n).map((i) => values[partKey(name, i)]);
      if (parts.some((p) => p === undefined)) continue; // другое устройство как раз пишет — заберём в следующий раз
      try {
        const json = await unpackText(parts.join(''));
        if (hash(json) !== h) continue;
        buckets[name] = json;
        names[name] = h;
      } catch { /* битая корзина — пропускаем */ }
    }
    if (!Object.keys(buckets).length) return null;
    const remote = fromBuckets(buckets, localGear);
    for (const name of remote.skipped ?? []) delete names[name];
    return { remote, names };
  }

  /** Отметить корзины применёнными (после слияния) */
  async applied(names: Record<string, string>) {
    this.st.applied = { ...this.st.applied, ...names };
    await this.save();
  }

  /**
   * Отправить изменения. 'stale' — пока мы сливали, другое устройство успело записать своё: надо скачать ещё раз.
   */
  async push(buckets: Record<string, string>): Promise<'ok' | 'stale'> {
    const man = await this.manifest();
    if ((man?.t ?? 0) !== (this.remote?.t ?? 0)) { this.remote = man; return 'stale'; }

    const next: Manifest = { f: FORMAT, t: Date.now(), b: {} };
    const writes: [string, string][] = [];
    const removes: string[] = [];
    let chars = 0;

    for (const [name, json] of Object.entries(buckets)) {
      const h = hash(json);
      const old = man?.b[name];
      if (old && old[0] === h) { next.b[name] = old; chars += old[2] ?? old[1] * CLOUD_LIMITS.value; continue; }
      const parts = split(await packText(json), CLOUD_LIMITS.value);
      parts.forEach((p, i) => writes.push([partKey(name, i), p]));
      for (let i = parts.length; i < (old?.[1] ?? 0); i++) removes.push(partKey(name, i));
      const size = parts.reduce((s, p) => s + p.length, 0);
      next.b[name] = [h, parts.length, size];
      chars += size;
    }
    for (const [name, [, n]] of Object.entries(man?.b ?? {})) if (!buckets[name]) removes.push(...range(n).map((i) => partKey(name, i)));

    const keys = 1 + Object.values(next.b).reduce((s, [, n]) => s + n, 0);
    if (keys > CLOUD_LIMITS.keys) throw new CloudFullError('Облачное хранилище Telegram заполнено');

    const usage = { chars, keys };
    if (!writes.length && !removes.length && man) {
      this.st = { ...this.st, applied: Object.fromEntries(Object.entries(next.b).map(([n, [h]]) => [n, h])), usage, at: Date.now() };
      await this.save();
      return 'ok';
    }
    for (const [k, v] of writes) await this.cloud.setItem(k, v);
    await this.cloud.setItem(IDX, JSON.stringify(next));
    if (removes.length) await this.cloud.removeItems(removes);

    this.remote = next;
    this.st = { applied: Object.fromEntries(Object.entries(next.b).map(([n, [h]]) => [n, h])), usage, at: Date.now() };
    await this.save();
    return 'ok';
  }

  get usage() { return this.st.usage; }
  get lastAt() { return this.st.at; }
}
