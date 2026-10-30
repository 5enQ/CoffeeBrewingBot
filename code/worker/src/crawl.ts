/**
 * Roaster site rules and the pure parts of the crawler: robots.txt, sitemaps, URL filters.
 * The crawl loop itself lives in the CoffeeCatalog Durable Object (catalog.ts).
 */

export interface SiteRules {
  /** URL path regexes; a page is crawled if it matches one (empty — every sitemap URL) */
  include?: string[];
  /** URL path regexes that are never crawled */
  exclude?: string[];
  /** URL path regexes of archive sections: lots there are no longer sold */
  archive?: string[];
  /** sitemaps to start from (otherwise robots.txt "Sitemap:" lines, then /sitemap.xml) */
  sitemaps?: string[];
}

export interface SeedSite extends SiteRules { host: string; roaster: string }

/** Domains approved from the start. New ones are approved by the owner in the app. */
export const SEED_SITES: SeedSite[] = [
  { host: 'kojocoffee.ru', roaster: 'Kojo', include: ['/tproduct/'], exclude: ['/catalog/merch/', 'shopper', 'znachok', 'futbolk', 'kruzhk', 'sertifikat'], archive: ['^/catalog/archiv/'] },
  { host: 'sbmrne.ru', roaster: 'Submarine', include: ['^/katalog/(kofe|drip-pakety|arhiv)/.+/$'], archive: ['^/katalog/arhiv/'] },
  { host: 'hq-coffee.com', roaster: 'HQ! coffee', sitemaps: ['https://hq-coffee.com/product-sitemap.xml'], include: ['^/[^/]+/$'],
    exclude: ['^/shop/$', 'futbolka', 'shirt', 'shopper', 'lanyard', 'karta', '^/cake/', 'test-product'] },
  { host: 'theweldercatherine.ru', roaster: 'Сварщица Екатерина', include: ['^/catalog/(dlya_filtra|dlya_espresso|kofe_v_filtr_pakete|arkhiv_kofe)/.+/$'], archive: ['^/catalog/arkhiv_kofe/'] },
  { host: 'shop.tastycoffee.ru', roaster: 'Tasty Coffee', include: ['^/coffee/[^/]+$'], exclude: ['^/coffee/capsules-'] },
];

export const normHost = (h: string) => h.toLowerCase().replace(/^www\./, '');

export function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? normHost(u.hostname) : null;
  } catch { return null; }
}

/** Canonical page URL: https, no www, no query or hash, no trailing slash duplicates */
export function canonicalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname}`;
  } catch { return null; }
}

const test = (list: string[] | undefined, path: string) => (list ?? []).some((re) => { try { return new RegExp(re, 'i').test(path); } catch { return false; } });

export function wanted(rules: SiteRules, path: string) {
  if (test(rules.exclude, path)) return false;
  return !rules.include?.length || test(rules.include, path);
}

export const isArchive = (rules: SiteRules, path: string) => test(rules.archive, path);

/* ---------- robots.txt ---------- */

export interface Robots { disallow: string[]; allow: string[]; sitemaps: string[]; delay?: number }

/** Rules of the "User-agent: *" group (or a group naming BrewbookBot) and all Sitemap lines */
export function parseRobots(txt: string): Robots {
  const out: Robots = { disallow: [], allow: [], sitemaps: [] };
  let agents: string[] = [];
  let inRules = false;
  let mine = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'sitemap') { if (val) out.sitemaps.push(val); continue; }
    if (key === 'user-agent') {
      if (inRules) { agents = []; inRules = false; }
      agents.push(val.toLowerCase());
      mine = agents.includes('*') || agents.some((a) => a.includes('brewbook'));
      continue;
    }
    inRules = true;
    if (!mine) continue;
    if (key === 'disallow' && val) out.disallow.push(val);
    if (key === 'allow' && val) out.allow.push(val);
    if (key === 'crawl-delay' && !isNaN(Number(val))) out.delay = Number(val);
  }
  out.sitemaps = [...new Set(out.sitemaps)];
  return out;
}

const robotsRe = (rule: string) => new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));

/** Longest matching rule wins; Allow wins a tie (Google's interpretation) */
export function robotsAllows(r: Robots | null | undefined, pathAndQuery: string) {
  if (!r) return true;
  let best = -1, allowed = true;
  for (const [list, ok] of [[r.disallow, false], [r.allow, true]] as const) {
    for (const rule of list) {
      if (rule.length >= best && robotsRe(rule).test(pathAndQuery) && (rule.length > best || ok)) { best = rule.length; allowed = ok; }
    }
  }
  return allowed;
}

/* ---------- sitemaps ---------- */

export interface SitemapEntry { loc: string; lastmod?: string }

/** Sitemap or sitemap index → entries. Regex only: sitemaps can be megabytes, no XML parser needed. */
export function parseSitemap(xml: string): { index: boolean; entries: SitemapEntry[] } {
  const index = /<sitemapindex[\s>]/i.test(xml);
  const entries: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)) {
    const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1];
    entries.push({ loc: loc.replace(/&amp;/g, '&'), lastmod });
  }
  return { index, entries };
}

/** A parsed page is worth a catalog lot: at least two facts about the coffee */
export function usefulCount(c: Record<string, unknown>) {
  return ['country', 'region', 'variety', 'process', 'altitude', 'packNotes', 'farm'].filter((k) => c[k]).length;
}
