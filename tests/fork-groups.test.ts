import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseForks, forkAllowed, forkGroupKey, forkInfoFrom, forkVariants, publishedName } from '../src/lib/fork-groups';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const e = (owner: string, o: Partial<ExtensionCatalogEntry> = {}) =>
  ({ id: 'lunr-extension', name: '@antora/lunr-extension', catalogId: `${owner}/antora-lunr-extension/lunr-extension`, repositoryOwner: owner,
     repositoryName: 'antora-lunr-extension', manifestPath: 'package.json', stars: 0, tags: [], ...o }) as unknown as ExtensionCatalogEntry;

const upstream = e('antora', { stars: 50 });
const forkA = e('AMDphreak', { stars: 1, name: '@amdphreak/lunr-extension', forkOf: { parent: 'antora/antora-lunr-extension', source: 'antora/antora-lunr-extension', aheadBy: 1, behindBy: 0 } });
const forkB = e('someone', { stars: 3, forkOf: { parent: 'AMDphreak/antora-lunr-extension', source: 'antora/antora-lunr-extension' } });
const other = e('x', { id: 'other', repositoryName: 'other', catalogId: 'x/other/other', name: 'other' });

test('forks of the same source share a group key, including forks of forks', () => {
  assert.equal(forkGroupKey(upstream), forkGroupKey(forkA));
  assert.equal(forkGroupKey(forkA), forkGroupKey(forkB));
  assert.notEqual(forkGroupKey(upstream), forkGroupKey(other));
});

test('different modules in the same monorepo stay separate', () => {
  assert.notEqual(forkGroupKey(e('o', { id: 'a', manifestPath: 'registry-index.json' })), forkGroupKey(e('o', { id: 'b', manifestPath: 'registry-index.json' })));
});

test('forkVariants lists the upstream first, then forks by stars', () => {
  assert.deepEqual(forkVariants(forkA, [forkA, other, forkB, upstream]).map((v) => v.repositoryOwner), ['antora', 'someone', 'AMDphreak']);
});

test('collapseForks shows one card per group with a fork count', () => {
  const out = collapseForks([forkA, other, upstream, forkB]);
  assert.equal(out.length, 2);
  assert.equal(out[0].entry, upstream);
  assert.equal(out[0].forkCount, 2);
  assert.equal(out[1].forkCount, 0);
});

test('collapseForks counts filtered-out variants and keeps the visible fork', () => {
  const out = collapseForks([forkA], [forkA, upstream, forkB]);
  assert.equal(out[0].entry, forkA);
  assert.equal(out[0].forkCount, 2);
});

test('a fork is listed only with its own antora-extension topic (curated always allowed)', () => {
  assert.equal(forkAllowed({ fork: false }), true);
  assert.equal(forkAllowed({ fork: true, topics: ['antora'] }), false);
  assert.equal(forkAllowed({ fork: true, topics: ['Antora-Extension'] }), true);
  assert.equal(forkAllowed({ fork: true }, 'curated'), true);
});

test('forkInfoFrom reads parent, source and compare counts', () => {
  assert.equal(forkInfoFrom({ fork: false }), undefined);
  assert.deepEqual(
    forkInfoFrom({ fork: true, parent: { full_name: 'p/r' }, source: { full_name: 's/r' } }, { ahead_by: 2, behind_by: 5, html_url: 'https://github.com/s/r/compare/x' }),
    { parent: 'p/r', source: 's/r', aheadBy: 2, behindBy: 5, compareUrl: 'https://github.com/s/r/compare/x' },
  );
});

test('publishedName only for public package.json names', () => {
  assert.equal(publishedName(forkA), '@amdphreak/lunr-extension');
  assert.equal(publishedName(e('o', { privatePackage: true })), undefined);
  assert.equal(publishedName(e('o', { name: 'Display Name' })), undefined);
});