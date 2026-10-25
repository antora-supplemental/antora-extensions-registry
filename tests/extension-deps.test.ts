import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dependents } from '../src/lib/extension-deps';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const repo = 'https://github.com/o/theme';
const mk = (id: string, requires: string[] = [], recommends: string[] = []) =>
  ({ id, catalogId: `o/theme/${id}`, name: id, repository: repo, requires, recommends }) as unknown as ExtensionCatalogEntry;

// Mirrors valentus-theme: doc-layout requires header-chrome, header-chrome requires bc-mast.
const bcMast = mk('bc-mast', ['edit-crumb'], ['dark-mode']);
const header = mk('header-chrome', ['bc-mast'], ['dark-mode']);
const layout = mk('doc-layout', ['header-chrome'], ['dark-mode']);
const dark = mk('dark-mode');

test('used-by lists incoming edges only, with the dependent as subject', () => {
  const all = [bcMast, header, layout, dark];
  assert.deepEqual(dependents(header, all).map((d) => [d.entry.id, d.relation, d.mutual]), [['doc-layout', 'requires', false]]);
  // header-chrome's own requirement (bc-mast) must not show up as a dependent of header-chrome.
  assert.ok(!dependents(header, all).some((d) => d.entry.id === 'bc-mast'));
  assert.deepEqual(dependents(bcMast, all).map((d) => [d.entry.id, d.relation]), [['header-chrome', 'requires']]);
});

test('recommends edges are labelled recommends', () => {
  const all = [bcMast, header, layout, dark];
  assert.deepEqual(dependents(dark, all).map((d) => d.relation), ['recommends', 'recommends', 'recommends']);
});

test('two packages that point at each other are flagged mutual', () => {
  const soft = mk('soft-nav', ['ui-bus'], ['page-state']);
  const page = mk('page-state', ['ui-bus'], ['soft-nav']);
  const [d] = dependents(soft, [soft, page]);
  assert.equal(d.entry.id, 'page-state');
  assert.equal(d.mutual, true);
});
