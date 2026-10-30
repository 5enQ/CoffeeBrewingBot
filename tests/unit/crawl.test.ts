import { describe, expect, it } from 'vitest';
import { SEED_SITES, canonicalUrl, isArchive, parseRobots, parseSitemap, robotsAllows, wanted } from '../../worker/src/crawl';

const site = (host: string) => SEED_SITES.find((s) => s.host === host)!;

describe('robots.txt', () => {
  const r = parseRobots(`User-agent: Yandex\nDisallow: /\n\nUser-agent: *\nDisallow: /ajax\nDisallow: /*?filter=\nAllow: /ajax/public\nCrawl-delay: 2\nSitemap: https://a.ru/sitemap.xml\n`);
  it('uses the * group and collects sitemaps', () => {
    expect(r.sitemaps).toEqual(['https://a.ru/sitemap.xml']);
    expect(r.delay).toBe(2);
  });
  it('applies the longest matching rule', () => {
    expect(robotsAllows(r, '/coffee/kenya')).toBe(true);
    expect(robotsAllows(r, '/ajax/cart')).toBe(false);
    expect(robotsAllows(r, '/ajax/public/x')).toBe(true);
    expect(robotsAllows(r, '/coffee?filter=1')).toBe(false);
  });
  it('an empty Disallow allows everything', () => {
    expect(robotsAllows(parseRobots('User-Agent: *\nDisallow:\n'), '/any')).toBe(true);
  });
});

describe('sitemaps', () => {
  it('reads url sets and indexes', () => {
    const set = parseSitemap('<urlset><url><loc>https://a.ru/x?a=1&amp;b=2</loc><lastmod>2026-10-01</lastmod></url><url><loc>https://a.ru/y</loc></url></urlset>');
    expect(set).toEqual({ index: false, entries: [{ loc: 'https://a.ru/x?a=1&b=2', lastmod: '2026-10-01' }, { loc: 'https://a.ru/y', lastmod: undefined }] });
    expect(parseSitemap('<sitemapindex><sitemap><loc>https://a.ru/s1.xml</loc></sitemap></sitemapindex>').index).toBe(true);
  });
  it('canonical URLs drop the query', () => {
    expect(canonicalUrl('https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas?back=%2Fcoffee')).toBe('https://shop.tastycoffee.ru/coffee/braziliya-sul-de-minas');
  });
});

describe('site rules', () => {
  it('Tasty Coffee: coffee pages, no capsules or accessories', () => {
    const s = site('shop.tastycoffee.ru');
    expect(wanted(s, '/coffee/braziliya-sul-de-minas')).toBe(true);
    expect(wanted(s, '/coffee/capsules-brazil-paraiso')).toBe(false);
    expect(wanted(s, '/accessories/kettle')).toBe(false);
  });
  it('archive sections are marked', () => {
    expect(isArchive(site('theweldercatherine.ru'), '/catalog/arkhiv_kofe/boliviya/')).toBe(true);
    expect(isArchive(site('theweldercatherine.ru'), '/catalog/dlya_filtra/boliviya/')).toBe(false);
    expect(wanted(site('kojocoffee.ru'), '/catalog/merch/tproduct/1-2-znachok')).toBe(false);
    expect(wanted(site('hq-coffee.com'), '/varenaya-futbolka/')).toBe(false);
    expect(wanted(site('hq-coffee.com'), '/kenya-kii-drip/')).toBe(true);
  });
});
