import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyEntry, inferLayers, isThemePackage } from '../src/lib/layers';
import { finalizeCatalog } from '../src/lib/catalog-enrich';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

/** Live shape of article-zones before the fix: stale inferred paint and a keyword-derived "dark" tag. */
const articleZones = () =>
  ({
    catalogId: 'antora-supplemental/article-zones/article-zones',
    id: 'article-zones',
    name: '@antora-supplemental/article-zones',
    type: 'antora-extension',
    repositoryOwner: 'antora-supplemental',
    repositoryName: 'article-zones',
    description: 'Antora extension: relocate semantic article chrome from the body zone into theme meta/header zones',
    tags: ['antora-extension', 'dark', 'layout', 'extension'],
    githubTopics: ['antora-extension', 'layout', 'extension'],
    layers: ['paint'],
    layerSource: 'inferred',
  }) as unknown as ExtensionCatalogEntry;

test('article-zones: layout topic gives the layout (body-kit) layer, not paint', () => {
  const e = classifyEntry(articleZones());
  assert.deepEqual(e.layers, ['body-kit']);
  assert.equal(e.layerSource, 'topic');
});

test('article-zones: no theme swatch for a layout package', () => {
  assert.equal(isThemePackage(classifyEntry(articleZones())), false);
});

test('listing (finalizeCatalog) and page (classifyEntry on read) agree', () => {
  const [listed] = finalizeCatalog([articleZones()]);
  assert.deepEqual(classifyEntry(listed).layers, listed.layers);
  assert.deepEqual(listed.layers, ['body-kit']);
});

test('"dark"/"theme" in name or description never infer paint', () => {
  const e = { ...articleZones(), githubTopics: ['antora-extension'], tags: [], name: 'dark-theme-helper', layers: undefined, layerSource: undefined };
  assert.deepEqual(inferLayers(e), ['bolt-on']);
});

test('explicit metadata and theme topics are paint', () => {
  const declared = { ...articleZones(), layers: ['paint'], layerSource: 'declared' } as ExtensionCatalogEntry;
  assert.deepEqual(classifyEntry(declared).layers, ['paint']);
  assert.equal(isThemePackage(declared), true);
  const topic = { ...articleZones(), githubTopics: ['antora-theme'], tags: [], layers: undefined, layerSource: undefined } as unknown as ExtensionCatalogEntry;
  assert.deepEqual(classifyEntry(topic).layers, ['paint']);
  assert.equal(isThemePackage(topic), true);
});