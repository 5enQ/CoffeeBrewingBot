/**
 * Accounts: one account per person, with linked sign-in identities (Telegram now; other providers can be linked later,
 * so a standalone app can open the same account). The account owns:
 *  - a short brew log (method, water, date — no notes, beans or recipes) and the numbers counted from it;
 *  - the diamond number (1, 2, 3… in the order people reach 1000 liters);
 *  - the profile card. Levels on a shared card always come from this count, never from the client.
 */
import { DurableObject } from 'cloudflare:workers';
import { countStats, earnedLevels, givesBackground, type BrewStat, type Stats } from '../../src/data/levels.ts';
import type { Env } from './index';

export interface AccountStats extends Stats { account: string; at: number; diamondNo?: number }

const KEY = /^(method:[a-z0-9_-]{1,40}|liters|ratings)$/i;
const id = (n: number) => {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join('');
};

export class Accounts extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = (this.sql = ctx.storage.sql);
    sql.exec(`CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, created INTEGER NOT NULL, stats TEXT, diamond_no INTEGER UNIQUE)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS identity (provider TEXT NOT NULL, subject TEXT NOT NULL, account TEXT NOT NULL, PRIMARY KEY (provider, subject))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS brew (account TEXT NOT NULL, bid TEXT NOT NULL, m TEXT NOT NULL, w INTEGER NOT NULL, t INTEGER NOT NULL, r INTEGER NOT NULL, PRIMARY KEY (account, bid))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS card (id TEXT PRIMARY KEY, account TEXT NOT NULL UNIQUE, data TEXT NOT NULL, ts INTEGER NOT NULL)`);
  }

  /** The account of a sign-in identity; created on first sign-in */
  private resolve(provider: string, subject: string): { id: string; created: number } {
    const row = this.sql.exec<{ id: string; created: number }>(
      'SELECT a.id, a.created FROM identity i JOIN account a ON a.id = i.account WHERE i.provider = ? AND i.subject = ?', provider, subject).toArray()[0];
    if (row) return row;
    const acc = { id: id(12), created: Date.now() };
    this.sql.exec('INSERT INTO account (id, created) VALUES (?, ?)', acc.id, acc.created);
    this.sql.exec('INSERT INTO identity (provider, subject, account) VALUES (?, ?, ?)', provider, subject, acc.id);
    return acc;
  }

  private tgOf(account: string) {
    return this.sql.exec<{ subject: string }>("SELECT subject FROM identity WHERE account = ? AND provider = 'tg'", account).toArray()[0]?.subject ?? null;
  }

  /** Friends' ratings of this person's recipes live in AuthorRatings by Telegram id */
  private async ratings(account: string) {
    const tg = this.tgOf(account);
    if (!tg) return 0;
    try { return (await this.env.AUTHORS.get(this.env.AUTHORS.idFromName(tg)).stats()).count; } catch { return 0; }
  }

  /** Recount from the log, store the result, hand out the diamond number when 1000 liters are reached */
  private recount(acc: { id: string; created: number }, ratings: number): AccountStats {
    const rows = this.sql.exec<{ m: string; w: number; t: number; r: number }>('SELECT m, w, t, r FROM brew WHERE account = ?', acc.id).toArray() as BrewStat[];
    const s = countStats(rows, acc.created, ratings);
    let no = this.sql.exec<{ diamond_no: number | null }>('SELECT diamond_no FROM account WHERE id = ?', acc.id).one().diamond_no ?? undefined;
    if (!no && s.liters >= 1000) {
      no = (this.sql.exec<{ m: number | null }>('SELECT MAX(diamond_no) AS m FROM account').one().m ?? 0) + 1;
      this.sql.exec('UPDATE account SET diamond_no = ? WHERE id = ?', no, acc.id);
    }
    const out: AccountStats = { ...s, account: acc.id, at: Date.now(), diamondNo: no };
    this.sql.exec('UPDATE account SET stats = ? WHERE id = ?', JSON.stringify(out), acc.id);
    return out;
  }

  async me(provider: string, subject: string): Promise<AccountStats> {
    const acc = this.resolve(provider, subject);
    return this.recount(acc, await this.ratings(acc.id));
  }

  /** Brews changed on a device (the first call imports the whole history) and brews deleted there */
  async addBrews(provider: string, subject: string, brews: { id: string; m: string; w: number; t: number }[], removed: string[]): Promise<AccountStats> {
    const acc = this.resolve(provider, subject);
    const now = Date.now();
    for (const b of brews) {
      // r — when the server first saw the brew; an edit keeps it, so a date moved into the past does not count again
      this.sql.exec(`INSERT INTO brew (account, bid, m, w, t, r) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(account, bid) DO UPDATE SET m = excluded.m, w = excluded.w, t = excluded.t`, acc.id, b.id, b.m, b.w, b.t, now);
    }
    for (const bid of removed) this.sql.exec('DELETE FROM brew WHERE account = ? AND bid = ?', acc.id, bid);
    return this.recount(acc, await this.ratings(acc.id));
  }

  putCard(provider: string, subject: string, data: string) {
    const acc = this.resolve(provider, subject);
    const cur = this.sql.exec<{ id: string }>('SELECT id FROM card WHERE account = ?', acc.id).toArray()[0];
    if (cur) { this.sql.exec('UPDATE card SET data = ?, ts = ? WHERE id = ?', data, Date.now(), cur.id); return cur.id; }
    const cid = id(10);
    this.sql.exec('INSERT INTO card (id, account, data, ts) VALUES (?, ?, ?, ?)', cid, acc.id, data, Date.now());
    return cid;
  }

  /** A shared card with levels filled in from this account's count; anything not earned is dropped */
  async getCard(cid: string) {
    const row = this.sql.exec<{ data: string; account: string }>('SELECT data, account FROM card WHERE id = ?', cid).toArray()[0];
    if (!row) return null;
    const acc = this.sql.exec<{ stats: string | null; diamond_no: number | null }>('SELECT stats, diamond_no FROM account WHERE id = ?', row.account).one();
    const cached = acc.stats ? JSON.parse(acc.stats) as Stats : { methods: {}, liters: 0, ratings: 0 };
    const levels = earnedLevels({ ...cached, ratings: await this.ratings(row.account) });
    const card = JSON.parse(row.data) as Record<string, unknown>;
    const ach = (Array.isArray(card.ach) ? card.ach : []).filter((k): k is string => typeof k === 'string' && KEY.test(k) && !!levels[k]).slice(0, 3);
    let theme = card.theme as { ach?: string; base?: string } | undefined;
    if (theme?.ach && !(levels[theme.ach] && givesBackground(theme.ach, levels[theme.ach].tier))) theme = { base: 'paper' };
    const keys = [...ach, ...(theme?.ach ? [theme.ach] : [])];
    const badges = (Array.isArray(card.badges) ? card.badges : []).filter((b: { kind?: string }) => b?.kind !== 'achieve');
    return {
      ...card, ach, theme, badges,
      earned: Object.fromEntries(keys.map((k) => [k, levels[k]])),
      no: theme?.ach === 'liters' && acc.diamond_no ? acc.diamond_no : undefined,
    };
  }
}
