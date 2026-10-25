import { client } from '~/server/db';

/** Cached preview images (see src/lib/preview-cache.ts). Content-addressed, so cacheable forever. */
export async function GET(event: { request: Request; params?: { hash?: string } }) {
  // Read the hash from the URL as well: params are not always populated on the Netlify function.
  const fromUrl = new URL(event.request.url).pathname.split('/').pop() ?? '';
  const hash = String(event.params?.hash || fromUrl).replace(/\.[a-z]+$/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return new Response('Not found', { status: 404 });
  try {
    const r = await client.execute({ sql: 'SELECT contentType, bytes FROM preview_blob WHERE hash = ?', args: [hash] });
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
    return new Response('Preview cache unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}