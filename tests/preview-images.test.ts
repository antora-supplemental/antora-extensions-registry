import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readmeImages } from '../src/lib/catalog-enrich';
import { liveImages, pruneDeadPreviews, type FetchLike } from '../src/lib/preview-check';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const RAW = 'https://raw.githubusercontent.com';

test('relative images use the branch passed in (master default branch)', () => {
  const md = '# Demo\n\n![Shot](docs/shot.png)\n';
  assert.deepEqual(readmeImages('lask79', 'demo', 'master', md).map((p) => p.url), [`${RAW}/lask79/demo/master/docs/shot.png`]);
});

test('AsciiDoc image:: targets resolve against :imagesdir:', () => {
  const adoc = '= Demo\n:imagesdir: docs/modules/ROOT/images\n\nIntro.\n\nimage::full-feature.png[Full feature]\n';
  const [p] = readmeImages('lask79', 'antora-shiki-extension', 'master', adoc, true);
  assert.equal(p.url, `${RAW}/lask79/antora-shiki-extension/master/docs/modules/ROOT/images/full-feature.png`);
  assert.equal(p.caption, 'Full feature');
});

test(':imagesdir: is ignored for Markdown and for absolute targets', () => {
  const adoc = ':imagesdir: img\n\nimage::https://example.org/a.png[A]\n';
  assert.equal(readmeImages('o', 'r', 'main', adoc, true)[0].url, 'https://example.org/a.png');
});

test('Markdown relative paths resolve against a subfolder README directory', () => {
  const md = '![One](images/one.png)\n<img src="../shared/two.png" alt="Two">\n![Three](./three.png)\n';
  assert.deepEqual(readmeImages('o', 'r', 'main', md, false, 'packages/ext').map((p) => p.url).sort(), [
    `${RAW}/o/r/main/packages/ext/images/one.png`,
    `${RAW}/o/r/main/packages/ext/three.png`,
    `${RAW}/o/r/main/packages/shared/two.png`,
  ]);
});

test('absolute URLs are kept as-is', () => {
  const md = '![Hosted](https://cdn.example.org/shot.png)\n';
  assert.equal(readmeImages('o', 'r', 'main', md, false, 'sub')[0].url, 'https://cdn.example.org/shot.png');
});

const fakeFetch: FetchLike = async (url) => {
  if (url.endsWith('missing.png')) return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } });
  if (url.endsWith('page.png')) return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } });
  return new Response(null, { status: 200, headers: { 'content-type': 'image/png' } });
};

test('a 404 image (or a non-image 200) is dropped', async () => {
  const kept = await liveImages([{ url: 'https://x/ok.png', source: 'readme' as const }, { url: 'https://x/missing.png', source: 'readme' as const }, { url: 'https://x/page.png', source: 'readme' as const }], Infinity, fakeFetch);
  assert.deepEqual(kept.map((p) => p.url), ['https://x/ok.png']);
});

test('pruneDeadPreviews removes the field when no preview survives', async () => {
  const entries = [
    { catalogId: 'a', previews: [{ url: 'https://x/missing.png' }] },
    { catalogId: 'b', previews: [{ url: 'https://x/ok.png' }, { url: 'https://x/missing.png' }] },
  ] as unknown as ExtensionCatalogEntry[];
  const report = await pruneDeadPreviews(entries, 2, fakeFetch);
  assert.equal(entries[0].previews, undefined);
  assert.deepEqual(entries[1].previews?.map((p) => p.url), ['https://x/ok.png']);
  assert.deepEqual(report.affected.sort(), ['a', 'b']);
  assert.equal(report.checkedUrls, 3);
});
