import { catalogDbConfigured, getClient } from '~/lib/catalog-db';

/** Cached preview images (see src/lib/preview-cache.ts). Content-addressed, so cacheable forever. */
export async function GET(event: { request: Request; params?: { hash?: string } }) {
  // Read the hash from the URL as well: params are not always populated on the Netlify function.
  const fromUrl = new URL(event.request.url).pathname.split('/').pop() ?? '';
  const hash = String(event.params?.hash || fromUrl).replace(/\.[a-z]+$/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return new Response('Not found', { status: 404 });
  try {
    if (!catalogDbConfigured()) throw new Error('catalog database not configured');
    const r = await getClient().execute({ sql: 'SELECT contentType, bytes FROM preview_blob WHERE hash = ?', args: [hash] });
    const row = r.rows[0];
    if (!row) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const bytes = row.bytes as ArrayBuffer | Uint8Array;
    return new Response(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': String(row.contentType),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    console.error('Preview cache read failed:', err);
    return new Response('Preview cache unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Preview-Error': safeErrorTag(err) } });
  }
}
/** Error class/code plus a short message with anything URL- or token-like removed (safe to expose for debugging). */
export function safeErrorTag(err: unknown): string {
  const e = err as { name?: string; code?: string; message?: string };
  const msg = String(e?.message ?? '')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
    .replace(/[A-Za-z0-9_\-.]{24,}/g, '<redacted>')
    .replace(/[^\w <>:.,'()-]/g, ' ')
    .slice(0, 160);
  return [e?.name, e?.code, msg].filter(Boolean).join(' | ') || 'unknown';
}