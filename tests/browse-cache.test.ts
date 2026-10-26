import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browseCacheHeaders, CACHE_TAG, HOME_CACHE_TAG, parseSnapshot, serializeSnapshot } from '../src/lib/browse-cache';
import { SEARCH_CATEGORIES } from '../src/lib/search-categories';

test('anonymous browse pages are CDN-cached and tagged', () => {
  const h = browseCacheHeaders('GET', '/extensions', 200, null)!;
  assert.match(h['Netlify-CDN-Cache-Control'], /s-maxage=\d+, stale-while-revalidate=\d+/);
  assert.equal(h['Netlify-Cache-Tag'], CACHE_TAG);
  assert.ok(browseCacheHeaders('GET', '/themes', 200, 'x=1'));
});

test('home page is baked daily under its own tag (not purged by the catalog sync)', () => {
  const h = browseCacheHeaders('GET', '/', 200, null)!;
  assert.equal(h['Netlify-Cache-Tag'], HOME_CACHE_TAG);
  assert.notEqual(HOME_CACHE_TAG, CACHE_TAG);
  const maxAge = Number(/s-maxage=(\d+)/.exec(h['Netlify-CDN-Cache-Control'])![1]);
  assert.ok(maxAge >= 86400, 'home cache must outlive the nightly bake interval');
});

test('signed-in, non-GET, errors and other routes are never shared-cached', () => {
  assert.equal(browseCacheHeaders('GET', '/extensions', 200, '__Secure-better-auth.session_token=abc')!['Cache-Control'], 'private, no-store');
  assert.equal(browseCacheHeaders('POST', '/extensions', 200, null), null);
  assert.equal(browseCacheHeaders('GET', '/extensions', 500, null), null);
  assert.equal(browseCacheHeaders('GET', '/admin', 200, null), null);
  assert.equal(browseCacheHeaders('GET', '/api/extensions/catalog', 200, null), null);
});

test('snapshot round-trips and rejects other versions', () => {
  assert.deepEqual(parseSnapshot(serializeSnapshot({ a: 1 })), { a: 1 });
  assert.equal(parseSnapshot('{"v":0,"data":{}}'), null);
  assert.equal(parseSnapshot('nope'), null);
});

test('search dropdown has no redundant "All extensions" (catalog has no AsciiDoc-only packages)', () => {
  assert.ok(!SEARCH_CATEGORIES.some((c) => c.label === 'All extensions'));
  assert.ok(SEARCH_CATEGORIES.some((c) => c.label === 'Antora extensions'));
});