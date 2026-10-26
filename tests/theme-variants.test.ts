import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knownThemeRepoUrl, themeVariantsOf, themesFromKnownRepos } from '../src/data/known-theme-repos';

test('stock Default UI links to its light/dark fork, not the other way round', () => {
  assert.deepEqual(themeVariantsOf('antora/antora-ui-default'), [
    { path: 'AMDphreak/antora-ui-default', label: 'Also available with light/dark mode', href: '/themes/AMDphreak/antora-ui-default' },
  ]);
  assert.deepEqual(themeVariantsOf('AMDphreak/antora-ui-default'), []);
});

test('the fork leads the featured themes from GitLab; the stock item stays light-only', () => {
  const themes = themesFromKnownRepos();
  assert.equal(themes[0].repoUrl, 'https://gitlab.com/AMDphreak/antora-ui-default');
  assert.equal(themes[0].name, 'Default UI with light/dark mode');
  const stock = themes.find((t) => t.repoUrl === 'https://github.com/antora/antora-ui-default')!;
  assert.equal(stock.appearance, 'light');
  assert.equal(knownThemeRepoUrl({ owner: 'a', repo: 'b' }), 'https://github.com/a/b');
});
