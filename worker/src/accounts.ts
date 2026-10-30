/**
 * Accounts: one account per person, with linked sign-in identities (Telegram now; other providers can be linked later,
 * so a standalone app can open the same account). The account owns:
 *  - a short brew log (method, water, date — no notes, beans or recipes) and the numbers counted from it;
 *  - the diamond number (1, 2, 3… in the order people reach 1000 liters);
 *  - special backgrounds the owner grants by hand (the developers' background);
 *  - the profile card. Levels on a shared card always come from this count, never from the client.
 */
import { DurableObject } from 'cloudflare:workers';
import { countStats, earnedLevels, givesBackground, LITER_LEVELS, METHOD_LEVELS, type BrewStat, type Level, type Stats, type Tier } from '../../src/data/levels.ts';
import type { Env } from './index';

export interface AccountStats extends Stats { account: string; at: number; diamondNo?: number; grants: string[] }

/**
 * Grants only the owner can give, each separately:
 *  dev    — the developers' card background;
 *  tester — every background at every level, for testing; such accounts never take a real diamond number (they show № 0).
 * Owners (OWNER_IDS) have both automatically.
 */
export const SPECIAL = ['dev', 'tester'] as const;
const TEST_NO = 0;

const KEY = /^(method:[a-z0-9_-]{1,40}|liters|ratings)$/i;
const id = (n: number) => {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join('');
};

/** For testers: the level a chosen tier stands for (methods: bronze…volume; liters: diamond) */
function testerLevel(key: string, tier: Tier): Level | null {
  const list = key.startsWith('method:') ? METHOD_LEVELS : key === 'liters' ? LITER_LEVELS : [];
  return list.find((l) => l.tier === tier) ?? null;
}

export class Accounts extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = (this.sql = ctx.storage.sql);
    sql.exec(`CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, created INTEGER NOT NULL, stats TEXT, diamond_no INTEGER UNIQUE)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS identity (provider TEXT NOT NULL, subject TEXT NOT NULL, account TEXT NOT NULL, PRIMARY KEY (provider, subject))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS brew (account TEXT NOT NULL, bid TEXT NOT NULL, m TEXT NOT NULL, w INTEGER NOT NULL, t INTEGER NOT NULL, r INTEGER NOT NULL, PRIMARY KEY (account, bid))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS card (id TEXT PRIMARY KEY, account TEXT NOT NULL UNIQUE, data TEXT NOT NULL, ts INTEGER NOT NULL)`);
    // one-time migrations, gated by the schema version (the object wakes up often; see CoffeeCatalog)
    sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    if (!sql.exec("SELECT 1 FROM meta WHERE key = 'schema'").toArray().length) {
      try { sql.exec("ALTER TABLE account ADD COLUMN grants TEXT NOT NULL DEFAULT '[]'"); } catch { /* already there */ }
      sql.exec("INSERT INTO meta (key, value) VALUES ('schema', '1')");
    }
  }

  private grantsOf(account: string): string[] {
    const g = this.sql.exec<{ grants: string }>('SELECT grants FROM account WHERE id = ?', account).toArray()[0]?.grants;
    let list: string[] = [];
    try { list = JSON.parse(g ?? '[]'); } catch { /* broken row: no grants */ }
    const tg = this.tgOf(account);
    const owners = (this.env.OWNER_IDS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    return tg && owners.includes(tg) ? [...new Set([...list, ...SPECIAL])] : list;
  }

  /** Owner: give or take away a special background by Telegram id (the account is created if the person never opened the app) */
  grant(tg: string, what: string, on: boolean) {
    if (!(SPECIAL as readonly string[]).includes(what) || !/^\d{1,20}$/.test(tg)) return false;
    const acc = this.resolve('tg', tg);
    const cur = new Set(this.grantsOf(acc.id));
    if (on) cur.add(what); else cur.delete(what);
    this.sql.exec('UPDATE account SET grants = ? WHERE id = ?', JSON.stringify([...cur]), acc.id);
    return true;
  }

  /** Owner: everyone with a special background */
  grantList() {
    return this.sql.exec<{ id: string; grants: string; subject: string | null }>(
      "SELECT a.id, a.grants, i.subject FROM account a LEFT JOIN identity i ON i.account = a.id AND i.provider = 'tg' WHERE a.grants <> '[]'").toArray()
      .map((r) => ({ account: r.id, tg: r.subject, grants: JSON.parse(r.grants) as string[] }));
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
    const tester = this.grantsOf(acc.id).includes('tester');
    let no = tester ? TEST_NO : this.sql.exec<{ diamond_no: number | null }>('SELECT diamond_no FROM account WHERE id = ?', acc.id).one().diamond_no ?? undefined;
    if (!tester && !no && s.liters >= 1000) {
      no = (this.sql.exec<{ m: number | null }>('SELECT MAX(diamond_no) AS m FROM account').one().m ?? 0) + 1;
      this.sql.exec('UPDATE account SET diamond_no = ? WHERE id = ?', no, acc.id);
    }
    const out: AccountStats = { ...s, account: acc.id, at: Date.now(), diamondNo: no, grants: this.grantsOf(acc.id) };
    this.sql.exec('UPDATE account SET stats = ? WHERE id = ?', JSON.stringify(out), acc.id);
    return out;
  }

  /**
   * Called on every app start: answer from the stored count (the brew log is read only when brews arrive —
   * the free tier limits rows read per day). Ratings and grants are cheap and always fresh.
   */
  async me(provider: string, subject: string): Promise<AccountStats> {
    const acc = this.resolve(provider, subject);
    const ratings = await this.ratings(acc.id);
    const row = this.sql.exec<{ stats: string | null }>('SELECT stats FROM account WHERE id = ?', acc.id).one();
    if (!row.stats) return this.recount(acc, ratings);
    const cached = JSON.parse(row.stats) as AccountStats;
    const tester = this.grantsOf(acc.id).includes('tester');
    return { ...cached, ratings, at: Date.now(), grants: this.grantsOf(acc.id), diamondNo: tester ? TEST_NO : cached.diamondNo === TEST_NO ? undefined : cached.diamondNo };
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
    let theme = card.theme as { ach?: string; tier?: Tier; base?: string; special?: string } | undefined;
    const grants = this.grantsOf(row.account);
    const tester = grants.includes('tester');
    // a tester picks any level of any background; everyone else gets the level they earned
    const testLevel = tester && theme?.ach && theme.tier ? testerLevel(theme.ach, theme.tier) : null;
    const themeLevel = testLevel ?? (theme?.ach ? levels[theme.ach] : undefined);
    if (theme?.ach && !(themeLevel && givesBackground(theme.ach, themeLevel.tier))) theme = { base: 'paper' };
    if (theme?.special && !grants.includes(theme.special)) theme = { base: 'paper' };
    const badges = (Array.isArray(card.badges) ? card.badges : []).filter((b: { kind?: string }) => b?.kind !== 'achieve');
    const earned: Record<string, Level> = Object.fromEntries(ach.map((k) => [k, levels[k]]));
    if (theme?.ach && themeLevel) earned[theme.ach] = themeLevel;
    return {
      ...card, ach, theme: theme?.ach ? { ach: theme.ach } : theme, badges, earned,
      granted: theme?.special ? [theme.special] : [],
      no: theme?.ach === 'liters' ? (tester ? TEST_NO : acc.diamond_no ?? undefined) : undefined,
    };
  }
}
