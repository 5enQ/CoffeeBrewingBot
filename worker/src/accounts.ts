/**
 * Accounts: one account per person, with linked sign-in identities (Telegram now; other providers can be linked later,
 * so a standalone app can open the same account). The account owns:
 *  - a short brew log (method, water, date — no notes, beans or recipes) and the numbers counted from it;
 *  - the diamond number (1, 2, 3… in the order people reach 1000 liters);
 *  - special backgrounds the owner grants by hand (the developers' background);
 *  - the profile card. Levels on a shared card always come from this count, never from the client.
 */
import { DurableObject } from 'cloudflare:workers';
import { RARE_IDS } from '../../src/data/rare.ts';
import { EVENT_CAP, EVENT_NAMES, type MetricEvent, type Metrics } from '../../src/data/metrics.ts';
import { countStats, earnedLevels, givesBackground, levelUpTo, LITER_LEVELS, METHOD_LEVELS, type BrewStat, type Level, type Stats, type Tier } from '../../src/data/levels.ts';
import type { Env } from './index';

export interface AccountStats extends Stats { account: string; at: number; diamondNo?: number; grants: string[];
  /** roles offered to this person that wait for their answer (see INVITE) */
  invites?: string[] }

/** roles that are offered, not given: the person agrees first (testing may collect more data from them) */
export const INVITE = ['beta'] as const;
/** what became of an offer: waiting for the answer, taken, turned down */
export type OfferState = 'pending' | 'accepted' | 'declined';
type Offers = Record<string, { state: OfferState; at: number }>;

/**
 * Grants only the owner can give, each separately:
 *  dev    — the developers' card background;
 *  beta   — the testers' card background (people who test new versions);
 *  tester — every background at every level, for testing; such accounts never take a real diamond number (they show № 0).
 * Owners (OWNER_IDS) have both automatically.
 */
export const SPECIAL = ['dev', 'beta', 'tester', 'lighthouse'] as const;

/** what Telegram tells about the person on each sign-in (kept so the owner sees who is who) */
export interface Who { username?: string; name?: string }
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

