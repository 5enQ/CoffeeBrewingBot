/** Общие помощники для упаковки данных: base64url и deflate через встроенные потоки браузера */

export const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Строка → «z» + base64url(deflate) или «j» + base64url(utf-8), если сжатие недоступно */
export async function packText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try { return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch { /* ниже */ }
  }
  return 'j' + b64url(bytes);
}

export async function unpackText(s: string): Promise<string> {
  let bytes = fromB64url(s.slice(1));
  if (s[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(bytes);
}

/** Быстрый хеш FNV-1a — чтобы понять, изменилась ли корзина, не сравнивая её целиком */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + s.length.toString(36);
}
