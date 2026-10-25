import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryPreviewStore, syncPreviewCache, MAX_PREVIEW_BYTES } from '../src/lib/preview-cache';
import type { ExtensionCatalogEntry, PreviewImage } from '../src/types/ui-module';

const URL_A = 'https://raw.githubusercontent.com/o/r/main/shot.png';
const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, n]);

type Reply = { status: number; type?: string; body?: Uint8Array };
const fakeFetch = (routes: Record<string, Reply>) => async (url: string) => {
  const r = routes[url] ?? { status: 404, type: 'text/html' };
  return new Response((r.body ?? new Uint8Array()) as unknown as BodyInit, { status: r.status, headers: r.type ? { 'content-type': r.type } : {} });
};
const entry = (previews: PreviewImage[]) => ({ catalogId: 'o/r/pkg', previews }) as unknown as ExtensionCatalogEntry;
const readme = (url = URL_A): PreviewImage => ({ url, source: 'readme' });

test('a first-fetch 404 (or non-image) is never cached and not shown', async () => {
  const store = memoryPreviewStore();
  const e = entry([readme(), readme('https://x/y.html')]);
  const r = await syncPreviewCache([e], store, fakeFetch({ 'https://x/y.html': { status: 200, type: 'text/html' } }));
  assert.equal(store.rows.length, 0);
  assert.equal(store.blobs.size, 0);
  assert.equal(e.previews, undefined);
  assert.equal(r.dropped.length, 2);
});

test('a valid image is cached and served from /previews/<hash>', async () => {
  const store = memoryPreviewStore();
  const e = entry([readme()]);
  await syncPreviewCache([e], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: png(1) } }));
  assert.equal(store.rows.length, 1);
  assert.match(e.previews![0].url, /^\/previews\/[0-9a-f]{64}$/);
  assert.equal(e.previews![0].sourceUrl, URL_A);
});

test('a cached image survives a later 404, marked stale', async () => {
  const store = memoryPreviewStore();
  await syncPreviewCache([entry([readme()])], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: png(1) } }));
  const hash = store.rows[0].hash;
  const e = entry([readme()]);
  await syncPreviewCache([e], store, fakeFetch({}));
  assert.equal(e.previews![0].url, `/previews/${hash}`);
  assert.equal(e.previews![0].stale, true);
  assert.equal(store.rows[0].stale, true);
  assert.ok(store.blobs.has(hash));
});

test('a cached image survives being dropped from the README', async () => {
  const store = memoryPreviewStore();
  await syncPreviewCache([entry([{ ...readme(), caption: 'Dark mode' }])], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: png(1) } }));
  const e = entry([]);
  await syncPreviewCache([e], store, fakeFetch({}));
  assert.equal(e.previews!.length, 1);
  assert.equal(e.previews![0].sourceUrl, URL_A);
  assert.equal(e.previews![0].caption, 'Dark mode');
  assert.equal(e.previews![0].stale, true);
});

test('a changed image refreshes the cache', async () => {
  const store = memoryPreviewStore();
  await syncPreviewCache([entry([readme()])], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: png(1) } }));
  const oldHash = store.rows[0].hash;
  const e = entry([readme()]);
  const r = await syncPreviewCache([e], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: png(2) } }));
  assert.equal(r.refreshed, 1);
  assert.notEqual(store.rows[0].hash, oldHash);
  assert.equal(e.previews![0].url, `/previews/${store.rows[0].hash}`);
  assert.equal(store.rows[0].stale, false);
  assert.ok(!store.blobs.has(oldHash), 'old blob purged');
});

test('images over the size cap are not cached; uploads are left alone', async () => {
  const store = memoryPreviewStore();
  const upload: PreviewImage = { url: 'https://cdn/x.png', source: 'upload' };
  const e = entry([readme(), upload]);
  await syncPreviewCache([e], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: new Uint8Array(MAX_PREVIEW_BYTES + 1) } }));
  assert.equal(store.rows.length, 0);
  assert.deepEqual(e.previews, [upload]);
});

test('packages removed from the catalog are purged with their images', async () => {
  const store = memoryPreviewStore();
  await syncPreviewCache([entry([readme()])], store, fakeFetch({ [URL_A]: { status: 200, type: 'image/png', body: png(1) } }));
  const other = { catalogId: 'o/other/x' } as unknown as ExtensionCatalogEntry;
  const r = await syncPreviewCache([other], store, fakeFetch({}));
  assert.equal(r.purged, 1);
  assert.equal(store.blobs.size, 0);
});