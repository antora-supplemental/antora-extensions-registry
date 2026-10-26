import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antoraFromBuildMetadata, antoraFromPeerDeps, buildReleases, groupByAntora, majorsFromRange, resolveCompat } from '../src/lib/antora-compat';
import { parseColorSchemes } from '../src/lib/color-schemes';

test('build metadata', () => {
  assert.equal(antoraFromBuildMetadata('v4.2.0+antora.3'), 3);
  assert.equal(antoraFromBuildMetadata('v1.0.0+antora-solid'), 4);
  assert.equal(antoraFromBuildMetadata('v1.0.0'), null);
});

test('ranges', () => {
  assert.deepEqual(majorsFromRange('^3.1.0'), [3]);
  assert.deepEqual(majorsFromRange('>=3 <5'), [3, 4]);
  assert.deepEqual(majorsFromRange('~3.0 || ^4.0.0-alpha'), [3, 4]);
  assert.deepEqual(majorsFromRange('*'), []);
});

test('peer deps only count core packages', () => {
  assert.deepEqual(antoraFromPeerDeps({ peerDependencies: { '@antora/site-generator': '^3.1', '@antora/lunr-extension': '^1' } }), [3]);
});

test('precedence: metadata > engines > peers > repo default', () => {
  const pkg = { engines: { antora: '^4' }, peerDependencies: { '@antora/site-generator': '^3' } };
  assert.deepEqual(resolveCompat('v1.0.0+antora.3', pkg, [4]), { antora: [3], source: 'build-metadata' });
  assert.deepEqual(resolveCompat('v1.0.0', pkg, [3]), { antora: [4], source: 'engines' });
  assert.deepEqual(resolveCompat('v1.0.0', { peerDependencies: pkg.peerDependencies }, [4]), { antora: [3], source: 'peer-dependencies' });
  assert.deepEqual(resolveCompat('v1.0.0', null, [3]), { antora: [3], source: 'repo-default' });
  assert.deepEqual(resolveCompat('v1.0.0', null, []), { antora: [] });
});

test('valentus-style releases: alias tags, rolling tags, grouping', async () => {
  const asset = (n: string) => ({ name: n, browser_download_url: `https://x/${n}` });
  const rels = await buildReleases({
    installBase: 'github:o/r',
    releases: [
      { tag_name: 'v4.2.0', assets: [asset('valentus-layout-bundle.zip'), asset('ui-bundle.zip')] },
      { tag_name: 'v4.1.0', assets: [asset('ui-bundle.zip')] },
      { tag_name: 'v4', prerelease: true, assets: [asset('ui-bundle.zip')] },
    ],
    tags: ['v4.2.0', 'v4.2.0+antora.3', 'v4.1.0', 'v4.1.0+antora.3', 'v4'],
    readTagPackage: async () => null,
    repoDefault: [],
  });
  assert.deepEqual(rels.map((r) => r.tag), ['v4.2.0', 'v4.1.0', 'v4']);
  assert.equal(rels[0].assets[0].name, 'ui-bundle.zip');
  assert.equal(rels[0].label, '4.2.0+antora.3');
  assert.deepEqual(rels[2].antora, [3]);
  assert.equal(rels[2].rolling, true);
  const g = groupByAntora(rels);
  assert.equal(g[0].major, 3);
  assert.equal(g[0].latest?.tag, 'v4.2.0');
});

test('color schemes with swatches', () => {
  const css = `/* @color-schemes
{ "light": {"label":"L"}, "berry": {"label":"Berry","slots":["dark"]}, "dark": {"label":"D"}, "odd": {"label":"Odd","slots":[]} }
*/
:root { --x-canvas: #ffffff; --x-dominant: #ff0000; --x-link: #0000ff; --x-ink: #111111; }
html.dark-theme[data-scheme="berry"] { color-scheme: dark; --x-canvas: #110000; --x-ink: #eeeeee; }
html.dark-theme { --x-canvas: #000000; }`;
  const s = parseColorSchemes(css);
  assert.deepEqual(s.map((x) => [x.id, x.mode]), [['light', 'light'], ['berry', 'dark'], ['dark', 'dark'], ['odd', 'special']]);
  assert.deepEqual(s[0].swatches, ['#ffffff', '#ff0000', '#0000ff', '#111111']);
  assert.deepEqual(s[1].swatches, ['#110000', '#eeeeee']);
});

test('monorepo package tags <dir>-v<semver> map to that package only', async () => {
  const r = await buildReleases({
    installBase: 'github:o/r',
    releases: [],
    tags: ['color-scheme-v0.5.3', 'color-scheme-v0.4.0', 'light-dark-mode-v0.1.2', 'chassis-v0.2.0'],
    readTagPackage: async () => null,
    repoDefault: [3],
    tagPrefix: 'color-scheme-v',
    installPath: 'packages/color-scheme',
  });
  assert.deepEqual(r.map((x) => x.version), ['0.5.3', '0.4.0']);
  assert.equal(r[0].tag, 'color-scheme-v0.5.3');
  assert.equal(r[0].installSpec, 'github:o/r#color-scheme-v0.5.3&path:packages/color-scheme');
});
