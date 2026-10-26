import { createMiddleware } from '@solidjs/start/middleware';
import { browseCacheHeaders } from '~/lib/browse-cache';
import { isBuildAssetPath } from '~/lib/chunk-error';

/** CDN caching for anonymous browse pages (see src/lib/browse-cache.ts). */
export default createMiddleware({
  /** A missing build asset (stale hash after a deploy) is a 404, not the SSR HTML page. */
  onRequest: (event) => {
    if (isBuildAssetPath(new URL(event.request.url).pathname)) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
    }
  },
  onBeforeResponse: (event) => {
    const req = event.request;
    const url = new URL(req.url);
    const status = event.response.status ?? 200;
    const h = browseCacheHeaders(req.method, url.pathname, status, req.headers.get('cookie'));
    if (h) for (const [k, v] of Object.entries(h)) event.response.headers.set(k, v);
  },
});