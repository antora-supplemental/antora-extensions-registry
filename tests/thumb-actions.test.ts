import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/components/catalog/ThemeCard.tsx', import.meta.url), 'utf8');

test('hidden thumbnail actions take no pointer events and no focus', () => {
  const base = css.match(/\.thumb-actions,\s*\.thumb-scrim \{([^}]*)\}/)?.[1] ?? '';
  assert.match(base, /visibility:\s*hidden/);
  assert.match(base, /pointer-events:\s*none/);
});

test('hover reveal only on hover-capable fine pointers, with a delayed visibility flip', () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /visibility 0s linear 60ms/);
});

test('ThemeCard uses the guarded overlay, not opacity-only hiding', () => {
  assert.doesNotMatch(card, /opacity-0 group-hover:opacity-100/);
  assert.match(card, /thumb-actions/);
  assert.match(card, /CardPreviewLink href=\{detailHref\(\)\}/);
  assert.match(card, /<A href=\{detailHref\(\)\}/);
});

test('theme detail href comes from the repo URL', async () => {
  const { themeDetailHref } = await import('../src/lib/theme-href');
  assert.equal(themeDetailHref({ repoUrl: 'https://github.com/antora-supplemental/skittles-theme', name: 'x' }), '/themes/antora-supplemental/skittles-theme');
});

test('cards carry no Report button (it lives on the detail pages only)', () => {
  for (const f of ['ThemeCard', 'ExtensionCard', 'FeaturedExtension']) {
    const src = readFileSync(new URL(`../src/components/catalog/${f}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /ReportButton/, f);
  }
});

import { sortSchemes } from '../src/lib/color-schemes';
import { orderModes } from '../src/components/catalog/ColorModeIcons';
test('schemes and mode circles render light first, then dark, then others', () => {
  const s = sortSchemes([{ id: 'd', mode: 'dark' }, { id: 'x', mode: 'special' }, { id: 'l', mode: 'light' }, { id: 'l2', mode: 'light' }]);
  assert.deepEqual(s.map((x) => x.id), ['l', 'l2', 'd', 'x']);
  assert.deepEqual(orderModes(['dark', 'light']), ['light', 'dark']);
});
