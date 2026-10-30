import { SEED_SITES, canonicalUrl, hostOf, isArchive, parseRobots, parseSitemap, robotsAllows, usefulCount, wanted } from './worker/src/crawl.ts';
import { parsePage } from './worker/src/parse.ts';
const UA = 'Mozilla/5.0 (compatible; BrewbookBot/1.0; +https://5enq.github.io/CoffeeBrewingBot/)';
const get = async (u: string) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); return { status: r.status, text: await r.text() }; };
const out: Record<string, unknown> = {};
for (const s of SEED_SITES) {
  const rep: Record<string, unknown> = {};
  try {
    const rb = await get(`https://${s.host}/robots.txt`);
    const robots = parseRobots(rb.text);
    const queue = s.sitemaps?.length ? [...s.sitemaps] : robots.sitemaps.filter((u) => hostOf(u) === s.host);
    if (!queue.length) queue.push(`https://${s.host}/sitemap.xml`);
    const seen = new Set<string>(); const urls = new Set<string>(); let maps = 0; let total = 0;
    while (queue.length && maps < 40) {
      const m = queue.shift()!; if (seen.has(m)) continue; seen.add(m); maps++;
      const r = await get(m); if (r.status !== 200) continue;
      const p = parseSitemap(r.text);
      if (p.index) { for (const e of p.entries) if (hostOf(e.loc) === s.host) queue.push(e.loc); continue; }
      for (const e of p.entries) { total++; if (hostOf(e.loc) !== s.host) continue; const u = new URL(e.loc); if (wanted(s, u.pathname) && robotsAllows(robots, u.pathname + u.search)) urls.add(canonicalUrl(e.loc)!); }
    }
    const list = [...urls];
    rep.sitemaps = maps; rep.entries = total; rep.wanted = list.length;
    rep.archive = list.filter((u) => isArchive(s, new URL(u).pathname)).length;
    const sample = list.filter((_, i) => i % Math.max(1, Math.floor(list.length / 6)) === 0).slice(0, 6);
    rep.pages = [];
    for (const u of sample) {
      const t = performance.now(); const r = await get(u); const p = parsePage(r.text, u);
      (rep.pages as unknown[]).push({ u, status: r.status, ms: Math.round(performance.now() - t), useful: usefulCount(p as Record<string, unknown>), p: { ...p, image: undefined } });
      await new Promise((res) => setTimeout(res, 1500));
    }
  } catch (e) { rep.error = String(e); }
  out[s.host] = rep;
  console.log(s.host, JSON.stringify({ ...rep, pages: undefined }));
}
await import('node:fs').then((fs) => fs.writeFileSync('out/dry.json', JSON.stringify(out, null, 1)));
