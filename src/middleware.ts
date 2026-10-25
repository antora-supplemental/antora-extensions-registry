import { createMiddleware } from '@solidjs/start/middleware';
import { browseCacheHeaders } from '~/lib/browse-cache';

/** CDN caching for anonymous browse pages (see src/lib/browse-cache.ts). */
export default createMiddleware({
  onBeforeResponse: (event) => {
    const req = event.request;
    const url = new URL(req.url);
    const status = event.response.status ?? 200;
    const h = browseCacheHeaders(req.method, url.pathname, status, req.headers.get('cookie'));
    if (h) for (const [k, v] of Object.entries(h)) event.response.headers.set(k, v);
  },
});