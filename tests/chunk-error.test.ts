import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBuildAssetPath, isChunkLoadError, RELOAD_GUARD_KEY, shouldHardReload } from '../src/lib/chunk-error';

test('stale-deploy chunk failures are recognised across browsers', () => {
  assert.ok(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/_build/assets/signin-FB5kkxTT.js')));
  assert.ok(isChunkLoadError(new TypeError('error loading dynamically imported module')));
  assert.ok(isChunkLoadError(new TypeError('Importing a module script failed.')));
  assert.ok(!isChunkLoadError(new Error('Cannot read properties of undefined')));
});

test('hard reload happens once per URL', () => {
  const m = new Map<string, string>();
  const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  assert.equal(shouldHardReload('https://x/auth/signin', store), true);
  assert.equal(m.get(RELOAD_GUARD_KEY), 'https://x/auth/signin');
  assert.equal(shouldHardReload('https://x/auth/signin', store), false);
  assert.equal(shouldHardReload('https://x/themes', store), true);
});

test('missing build assets are 404 paths, not SSR pages', () => {
  assert.ok(isBuildAssetPath('/_build/assets/signin-FB5kkxTT.js'));
  assert.ok(!isBuildAssetPath('/auth/signin'));
});