/** a UTC day, YYYY-MM-DD */
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export class Accounts extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = (this.sql = ctx.storage.sql);
    sql.exec(`CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, created INTEGER NOT NULL, stats TEXT, diamond_no INTEGER UNIQUE)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS identity (provider TEXT NOT NULL, subject TEXT NOT NULL, account TEXT NOT NULL, PRIMARY KEY (provider, subject))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS brew (account TEXT NOT NULL, bid TEXT NOT NULL, m TEXT NOT NULL, w INTEGER NOT NULL, t INTEGER NOT NULL, r INTEGER NOT NULL, PRIMARY KEY (account, bid))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS card (id TEXT PRIMARY KEY, account TEXT NOT NULL UNIQUE, data TEXT NOT NULL, ts INTEGER NOT NULL)`);
    // one pending "your brew is ready" message per account; the alarm fires at the earliest one
    sql.exec(`CREATE TABLE IF NOT EXISTS reminder (account TEXT PRIMARY KEY, chat TEXT NOT NULL, at INTEGER NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL)`);
    sql.exec('CREATE INDEX IF NOT EXISTS reminder_at ON reminder (at)');
    // what happened to each person's last reminder (scheduled / cancelled / sent / failed + Telegram's answer)
    // testers: what to check in this version, each tester's answer, and a daily cap on reports
    sql.exec(`CREATE TABLE IF NOT EXISTS check_item (id TEXT PRIMARY KEY, text TEXT NOT NULL, ord INTEGER NOT NULL, created INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS check_result (item TEXT NOT NULL, account TEXT NOT NULL, state TEXT NOT NULL, note TEXT, ts INTEGER NOT NULL, PRIMARY KEY (item, account))`);
    // bug reports (and «есть проблема» answers), kept so the owner can hand one over for fixing (a GitHub issue)
    sql.exec(`CREATE TABLE IF NOT EXISTS report (id TEXT PRIMARY KEY, account TEXT NOT NULL, kind TEXT NOT NULL, item TEXT, text TEXT NOT NULL, context TEXT, photo INTEGER NOT NULL DEFAULT 0, ts INTEGER NOT NULL, issue TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS feedback_day (account TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (account, day))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS reminder_log (account TEXT PRIMARY KEY, at INTEGER NOT NULL, state TEXT NOT NULL, detail TEXT, ts INTEGER NOT NULL)`);
    // one-time migrations, gated by the schema version (the object wakes up often; see CoffeeCatalog)
    sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    if (!sql.exec("SELECT 1 FROM meta WHERE key = 'schema'").toArray().length) {
      try { sql.exec("ALTER TABLE account ADD COLUMN grants TEXT NOT NULL DEFAULT '[]'"); } catch { /* already there */ }
      sql.exec("INSERT INTO meta (key, value) VALUES ('schema', '1')");
    }
    // v2: the owner's note on a person, the Telegram username and name (for links in the owner's list)
    if (Number(sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").toArray()[0]?.value ?? 0) < 2) {
      for (const q of ['ALTER TABLE account ADD COLUMN note TEXT', 'ALTER TABLE identity ADD COLUMN username TEXT', 'ALTER TABLE identity ADD COLUMN name TEXT']) {
        try { sql.exec(q); } catch { /* already there */ }
      }
      sql.exec("UPDATE meta SET value = '2' WHERE key = 'schema'");
    }
    // v3: the Telegram file id of a report's screenshot (copied into the private bug repository on hand-over)
    if (Number(sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").toArray()[0]?.value ?? 0) < 3) {
      try { sql.exec('ALTER TABLE report ADD COLUMN photo_id TEXT'); } catch { /* already there */ }
      sql.exec("UPDATE meta SET value = '3' WHERE key = 'schema'");
    }
    // v4: brews carry rare-lot tags
    if (Number(sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").toArray()[0]?.value ?? 0) < 4) {
      try { sql.exec('ALTER TABLE brew ADD COLUMN x TEXT'); } catch { /* already there */ }
      sql.exec("UPDATE meta SET value = '4' WHERE key = 'schema'");
    }
    // v5: metrics — when a person last opened the app; per day, how many did; anonymous counters (no account in them)
    if (Number(sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").toArray()[0]?.value ?? 0) < 5) {
      try { sql.exec('ALTER TABLE account ADD COLUMN seen INTEGER'); } catch { /* already there */ }
      sql.exec("UPDATE meta SET value = '5' WHERE key = 'schema'");
    }
    // v6: roles offered to a person and their answer (testers agree before the role is theirs)
    if (Number(sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").toArray()[0]?.value ?? 0) < 6) {
      try { sql.exec("ALTER TABLE account ADD COLUMN offers TEXT NOT NULL DEFAULT '{}'"); } catch { /* already there */ }
      sql.exec("UPDATE meta SET value = '6' WHERE key = 'schema'");
    }
    // v7: people who were testers before the invitation existed are asked too: their role becomes an offer
    // (paused until they agree, gone if they decline); the owners are left as they are
    if (Number(sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").toArray()[0]?.value ?? 0) < 7) {
      const owners = (env.OWNER_IDS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const rows = sql.exec<{ id: string; grants: string; offers: string; tg: string | null }>(
        "SELECT a.id, a.grants, a.offers, i.subject AS tg FROM account a LEFT JOIN identity i ON i.account = a.id AND i.provider = 'tg' WHERE a.grants LIKE '%\"beta\"%'").toArray();
      for (const r of rows) {
        if (r.tg && owners.includes(r.tg)) continue;
        let grants: string[] = [], offers: Offers = {};
        try { grants = JSON.parse(r.grants); offers = JSON.parse(r.offers || '{}'); } catch { continue; }
        if (offers.beta?.state === 'accepted') continue;
        offers.beta = { state: 'pending', at: Date.now() };
        sql.exec('UPDATE account SET grants = ?, offers = ? WHERE id = ?', JSON.stringify(grants.filter((g) => g !== 'beta')), JSON.stringify(offers), r.id);
      }
      sql.exec("UPDATE meta SET value = '7' WHERE key = 'schema'");
    }
    sql.exec('CREATE TABLE IF NOT EXISTS active_day (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS usage_day (day TEXT NOT NULL, ev TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, ev))');
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
    const offers = this.offersOf(acc.id);
    if (on && (INVITE as readonly string[]).includes(what) && !cur.has(what)) {
      // offered: the role is theirs once they agree in the app
      offers[what] = { state: 'pending', at: Date.now() };
    } else if (on) cur.add(what);
    else { cur.delete(what); delete offers[what]; }
    this.sql.exec('UPDATE account SET grants = ?, offers = ? WHERE id = ?', JSON.stringify([...cur]), JSON.stringify(offers), acc.id);
    return true;
  }

  private offersOf(account: string): Offers {
    try { return JSON.parse(this.sql.exec<{ offers: string }>('SELECT offers FROM account WHERE id = ?', account).toArray()[0]?.offers ?? '{}'); } catch { return {}; }
  }
  private invitesOf(account: string) {
    return Object.entries(this.offersOf(account)).filter(([, o]) => o.state === 'pending').map(([k]) => k);
  }

  /** the person answers an offer in the app: agreeing gives the role, declining leaves it out; the owner sees which */
  answerInvite(provider: string, subject: string, what: string, accept: boolean): { label: string } | null {
    const acc = this.resolve(provider, subject);
    const offers = this.offersOf(acc.id);
    if (offers[what]?.state !== 'pending') return null;
    offers[what] = { state: accept ? 'accepted' : 'declined', at: Date.now() };
    const cur = new Set(this.grantsOf(acc.id));
    if (accept) cur.add(what); else cur.delete(what);
    this.sql.exec('UPDATE account SET grants = ?, offers = ? WHERE id = ?', JSON.stringify([...cur]), JSON.stringify(offers), acc.id);
    const r = this.sql.exec<{ note: string | null; username: string | null; name: string | null }>(
      "SELECT a.note, i.username, i.name FROM account a LEFT JOIN identity i ON i.account = a.id AND i.provider = 'tg' WHERE a.id = ?", acc.id).toArray()[0];
    return { label: [r?.note, r?.name, r?.username ? '@' + r.username : null, provider === 'tg' ? `ID ${subject}` : null].filter(Boolean).join(' · ') };
  }

  /** Owner: everyone with a special background or a note */
  grantList() {
    return this.sql.exec<{ id: string; grants: string; offers: string; note: string | null; subject: string | null; username: string | null; name: string | null }>(
      "SELECT a.id, a.grants, a.offers, a.note, i.subject, i.username, i.name FROM account a LEFT JOIN identity i ON i.account = a.id AND i.provider = 'tg' WHERE a.grants <> '[]' OR a.offers <> '{}' OR a.note IS NOT NULL").toArray()
      .map((r) => {
        let offers: Offers = {};
        try { offers = JSON.parse(r.offers || '{}'); } catch { /* broken row */ }
        // only what is still open or was turned down: an accepted offer is just the role
        const open = Object.fromEntries(Object.entries(offers).filter(([, o]) => o.state !== 'accepted').map(([k, o]) => [k, o.state]));
        return { account: r.id, tg: r.subject, grants: JSON.parse(r.grants) as string[], offers: open, note: r.note ?? undefined, username: r.username ?? undefined, name: r.name ?? undefined };
      });
  }

  /** Owner: remove a person from the list — all grants and the note go; their brews, card and numbers stay */
  forget(tg: string) {
    if (!/^\d{1,20}$/.test(tg)) return false;
    const row = this.sql.exec<{ account: string }>("SELECT account FROM identity WHERE provider = 'tg' AND subject = ?", tg).toArray()[0];
    if (row) this.sql.exec("UPDATE account SET grants = '[]', offers = '{}', note = NULL WHERE id = ?", row.account);
    return true;
  }

  /** Owner: a note on a person ("Аня, бариста из Kojo"), and their @username if they never opened the app yet */
  setNote(tg: string, note: string, username?: string) {
    if (!/^\d{1,20}$/.test(tg)) return false;
    const acc = this.resolve('tg', tg);
    const n = note.replace(/\s+/g, ' ').trim().slice(0, 80);
    this.sql.exec('UPDATE account SET note = ? WHERE id = ?', n || null, acc.id);
    const u = (username ?? '').replace(/^@/, '').trim();
    if (/^[A-Za-z0-9_]{4,32}$/.test(u)) this.sql.exec("UPDATE identity SET username = ? WHERE provider = 'tg' AND subject = ?", u, tg);
    return true;
  }

  /** The account of a sign-in identity; created on first sign-in */
  private resolve(provider: string, subject: string, who?: Who): { id: string; created: number } {
    const row = this.sql.exec<{ id: string; created: number; username: string | null; name: string | null }>(
      'SELECT a.id, a.created, i.username, i.name FROM identity i JOIN account a ON a.id = i.account WHERE i.provider = ? AND i.subject = ?', provider, subject).toArray()[0];
    if (row) {
      // the username can change in Telegram: written only when it did (no row written on an ordinary start)
      if (who && ((who.username ?? null) !== row.username || (who.name ?? null) !== row.name) && (who.username || who.name)) {
        this.sql.exec('UPDATE identity SET username = ?, name = ? WHERE provider = ? AND subject = ?', who.username ?? null, who.name ?? null, provider, subject);
      }
      return { id: row.id, created: row.created };
    }
    const acc = { id: id(12), created: Date.now() };
    this.sql.exec('INSERT INTO account (id, created) VALUES (?, ?)', acc.id, acc.created);
    this.sql.exec('INSERT INTO identity (provider, subject, account, username, name) VALUES (?, ?, ?, ?, ?)', provider, subject, acc.id, who?.username ?? null, who?.name ?? null);
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
    const rows = this.sql.exec<{ m: string; w: number; t: number; r: number; x: string | null }>('SELECT m, w, t, r, x FROM brew WHERE account = ?', acc.id).toArray() as BrewStat[];
    const s = countStats(rows, acc.created, ratings);
    const tester = this.grantsOf(acc.id).includes('tester');
    let no = tester ? TEST_NO : this.sql.exec<{ diamond_no: number | null }>('SELECT diamond_no FROM account WHERE id = ?', acc.id).one().diamond_no ?? undefined;
    if (!tester && !no && s.liters >= 1000) {
      no = (this.sql.exec<{ m: number | null }>('SELECT MAX(diamond_no) AS m FROM account').one().m ?? 0) + 1;
      this.sql.exec('UPDATE account SET diamond_no = ? WHERE id = ?', no, acc.id);
    }
    const out: AccountStats = { ...s, account: acc.id, at: Date.now(), diamondNo: no, grants: this.grantsOf(acc.id) };
    this.sql.exec('UPDATE account SET stats = ? WHERE id = ?', JSON.stringify(out), acc.id);
    return { ...out, invites: this.invitesOf(acc.id) };
  }

  /**
   * Called on every app start: answer from the stored count (the brew log is read only when brews arrive —
   * the free tier limits rows read per day). Ratings and grants are cheap and always fresh.
   */
  async me(provider: string, subject: string, who?: Who): Promise<AccountStats> {
    const acc = this.resolve(provider, subject, who);
    this.touch(acc.id);
    const ratings = await this.ratings(acc.id);
    const row = this.sql.exec<{ stats: string | null }>('SELECT stats FROM account WHERE id = ?', acc.id).one();
    if (!row.stats) return this.recount(acc, ratings);
    const cached = JSON.parse(row.stats) as AccountStats;
    const tester = this.grantsOf(acc.id).includes('tester');
    return { ...cached, ratings, at: Date.now(), grants: this.grantsOf(acc.id), invites: this.invitesOf(acc.id), diamondNo: tester ? TEST_NO : cached.diamondNo === TEST_NO ? undefined : cached.diamondNo };
  }

  /** Brews changed on a device (the first call imports the whole history) and brews deleted there */
  async addBrews(provider: string, subject: string, brews: { id: string; m: string; w: number; t: number; x?: string }[], removed: string[]): Promise<AccountStats> {
    const acc = this.resolve(provider, subject);
    const now = Date.now();
    this.touch(acc.id);
    for (const b of brews) {
      // r — when the server first saw the brew; an edit keeps it, so a date moved into the past does not count again
      this.sql.exec(`INSERT INTO brew (account, bid, m, w, t, r, x) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account, bid) DO UPDATE SET m = excluded.m, w = excluded.w, t = excluded.t, x = excluded.x`, acc.id, b.id, b.m, b.w, b.t, now, b.x || null);
    }
    for (const bid of removed) this.sql.exec('DELETE FROM brew WHERE account = ? AND bid = ?', acc.id, bid);
    return this.recount(acc, await this.ratings(acc.id));
  }

  /* ---------- metrics (owner only; counts, no one in them) ---------- */

  /** the owners' own accounts stay out of the numbers */
  private ownerAccounts(): Set<string> {
    const owners = (this.env.OWNER_IDS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!owners.length) return new Set();
    const rows = this.sql.exec<{ account: string }>(`SELECT account FROM identity WHERE provider = 'tg' AND subject IN (${owners.map(() => '?').join(',')})`, ...owners).toArray();
    return new Set(rows.map((r) => r.account));
  }

  /** the app was opened: remember the time; the first time today adds one to today's count */
  private touch(account: string) {
    if (this.ownerAccounts().has(account)) return;
    const now = Date.now(), today = dayOf(now);
    const seen = this.sql.exec<{ seen: number | null }>('SELECT seen FROM account WHERE id = ?', account).toArray()[0]?.seen;
    if (!seen || dayOf(seen) !== today) this.sql.exec('INSERT INTO active_day (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', today);
    this.sql.exec('UPDATE account SET seen = ? WHERE id = ?', now, account);
  }

  /** counters from the app: only known names, a sane amount, added to today's numbers without the sender */
  track(events: Record<string, unknown>) {
    const today = dayOf(Date.now());
    let n = 0;
    for (const ev of EVENT_NAMES) {
      const k = Math.floor(Number(events[ev]));
      if (!(k > 0)) continue;
      this.sql.exec('INSERT INTO usage_day (day, ev, n) VALUES (?, ?, ?) ON CONFLICT(day, ev) DO UPDATE SET n = n + excluded.n', today, ev, Math.min(EVENT_CAP, k));
      n++;
    }
    return n;
  }

  metrics(): Metrics {
    const now = Date.now(), D = 86_400_000;
    const skip = this.ownerAccounts();
    const out = [...skip];
    const not = out.length ? ` AND id NOT IN (${out.map(() => '?').join(',')})` : '';
    const notB = out.length ? ` AND account NOT IN (${out.map(() => '?').join(',')})` : '';
    const one = (q: string, ...a: unknown[]) => Number(this.sql.exec<{ n: number }>(q, ...a).toArray()[0]?.n ?? 0);
    // a person is someone who opened the app or has brews (an id the owner granted a background to before they came is not)
    const people = `(seen IS NOT NULL OR EXISTS (SELECT 1 FROM brew WHERE brew.account = account.id))`;
    const total = one(`SELECT COUNT(*) AS n FROM account WHERE ${people}${not}`, ...out);
    const created = (d: number) => one(`SELECT COUNT(*) AS n FROM account WHERE created >= ? AND ${people}${not}`, now - d * D, ...out);
    const seen = (d: number) => one(`SELECT COUNT(*) AS n FROM account WHERE seen >= ?${not}`, now - d * D, ...out);
    const brewing = (d: number) => one(`SELECT COUNT(DISTINCT account) AS n FROM brew WHERE t >= ? AND t <= ?${notB}`, now - d * D, now + D, ...out);
    const backOf = one(`SELECT COUNT(*) AS n FROM account WHERE created >= ? AND created < ? AND ${people}${not}`, now - 37 * D, now - 7 * D, ...out);
    const backN = one(`SELECT COUNT(*) AS n FROM account WHERE created >= ? AND created < ? AND seen >= ?${not}`, now - 37 * D, now - 7 * D, now - 7 * D, ...out);
    const brews = (d?: number) => one(`SELECT COUNT(*) AS n FROM brew WHERE t <= ?${d ? ' AND t >= ?' : ''}${notB}`, now + D, ...(d ? [now - d * D] : []), ...out);
    const ml30 = one(`SELECT COALESCE(SUM(MIN(w, 3000)), 0) AS n FROM brew WHERE t >= ? AND t <= ?${notB}`, now - 30 * D, now + D, ...out);
    const methods = this.sql.exec<{ m: string; all: number; d30: number }>(
      `SELECT m, COUNT(*) AS "all", SUM(CASE WHEN t >= ? THEN 1 ELSE 0 END) AS d30 FROM brew WHERE t <= ?${notB} GROUP BY m ORDER BY "all" DESC`, now - 30 * D, now + D, ...out,
    ).toArray().map((r) => ({ id: r.m, all: Number(r.all), d30: Number(r.d30) }));
    const from = dayOf(now - 29 * D);
    const act = new Map(this.sql.exec<{ day: string; n: number }>('SELECT day, n FROM active_day WHERE day >= ?', from).toArray().map((r) => [r.day, Number(r.n)]));
    const perDay = new Map<string, number>();
    for (const r of this.sql.exec<{ t: number }>(`SELECT t FROM brew WHERE t >= ? AND t <= ?${notB}`, now - 30 * D, now + D, ...out).toArray()) {
      const d = dayOf(r.t); perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    const days = Array.from({ length: 30 }, (_, i) => { const d = dayOf(now - (29 - i) * D); return { day: d, active: act.get(d) ?? 0, brews: perDay.get(d) ?? 0 }; });
    const features: Metrics['features'] = {};
    for (const r of this.sql.exec<{ ev: string; n: number }>('SELECT ev, SUM(n) AS n FROM usage_day WHERE day >= ? GROUP BY ev', from).toArray()) {
      if ((EVENT_NAMES as string[]).includes(r.ev)) features[r.ev as MetricEvent] = Number(r.n);
    }
    const b30 = brews(30), active30 = brewing(30);
    return {
      at: now,
      users: { total, new7: created(7), new30: created(30), seen1: seen(1), seen7: seen(7), seen30: seen(30), brewing7: brewing(7), brewing30: active30, back: { of: backOf, n: backN } },
      brews: { total: brews(), d7: brews(7), d30: b30, liters30: Math.round(ml30 / 100) / 10, perActive30: active30 ? Math.round((b30 / active30) * 10) / 10 : 0, methods },
      days, features,
      extra: {
        cards: one(`SELECT COUNT(*) AS n FROM card WHERE 1${notB}`, ...out),
        reminders30: one(`SELECT COUNT(*) AS n FROM reminder_log WHERE ts >= ?${notB}`, now - 30 * D, ...out),
        rare: one(`SELECT COUNT(DISTINCT account) AS n FROM brew WHERE x IS NOT NULL AND x != ''${notB}`, ...out),
      },
    };
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
    let theme = card.theme as { ach?: string; tier?: Tier; base?: string; special?: string; rare?: string } | undefined;
    const grants = this.grantsOf(row.account);
    const tester = grants.includes('tester');
    // a tester picks any level of any background; everyone else the level they earned or a lower one
    const testLevel = tester && theme?.ach && theme.tier ? testerLevel(theme.ach, theme.tier) : null;
    const themeLevel = testLevel ?? (theme?.ach ? levelUpTo(theme.ach === 'liters' ? LITER_LEVELS : METHOD_LEVELS, levels[theme.ach], theme.tier) : undefined);
    if (theme?.ach && !(themeLevel && givesBackground(theme.ach, themeLevel.tier))) theme = { base: 'paper' };
    if (theme?.special && !grants.includes(theme.special)) theme = { base: 'paper' };
    const rare = (cached as Stats).rare ?? [];
    if (theme?.rare && !(RARE_IDS.includes(theme.rare) && (rare.includes(theme.rare) || tester))) theme = { base: 'paper' };
    const badges = (Array.isArray(card.badges) ? card.badges : []).filter((b: { kind?: string }) => b?.kind !== 'achieve');
    const earned: Record<string, Level> = Object.fromEntries(ach.map((k) => [k, levels[k]]));
    if (theme?.ach && themeLevel) earned[theme.ach] = themeLevel;
    return {
      ...card, ach, theme: theme?.ach ? { ach: theme.ach } : theme, badges, earned,
      granted: theme?.special ? [theme.special] : theme?.rare ? [theme.rare] : [],
      no: theme?.ach === 'liters' && themeLevel?.tier === 'diamond' ? (tester ? TEST_NO : acc.diamond_no ?? undefined) : undefined,
    };
  }

  /* ---------- bot reminders (a long timer ended, the app may be closed) ---------- */

  /** schedule (or move) this person's reminder; the Telegram chat with the bot is the user id */
  async setReminder(provider: string, subject: string, at: number, title: string, link: string) {
    const acc = this.resolve(provider, subject);
    const chat = provider === 'tg' ? subject : this.tgOf(acc.id);
    if (!chat) return false;
    this.sql.exec('INSERT INTO reminder (account, chat, at, title, link) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account) DO UPDATE SET chat = excluded.chat, at = excluded.at, title = excluded.title, link = excluded.link',
      acc.id, chat, at, title, link);
    this.log(acc.id, at, 'scheduled');
    await this.nextAlarm();
    console.log('reminder scheduled', acc.id, new Date(at).toISOString());
    return true;
  }

  private log(account: string, at: number, state: string, detail: string | null = null) {
    this.sql.exec('INSERT INTO reminder_log (account, at, state, detail, ts) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account) DO UPDATE SET at = excluded.at, state = excluded.state, detail = excluded.detail, ts = excluded.ts',
      account, at, state, detail, Date.now());
  }

  /** the pending reminder and what happened to the last one */
  reminderStatus(provider: string, subject: string) {
    const row = this.sql.exec<{ account: string }>('SELECT account FROM identity WHERE provider = ? AND subject = ?', provider, subject).toArray()[0];
    if (!row) return { pending: null, last: null };
    const pending = this.sql.exec<{ at: number; title: string }>('SELECT at, title FROM reminder WHERE account = ?', row.account).toArray()[0] ?? null;
    const last = this.sql.exec<{ at: number; state: string; detail: string | null; ts: number }>('SELECT at, state, detail, ts FROM reminder_log WHERE account = ?', row.account).toArray()[0] ?? null;
    return { pending, last };
  }

  async cancelReminder(provider: string, subject: string) {
    const row = this.sql.exec<{ account: string }>('SELECT account FROM identity WHERE provider = ? AND subject = ?', provider, subject).toArray()[0];
    if (row) {
      const had = this.sql.exec<{ at: number }>('SELECT at FROM reminder WHERE account = ?', row.account).toArray()[0];
      if (had) { this.sql.exec('DELETE FROM reminder WHERE account = ?', row.account); this.log(row.account, had.at, 'cancelled'); }
    }
    await this.nextAlarm();
    return true;
  }

  private async nextAlarm() {
    const next = this.sql.exec<{ at: number | null }>('SELECT MIN(at) AS at FROM reminder').toArray()[0]?.at ?? null;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 1000));
  }

  /* ---------- testers ---------- */

  /** who this person is, for the owner's messages: note, name, @username, Telegram id; null — not a tester */
  tester(provider: string, subject: string): { account: string; tg: string; label: string } | null {
    const acc = this.resolve(provider, subject);
    if (!this.grantsOf(acc.id).includes('beta')) return null;
    const r = this.sql.exec<{ note: string | null; username: string | null; name: string | null }>(
      "SELECT a.note, i.username, i.name FROM account a LEFT JOIN identity i ON i.account = a.id AND i.provider = 'tg' WHERE a.id = ?", acc.id).toArray()[0];
    const parts = [r?.note || r?.name || 'Тестировщик', r?.username ? '@' + r.username : null, `ID ${subject}`].filter(Boolean);
    return { account: acc.id, tg: subject, label: parts.join(' · ') };
  }

  /** a report counts toward a daily cap (a stuck button must not flood the owner's chat) */
  spendReport(account: string, cap = 30): boolean {
    const day = new Date().toISOString().slice(0, 10);
    const n = this.sql.exec<{ n: number }>('SELECT n FROM feedback_day WHERE account = ? AND day = ?', account, day).toArray()[0]?.n ?? 0;
    if (n >= cap) return false;
    this.sql.exec('INSERT INTO feedback_day (account, day, n) VALUES (?, ?, 1) ON CONFLICT(account, day) DO UPDATE SET n = n + 1', account, day);
    return true;
  }

  /** the checklist; with `account` — this tester's answers; for the owner — counts and who answered */
  checks(account?: string) {
    const items = this.sql.exec<{ id: string; text: string }>('SELECT id, text FROM check_item ORDER BY ord, created').toArray();
    const results = this.sql.exec<{ item: string; account: string; state: string; note: string | null; ts: number; who: string | null }>(
      "SELECT r.item, r.account, r.state, r.note, r.ts, COALESCE(a.note, i.name, i.username) AS who FROM check_result r LEFT JOIN account a ON a.id = r.account LEFT JOIN identity i ON i.account = r.account AND i.provider = 'tg'").toArray();
    return items.map((it) => {
      const rs = results.filter((r) => r.item === it.id);
      return {
        id: it.id, text: it.text,
        ok: rs.filter((r) => r.state === 'ok').length, bug: rs.filter((r) => r.state === 'bug').length,
        mine: account ? rs.find((r) => r.account === account)?.state : undefined,
        answers: account ? undefined : rs.map((r) => ({ who: r.who ?? '—', state: r.state, note: r.note ?? undefined, ts: r.ts })),
      };
    });
  }

  /** a tester's answer on one item; returns the item text (for the owner's message) or null */
  checkAnswer(account: string, item: string, state: 'ok' | 'bug', note?: string) {
    const it = this.sql.exec<{ text: string }>('SELECT text FROM check_item WHERE id = ?', item).toArray()[0];
    if (!it) return null;
    this.sql.exec('INSERT INTO check_result (item, account, state, note, ts) VALUES (?, ?, ?, ?, ?) ON CONFLICT(item, account) DO UPDATE SET state = excluded.state, note = excluded.note, ts = excluded.ts',
      item, account, state, note ?? null, Date.now());
    return it.text;
  }

  /** keep a report; returns its id (the button in the owner's message refers to it) */
  saveReport(account: string, kind: 'bug' | 'check', text: string, context: string, photo: boolean, item?: string) {
    const rid = id(10);
    this.sql.exec('INSERT INTO report (id, account, kind, item, text, context, photo, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', rid, account, kind, item ?? null, text, context, photo ? 1 : 0, Date.now());
    return rid;
  }

  /** a report for the issue (the bug repository is private: the tester is named by the owner's note, name and @username) */
  report(rid: string) {
    const r = this.sql.exec<{ account: string; kind: string; item: string | null; text: string; context: string | null; photo: number; photo_id: string | null; ts: number; issue: string | null; note: string | null; username: string | null; name: string | null; tg: string | null }>(
      `SELECT r.account, r.kind, r.item, r.text, r.context, r.photo, r.photo_id, r.ts, r.issue, a.note, i.username, i.name, i.subject AS tg
       FROM report r LEFT JOIN account a ON a.id = r.account LEFT JOIN identity i ON i.account = r.account AND i.provider = 'tg' WHERE r.id = ?`, rid).toArray()[0];
    if (!r) return null;
    const tester = [r.note || r.name || 'Тестировщик', r.username ? `@${r.username}` : null, r.tg ? `ID ${r.tg}` : null].filter(Boolean).join(' · ');
    return { ...r, tester };
  }

  setReportPhoto(rid: string, fileId: string) { this.sql.exec('UPDATE report SET photo_id = ? WHERE id = ?', fileId, rid); }

  setReportIssue(rid: string, url: string) { this.sql.exec('UPDATE report SET issue = ? WHERE id = ?', url, rid); }

  /** owner: add an item, remove one (with its answers), or clear the list for a new version */
  editChecks(action: 'add' | 'remove' | 'clear', text?: string, id?: string) {
    if (action === 'add') {
      const t = (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!t) return false;
      const ord = (this.sql.exec<{ m: number | null }>('SELECT MAX(ord) AS m FROM check_item').one().m ?? 0) + 1;
      this.sql.exec('INSERT INTO check_item (id, text, ord, created) VALUES (?, ?, ?, ?)', crypto.randomUUID().slice(0, 8), t, ord, Date.now());
    } else if (action === 'remove') {
      this.sql.exec('DELETE FROM check_item WHERE id = ?', id ?? '');
      this.sql.exec('DELETE FROM check_result WHERE item = ?', id ?? '');
    } else {
      this.sql.exec('DELETE FROM check_item');
      this.sql.exec('DELETE FROM check_result');
    }
    return true;
  }

  async alarm() {
    const due = this.sql.exec<{ account: string; chat: string; title: string; link: string; at: number }>(
      'SELECT account, chat, title, link, at FROM reminder WHERE at <= ? ORDER BY at LIMIT 50', Date.now() + 5000).toArray();
    for (const r of due) {
      this.sql.exec('DELETE FROM reminder WHERE account = ? AND at = ?', r.account, r.at);
      const res = await sendReminder(this.env.BOT_TOKEN, r.chat, r.title, r.link);
      this.log(r.account, r.at, res.ok ? 'sent' : 'failed', res.error ?? null);
    }
    await this.nextAlarm();
  }
}

/** the bot's message with a button back into the timer */
export async function sendReminder(token: string, chat: string, title: string, link: string, text = `☕ ${title}: время вышло!\nПора процедить и записать заварку.`): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chat), text, reply_markup: { inline_keyboard: [[{ text: 'Открыть таймер', url: link }]] } }),
    });
    const j = await r.json<{ ok: boolean; description?: string }>();
    if (!j.ok) console.log('reminder not sent:', j.description);
    else console.log('reminder sent');
    return { ok: j.ok, error: j.ok ? undefined : j.description ?? `HTTP ${r.status}` };
  } catch (e) { console.log('reminder error', e); return { ok: false, error: String(e) }; }
}
