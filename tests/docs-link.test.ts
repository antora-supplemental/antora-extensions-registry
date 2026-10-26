import test from 'node:test';
import assert from 'node:assert/strict';
import { pickDocsLink } from '../src/lib/docs-link';

const repository = 'https://github.com/acme/thing';

test('declared docs wins', () => {
  assert.deepEqual(pickDocsLink({ repository, docs: 'https://acme.dev/thing', homepage: 'https://x.dev' }), { url: 'https://acme.dev/thing', source: 'declared' });
});
test('homepage that is the repo (or its README) is skipped', () => {
  assert.equal(pickDocsLink({ repository, homepage: 'https://github.com/acme/thing#readme' }), undefined);
  assert.equal(pickDocsLink({ repository, homepage: 'https://github.com/acme/thing/tree/main/packages/a' }), undefined);
  assert.deepEqual(pickDocsLink({ repository, homepage: 'https://github.com/acme/thing#readme', repoHomepage: 'https://acme.github.io/thing/' }), { url: 'https://acme.github.io/thing/', source: 'repo-about' });
});
test('homepage beats repo About URL; docs site is last', () => {
  assert.equal(pickDocsLink({ repository, homepage: 'https://h.dev', repoHomepage: 'https://a.dev' })?.source, 'homepage');
  assert.equal(pickDocsLink({ repository, docsSite: 'https://docs.acme.dev' })?.source, 'docs-site');
});
test('non-http values are ignored', () => {
  assert.equal(pickDocsLink({ repository, docs: 'docs/index.adoc' }), undefined);
});
