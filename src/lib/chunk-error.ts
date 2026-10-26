/**
 * Stale-deploy chunk errors. After a deploy, a tab still running the previous client asks for that build's hashed
 * route chunks (e.g. /_build/assets/signin-<oldhash>.js), which no longer exist. The fix is a full page load of the
 * target URL, once per URL (a guard key stops a reload loop if the server itself is broken).
 */
const PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /'text\/html' is not a valid JavaScript MIME type/i,
  /ChunkLoadError/i,
];

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? '');
  return PATTERNS.some((p) => p.test(msg));
}

export const RELOAD_GUARD_KEY = 'registry:chunk-reload';

/** True when a hard reload of `url` should be attempted now (and records it); false if one was already tried. */
export function shouldHardReload(url: string, store: Pick<Storage, 'getItem' | 'setItem'> | null): boolean {
  if (!store) return true;
  try {
    if (store.getItem(RELOAD_GUARD_KEY) === url) return false;
    store.setItem(RELOAD_GUARD_KEY, url);
  } catch {
    /* storage blocked: still reload once */
  }
  return true;
}

/** Build-asset paths: a miss must be a real 404, never the SSR HTML (which the browser would try to run as JS). */
export function isBuildAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_build/');
}
