import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStack, decodeStack, encodeStack, stackPlaybook, DEFAULT_UI_BUNDLE } from '../src/lib/stack';

const E = (o: Record<string, unknown>) => ({ type: 'ui-module', name: o.id, version: '1.0.0', description: '', tags: [], requires: [], recommends: [], repository: 'https://github.com/o/r', repositoryOwner: 'o', repositoryName: 'r', ...o }) as any;

test('share value round-trips and dedupes', () => {
  const ids = ['o/r/a', 'o/r/b c', 'o/r/a'];
  assert.deepEqual(decodeStack(encodeStack(ids)), ['o/r/a', 'o/r/b c']);
  assert.deepEqual(decodeStack(''), []);
});

test('pairwise conflicts are reported once', () => {
  const a = E({ catalogId: 'o/r/a', id: 'a', compat: [{ target: 'o/r/b', targetName: 'b', indexed: true, relation: 'conflicts', confidence: 'declared', why: 'both paint the toolbar' }] });
  const b = E({ catalogId: 'o/r/b', id: 'b', compat: [{ target: 'o/r/a', targetName: 'a', indexed: true, relation: 'conflicts', confidence: 'declared', why: '' }] });
  const r = analyzeStack([a, b], [a, b]);
  assert.equal(r.issues.filter((i) => i.kind === 'conflict').length, 1);
});

test('missing requires suggest the indexed entry, and disappear once added', () => {
  const bus = E({ catalogId: 'o/r/ui-bus', id: 'ui-bus' });
  const a = E({ catalogId: 'o/r/a', id: 'a', requires: ['ui-bus'] });
  const r = analyzeStack([a], [a, bus]);
  assert.equal(r.issues[0].kind, 'missing');
  assert.equal(r.issues[0].suggest?.catalogId, 'o/r/ui-bus');
  assert.equal(analyzeStack([a, bus], [a, bus]).issues.length, 0);
});

test('no shared Antora line is flagged', () => {
  const a = E({ catalogId: 'o/r/a', id: 'a', antora: [3] });
  const b = E({ catalogId: 'o/r/b', id: 'b', antora: [4] });
  const r = analyzeStack([a, b], [a, b]);
  assert.deepEqual(r.antora, []);
  assert.equal(r.issues[0].kind, 'antora');
  assert.deepEqual(analyzeStack([a, E({ catalogId: 'o/r/c', id: 'c', antora: [3, 4] })], []).antora, [3]);
});

test('playbook lists extensions and orchestrator modules', () => {
  const ext = E({ catalogId: 'o/r/x', id: 'x', type: 'antora-extension', name: 'x', packageName: '@o/x' });
  const mod = E({ catalogId: 'o/r/m', id: 'light-dark-mode' });
  const y = stackPlaybook([ext, mod]);
  assert.match(y, new RegExp(`url: ${DEFAULT_UI_BUNDLE.replace(/[?.]/g, '\\$&')}`));
  assert.match(y, /- require: '@o\/x'/);
  assert.match(y, /modules:\n {8}- light-dark-mode/);
});

test('a ui-bundle pick supplies ui.bundle.url from its release zip', () => {
  const b = E({ catalogId: 'o/r/ui', id: 'ui', type: 'ui-bundle', releases: [{ antora: [], assets: [{ name: 'ui-bundle.zip', url: 'https://x/ui-bundle.zip' }] }] });
  assert.match(stackPlaybook([b]), /url: https:\/\/x\/ui-bundle\.zip/);
});
