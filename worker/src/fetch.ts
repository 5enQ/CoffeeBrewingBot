/** Outgoing requests to roaster sites: size and time limits, charset handling, a test proxy for local runs */

export const USER_AGENT = 'Mozilla/5.0 (compatible; BrewbookBot/1.0; +https://5enq.github.io/CoffeeBrewingBot/)';

/** Local tests only: CRAWL_PROXY="http://127.0.0.1:8800/" turns https://host/path into http://127.0.0.1:8800/host/path */
let proxy = '';
export const setCrawlProxy = (p?: string) => { proxy = p ?? ''; };
const target = (u: URL) => (proxy ? `${proxy}${u.hostname}${u.pathname}${u.search}` : u.toString());

export interface Fetched { status: number; text: string; url: string; type: string }

/** GET with limits. null — network error, timeout or a non-http(s) address. */
export async function fetchText(raw: string, { maxBytes = 3_000_000, timeoutMs = 8000, accept = 'text/html' } = {}): Promise<Fetched | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(target(u), {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru,en;q=0.8', Accept: accept },
    });
    const type = r.headers.get('content-type') ?? '';
    const reader = r.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (size + value.length > maxBytes) { chunks.push(value.subarray(0, maxBytes - size)); size = maxBytes; reader.cancel(); break; }
        chunks.push(value); size += value.length;
      }
    }
    const buf = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8';
    let text: string;
    try { text = new TextDecoder(charset).decode(buf); } catch { text = new TextDecoder().decode(buf); }
    // with the test proxy the final URL is the proxy's; report the original one
    return { status: r.status, text, url: proxy ? u.toString() : r.url || u.toString(), type };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** A roaster page as HTML, or null when it is missing or not HTML */
export async function fetchPage(raw: string): Promise<{ html: string; url: string } | null> {
  const r = await fetchText(raw);
  if (!r || r.status < 200 || r.status >= 300 || !r.type.includes('html')) return null;
  return { html: r.text, url: r.url };
}
