/** Serving /previews/<hash> (route file stays a thin GET wrapper; this module is unit-tested). */
export type PreviewExec = (sql: string, args: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

/** Normalizes the BLOB value shapes libsql clients return (ArrayBuffer, typed views, Node Buffer, base64). */
export function blobBytes(v: unknown): Uint8Array | null {
  if (v == null) return null;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (typeof v === 'object' && Object.prototype.toString.call(v) === '[object ArrayBuffer]') return new Uint8Array(v as ArrayBuffer);
  if (Array.isArray(v) && v.every((n) => typeof n === 'number')) return Uint8Array.from(v);
  if (typeof v === 'object' && v && 'base64' in v) v = (v as { base64: string }).base64;
  if (typeof v === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(v)) return Uint8Array.from(atob(v.replace(/\s/g, '')), (c) => c.charCodeAt(0));
  return null;
}

export function previewHash(url: string, param?: string): string | null {
  const fromUrl = new URL(url).pathname.split('/').pop() ?? '';
  const hash = String(param || fromUrl).replace(/\.[a-z]+$/i, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(hash) ? hash : null;
}

/** Error class/code plus a short message with URL- or token-like text removed; header-safe ASCII only. */
export function safeErrorTag(err: unknown): string {
  const e = err as { name?: string; code?: string; message?: string };
  const msg = String(e?.message ?? '')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, 'URL')
    .replace(/[A-Za-z0-9_\-.]{24,}/g, 'REDACTED')
    .replace(/[^A-Za-z0-9 :.,'()_-]/g, ' ')
    .slice(0, 160);
  return [e?.name, e?.code, msg].filter(Boolean).map(String).join(' / ').replace(/[^\x20-\x7e]/g, ' ') || 'unknown';
}

const IMAGE = /^image\/[a-z0-9.+-]+$/i;

export async function servePreview(url: string, param: string | undefined, exec: PreviewExec | null): Promise<Response> {
  const hash = previewHash(url, param);
  if (!hash) return new Response('Not found', { status: 404 });
  try {
    if (!exec) throw new Error('catalog database not configured');
    const row = (await exec('SELECT contentType, bytes FROM preview_blob WHERE hash = ?', [hash])).rows[0];
    if (!row) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const bytes = blobBytes(row.bytes);
    if (!bytes) throw new TypeError(`unexpected blob value ${Object.prototype.toString.call(row.bytes)}`);
    const type = String(row.contentType ?? '');
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': IMAGE.test(type) ? type : 'application/octet-stream',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    console.error('Preview cache read failed:', safeErrorTag(err));
    return new Response('Preview cache unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Preview-Error': safeErrorTag(err) } });
  }
}