/**
 * Browse snapshot + CDN caching. catalog-sync writes one denormalized JSON row per view into catalog_meta
 * (`browse_snapshot` for extensions, `browse_themes` for themes), so a cold request is one indexed read instead of
 * catalog_entry + first_listed + catalog_meta in sequence. Browse pages are CDN-cached for anonymous visitors
 * (Netlify durable cache, tag `registry-browse`) and purged by the sync.
 */
export const SNAPSHOT_KEYS = { extensions: 'browse_snapshot', themes: 'browse_themes' } as const;
export const SNAPSHOT_VERSION = 1;
export const CACHE_TAG = 'registry-browse';
/** Fresh 5 minutes at the CDN, then served stale for up to a day while one request revalidates. */
export const CDN_CACHE = 'public, durable, s-maxage=300, stale-while-revalidate=86400';
/**
 * Home page: baked once a day. The nightly-bake workflow (.github/workflows/nightly-bake.yml, 10:00 UTC = 5:00 AM CDT /
 * 4:00 AM CST) deploys the site, which invalidates Netlify's cache; the first request after it renders the cards from the
 * database and the CDN serves that HTML until the next bake. 25 h covers a day plus slack, so the bake (not expiry) is
 * what refreshes it. Tagged separately so the catalog sync's purge of CACHE_TAG does not touch it.
 */
export const HOME_CACHE_TAG = 'registry-home';
export const HOME_CDN_CACHE = 'public, durable, s-maxage=90000, stale-while-revalidate=86400';
export const SESSION_COOKIES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

const BROWSE = [/^\/$/, /^\/extensions\/?$/, /^\/extensions\/.+/, /^\/themes\/?$/, /^\/search\/?$/, /^\/owners\/.+/];

export function isBrowsePath(pathname: string): boolean {
  return BROWSE.some((r) => r.test(pathname));
}

export function hasSession(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(';').some((c) => SESSION_COOKIES.includes(c.trim().split('=')[0]));
}

/** Headers for a browse response; null when it must not be shared-cached. */
export function browseCacheHeaders(method: string, pathname: string, status: number, cookieHeader: string | null): Record<string, string> | null {
  if (method !== 'GET' || status !== 200 || !isBrowsePath(pathname)) return null;
  const vary = { 'Netlify-Vary': `cookie=${SESSION_COOKIES.join('|')}` };
  if (hasSession(cookieHeader)) return { 'Cache-Control': 'private, no-store', ...vary };
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': pathname === '/' ? HOME_CDN_CACHE : CDN_CACHE,
    'Netlify-Cache-Tag': pathname === '/' ? HOME_CACHE_TAG : CACHE_TAG,
    ...vary,
  };
}

export function parseSnapshot<T>(raw: unknown): T | null {
  if (raw == null) return null;
  try {
    const v = JSON.parse(String(raw)) as { v?: number; data?: T };
    return v?.v === SNAPSHOT_VERSION && v.data ? v.data : null;
  } catch {
    return null;
  }
}

export function serializeSnapshot<T>(data: T): string {
  return JSON.stringify({ v: SNAPSHOT_VERSION, data });
}