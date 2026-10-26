import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayTitle, humanizePackageName, isRawName, pickTitle, readmeHeading } from '../src/lib/package-title';
import { annotateNpm, resolveTitleClaims, titleKey } from '../src/lib/title-collisions';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const e = (o: Partial<ExtensionCatalogEntry>) => ({ catalogId: o.name, id: o.name, type: 'antora-extension', repositoryOwner: 'acme', repositoryName: 'r', manifestPath: 'package.json', ...o }) as ExtensionCatalogEntry;

test('humanize strips scope, splits hyphens and keeps acronyms', () => {
  assert.equal(humanizePackageName('@antora-supplemental/soft-nav-page-toc'), 'Soft Nav Page TOC');
  assert.equal(humanizePackageName('antora-ui-chassis'), 'Antora UI Chassis');
  assert.ok(isRawName('page-state'));
});

test('title precedence: registry title, displayName, README heading, humanized name', () => {
  assert.equal(pickTitle({ registryTitle: 'A', displayName: 'B', readme: '# C', name: 'd-e' }), 'A');
  assert.equal(pickTitle({ displayName: 'B', readme: '# C', name: 'd-e' }), 'B');
  assert.equal(readmeHeading('= Page State\n\ntext'), 'Page State');
  assert.equal(displayTitle(e({ name: 'page-state' })), 'Page State');
});

test('first-seen entry holds a title; later ones are flagged; title frees when the holder leaves', () => {
  assert.equal(titleKey('Color-Scheme'), titleKey('color scheme'));
  const a = e({ name: 'a', catalogId: 'a', title: 'Color Scheme', repositoryOwner: 'one' });
  const b = e({ name: 'b', catalogId: 'b', title: 'color-scheme', repositoryOwner: 'two', repositoryHost: 'gitlab.com' });
  const f = e({ name: 'c', catalogId: 'c', title: 'Color Scheme', repositoryOwner: 'three', forkOf: { source: 'one/r' } as any });
  const u = e({ name: 'u', catalogId: 'u', title: 'Unique' });
  const prior = [{ titleKey: 'colorscheme', catalogId: 'b', firstSeenAt: 1 }];
  const r = resolveTitleClaims([a, b, f, u], prior, 100);
  assert.equal(b.titleDisambiguator, undefined); // b was seen first
  assert.equal(a.titleDisambiguator, 'one · GitHub');
  assert.equal(a.titleInUseBy, 'b');
  assert.equal(f.titleInUseBy, undefined);
  assert.equal(r.conflicts.length, 1);
  assert.ok(!r.claims.some((c) => c.catalogId === 'c'));
  // b renames: a now holds the title, keeping its first-seen time.
  b.title = 'Something Else';
  resolveTitleClaims([a, b], r.claims, 200);
  assert.equal(a.titleInUseBy, undefined);
  assert.equal(a.titleDisambiguator, undefined);
});

test('npm lookup only counts packages whose repository matches', async () => {
  const mine = e({ name: '@acme/x', repositoryOwner: 'acme', repositoryName: 'r' });
  const squat = e({ name: 'other', repositoryOwner: 'acme', repositoryName: 'r' });
  const priv = e({ name: 'p', privatePackage: true } as any);
  const fake = (async (url: string) => {
    const repo = url.includes('%40acme%2Fx') || url.includes('@acme%2Fx') ? 'git+https://github.com/acme/r.git' : 'https://github.com/else/z';
    return { ok: true, json: async () => ({ repository: { url: repo } }) };
  }) as unknown as typeof fetch;
  await annotateNpm([mine, squat, priv], fake);
  assert.equal(mine.npmName, '@acme/x');
  assert.equal(squat.npmName, undefined);
  assert.equal(priv.npmName, undefined);
});
