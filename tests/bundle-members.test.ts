import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleMembers, externalPackageUrl, matchPackage } from '../src/lib/bundle-members';
import { buildDependencyTree, dependentLabel, dependents } from '../src/lib/extension-deps';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const entry = (o: Partial<ExtensionCatalogEntry> & { id: string; name: string; repo: string }) =>
  ({
    catalogId: `antora-supplemental/${o.repo}/${o.id}`,
    repository: `https://github.com/antora-supplemental/${o.repo}`,
    repositoryOwner: 'antora-supplemental',
    repositoryName: o.repo,
    requires: [],
    recommends: [],
    ...o,
  }) as unknown as ExtensionCatalogEntry;

const glossary = entry({ id: 'antora-glossary', name: '@antora-supplemental/glossary', repo: 'antora-glossary' });
// Display name, not the npm name: the old exact-name match missed this one.
const chassis = entry({ id: 'chassis-compose', name: 'Chassis compose', repo: 'antora-ui-chassis' });
const facto = entry({
  id: 'facto-stack',
  name: '@antora-supplemental/facto-stack',
  repo: 'facto-stack',
  bundle: {
    members: ['@antora-supplemental/glossary', '@antora-supplemental/chassis-compose', '@antora-supplemental/incremental', '@antora/lunr-extension', 'antora'],
    source: 'declared',
  },
  dependencySpecs: {
    '@antora-supplemental/incremental': 'github:antora-supplemental/antora-incremental#v0.1.0',
    '@antora/lunr-extension': '^1.0.0-alpha.13',
  },
});
const all = [glossary, chassis, facto];

test('matchPackage falls back from npm name to owner scope + module id', () => {
  assert.equal(matchPackage('@antora-supplemental/glossary', all), glossary);
  assert.equal(matchPackage('@antora-supplemental/chassis-compose', all), chassis);
  assert.equal(matchPackage('@other/chassis-compose', all), undefined);
  assert.equal(matchPackage('@antora/lunr-extension', all), undefined);
});

test('unlisted members get npm or repository links', () => {
  const byName = Object.fromEntries(bundleMembers(facto, all).map((m) => [m.name, m]));
  assert.equal(byName['@antora-supplemental/chassis-compose'].entry, chassis);
  assert.deepEqual(byName['@antora-supplemental/incremental'].external, { url: 'https://github.com/antora-supplemental/antora-incremental', kind: 'repo' });
  assert.deepEqual(byName['@antora/lunr-extension'].external, { url: 'https://www.npmjs.com/package/@antora/lunr-extension', kind: 'npm' });
  assert.equal(byName.antora.external?.kind, 'npm');
  assert.equal(
    externalPackageUrl('@x/diagram-lightbox', 'github:x/antora-diagram-engines#5fcae8c&path:packages/diagram-lightbox').url,
    'https://github.com/x/antora-diagram-engines/tree/5fcae8c/packages/diagram-lightbox',
  );
  assert.equal(externalPackageUrl('@antora-supplemental/nav-drift', undefined, 'antora-supplemental').kind, 'search');
});

test('bundle members appear in the dependency tree as bundles edges', () => {
  const tree = buildDependencyTree(facto, all);
  assert.deepEqual(
    tree.children.map((c) => [c.id, c.relation, c.entry?.catalogId ?? null]),
    [
      ['antora-glossary', 'bundles', glossary.catalogId],
      ['chassis-compose', 'bundles', chassis.catalogId],
      ['@antora-supplemental/incremental', 'bundles', null],
      ['@antora/lunr-extension', 'bundles', null],
      ['antora', 'bundles', null],
    ],
  );
  assert.equal(tree.children[3].externalUrl, 'https://www.npmjs.com/package/@antora/lunr-extension');
});

test('members list the bundle under Used by as bundled in', () => {
  for (const member of [glossary, chassis]) {
    const ds = dependents(member, all);
    assert.deepEqual(ds.map((d) => [d.entry.id, d.relation, d.mutual]), [['facto-stack', 'bundled-in', false]]);
    assert.equal(dependentLabel(ds[0].relation), 'bundled in');
  }
  assert.equal(dependentLabel('requires'), 'requires this');
  assert.deepEqual(dependents(facto, all), []);
});

test('requires wins over bundled-in when a bundle also requires a member', () => {
  const both = { ...facto, requires: ['antora-glossary'] } as ExtensionCatalogEntry;
  assert.equal(dependents(glossary, [glossary, chassis, both])[0].relation, 'requires');
});