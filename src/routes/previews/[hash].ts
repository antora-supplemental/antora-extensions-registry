import { servePreview } from '~/lib/preview-route';

/** Cached preview images and avatars (see src/lib/preview-cache.ts). Content-addressed, so cacheable forever. */
export async function GET(event: { request: Request; params?: { hash?: string } }) {
  try {
    const { catalogDbConfigured, getClient } = await import('~/lib/catalog-db');
    const exec = catalogDbConfigured()
      ? async (sql: string, args: unknown[]) => (await getClient().execute({ sql, args: args as never })) as unknown as { rows: Array<Record<string, unknown>> }
      : null;
    return await servePreview(event.request.url, event.params?.hash, exec);
  } catch (err) {
    const { safeErrorTag } = await import('~/lib/preview-route');
    return new Response('Preview cache unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Preview-Error': safeErrorTag(err) } });
  }
}