import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobBytes, previewHash, safeErrorTag, servePreview } from '../src/lib/preview-route';

const H = 'a'.repeat(64);
const url = `https://x/previews/${H}`;

test('blob values from every libsql client shape become bytes', () => {
  const want = [1, 2, 3];
  assert.deepEqual([...blobBytes(new Uint8Array(want).buffer)!], want);
  assert.deepEqual([...blobBytes(new Uint8Array(want))!], want);
  assert.deepEqual([...blobBytes(Buffer.from(want))!], want);
  assert.deepEqual([...blobBytes(want)!], want);
  assert.deepEqual([...blobBytes('AQID')!], want);
  assert.deepEqual([...blobBytes({ base64: 'AQID' })!], want);
  assert.equal(blobBytes(null), null);
});

test('hash from params or URL path', () => {
  assert.equal(previewHash(url), H);
  assert.equal(previewHash('https://x/previews/', H), H);
  assert.equal(previewHash('https://x/previews/nope'), null);
});

test('serves 200 image/* from an ArrayBuffer row', async () => {
  const res = await servePreview(url, undefined, async () => ({ rows: [{ contentType: 'image/png', bytes: new Uint8Array([137, 80]).buffer }] }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal((await res.arrayBuffer()).byteLength, 2);
});

test('missing row is 404; DB error is 503 with a header-safe tag', async () => {
  assert.equal((await servePreview(url, undefined, async () => ({ rows: [] }))).status, 404);
  const res = await servePreview(url, undefined, async () => { throw Object.assign(new Error('fail at libsql://secret-db.turso.io token eyJhbGciOiJIUzI1NiJ9abcdefghijkl\n'), { code: 'X' }); });
  assert.equal(res.status, 503);
  const tag = res.headers.get('x-preview-error')!;
  assert.ok(!/turso|eyJ/.test(tag));
  assert.equal(safeErrorTag('weird'), 'unknown');
});