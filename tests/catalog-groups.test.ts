import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGroups, isListed, normalizeGroupRef, readGroupDecl, variantMatch } from '../src/lib/catalog-groups';
import { CURATED_GROUPS } from '../src/data/catalog-groups';
import { resolveTitleClaims } from '../src/lib/title-collisions';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const entry = (catalogId: string, extra: Partial<ExtensionCatalogEntry> = {}): ExtensionCatalogEntry => {
  const [owner, repo, id] = catalogId.split('/');
  return {
    catalogId, id, name: id, description: `${id} description`, type: 'ui-module', version: '1.0.0', repository: `https://github.com/${owner}/${repo}`,
    repositoryOwner: owner, repositoryName: repo, tags: [], stars: 0, author: owner, lastUpdated: '', ...extra,
  } as ExtensionCatalogEntry;
};

const CANON = 'antora-supplemental/antora-ui-chassis/light-dark-mode';
const darkCatalog = () => [
  entry(CANON, { title: 'Light/Dark Mode' }),
  entry('antora-supplemental/antora-ui-chassis/antora-dark-mode', { title: 'Antora Dark Mode', variantOf: `github.com/${CANON}`, variantLabel: 'One require for the Default UI' }),
  entry('antora-supplemental/antora-dark-mode/dark-mode', { name: 'Antora dark mode' }),
  entry('antora-supplemental/antora-dark-mode/dark-mode-only', { name: 'Dark mode only', type: 'ui-recipe', tags: ['recipe'] }),
];

test('group refs accept host/owner/repo/package, URLs and catalog ids', () => {
  assert.equal(normalizeGroupRef('https://github.com/A/B/c/'), 'a/b/c');
  assert.equal(normalizeGroupRef('github.com/a/b/c'), 'a/b/c');
  assert.equal(normalizeGroupRef('gitlab.com/a/b/c'), 'gitlab.com/a/b/c');
  assert.deepEqual(readGroupDecl({ variantOf: ' x/y/z ', supersededBy: 3, title: 'T' }), { variantOf: 'x/y/z' });
  assert.equal(readGroupDecl({ title: 'T' }), undefined);
});

test('dark mode: one canonical entry, two variants, the old repo replaced', () => {
  const out = applyGroups(darkCatalog(), CURATED_GROUPS);
  const listed = out.filter(isListed);
  assert.deepEqual(listed.map((e) => e.catalogId), [CANON]);
  const canon = listed[0];
  assert.deepEqual(canon.variants?.map((v) => v.catalogId), ['antora-supplemental/antora-ui-chassis/antora-dark-mode', 'antora-supplemental/antora-dark-mode/dark-mode-only']);
  assert.equal(canon.variants?.[0].description, 'One require for the Default UI');
  const old = out.find((e) => e.catalogId.endsWith('/dark-mode'))!;
  assert.deepEqual(old.replacedBy, { catalogId: CANON, title: 'Light/Dark Mode' });
  assert.equal(old.groupSource, 'curated');
  assert.equal(out[1].partOf?.catalogId, CANON);
  assert.equal(out[1].groupSource, 'declared');
  assert.equal(variantMatch(canon, 'dark mode only')?.catalogId, 'antora-supplemental/antora-dark-mode/dark-mode-only');
  assert.equal(variantMatch(canon, 'recipe')?.catalogId, 'antora-supplemental/antora-dark-mode/dark-mode-only');
  assert.equal(variantMatch(canon, 'zzz'), undefined);
});

test('declared values win over curated; unknown and circular targets keep the entry listed', () => {
  const a = entry('o/r/a', { variantOf: 'o/r/b' });
  const b = entry('o/r/b', { variantOf: 'o/r/a' });
  const c = entry('o/r/c', { supersededBy: 'o/r/missing' });
  const d = entry('o/r/d', { supersededBy: 'o/r/d' });
  const out = applyGroups([a, b, c, d], { 'o/r/c': { supersededBy: 'o/r/a' } });
  assert.ok(out.every(isListed));
  assert.equal(a.partOf, undefined, 'input not mutated');
});

test('chains resolve to the final canonical entry', () => {
  const out = applyGroups([entry('o/r/new'), entry('o/r/old', { supersededBy: 'o/r/new' }), entry('o/r/v', { variantOf: 'o/r/old' })]);
  assert.equal(out[1].replacedBy?.catalogId, 'o/r/new');
  assert.equal(out[2].partOf?.catalogId, 'o/r/new');
  assert.deepEqual(out[0].variants?.map((v) => v.catalogId), ['o/r/v']);
});

test('superseded entries make no title claim and clear clashes they held', () => {
  const entries = [entry('o/old/x', { title: 'Same Title', supersededBy: 'o/new/x' }), entry('o/new/x', { title: 'Same Title' })];
  const { claims, conflicts } = resolveTitleClaims(entries, [{ titleKey: 'sametitle', catalogId: 'o/old/x', firstSeenAt: 1 }], 2);
  assert.deepEqual(claims.map((c) => c.catalogId), ['o/new/x']);
  assert.equal(conflicts.length, 0);
  assert.equal(entries[1].titleInUseBy, undefined);
  const stale = applyGroups([entry('o/old/x', { supersededBy: 'o/new/x' }), entry('o/new/x', { titleInUseBy: 'o/old/x', titleDisambiguator: 'o' })]);
  assert.equal(stale[1].titleInUseBy, undefined);
});
