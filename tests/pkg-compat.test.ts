import { test as it } from 'node:test';
import assert from 'node:assert/strict';
const describe = (_: string, fn: () => void) => fn();
const expect = (v: any) => ({
  toBe: (x: any) => assert.equal(v, x),
  toBeUndefined: () => assert.equal(v, undefined),
  not: { toBe: (x: any) => assert.notEqual(v, x) },
  toEqual: (x: any) => assert.deepEqual(v, x),
  toContain: (x: string) => assert.ok(String(v).includes(x), `${v} should contain ${x}`),
  toMatchObject: (x: Record<string, any>) => { for (const k of Object.keys(x)) assert.deepEqual(v?.[k], x[k], k); },
});
import { computeCompat, computeStacks, minimalStack, readRelations, satisfies, stackCoverage, type CompatNode } from '../src/lib/pkg-compat';

const n = (id: string, layers: any[], rel?: any, antora?: number[], version = '1.0.0'): CompatNode => ({
  catalogId: id, name: id, version, repositoryOwner: 'o', repositoryName: id, layers, antora, relations: rel ? { source: 'declared', ...rel } : undefined,
});
const link = (m: Map<string, any[]>, a: string, b: string) => m.get(a)?.find((l) => l.target === b);

describe('semver', () => {
  it('handles caret, tilde, partial, ranges', () => {
    expect(satisfies('0.5.3', '0.5')).toBe(true);
    expect(satisfies('0.5.3', '^0.4')).toBe(false);
    expect(satisfies('4.2.0', '^4.1.0')).toBe(true);
    expect(satisfies('4.2.0', '>=3 <5')).toBe(true);
    expect(satisfies('0.1.9', '~0.1.2')).toBe(true);
    expect(satisfies('2.0.0', '^1 || ^2')).toBe(true);
  });
  it('reads list and object forms', () => {
    expect(readRelations({ worksWith: ['@a/b@^1.2', 'c'] })?.worksWith).toEqual({ '@a/b': '^1.2', c: '*' });
  });
});

describe('computeCompat', () => {
  it('requires implies works-with, both ways', () => {
    const m = computeCompat([n('a', ['bolt-on'], { requires: { b: '^1' } }), n('b', ['chassis'])]);
    expect(link(m, 'a', 'b')).toMatchObject({ relation: 'works-with', confidence: 'declared' });
    expect(link(m, 'b', 'a')).toMatchObject({ relation: 'works-with', confidence: 'declared' });
  });
  it('same exclusive layer with nothing declared is an alternative', () => {
    const m = computeCompat([n('p1', ['paint']), n('p2', ['paint'])]);
    expect(link(m, 'p1', 'p2')?.relation).toBe('alternative');
  });
  it('satisfied contracts beat the same-layer alternative inference', () => {
    const m = computeCompat([n('p1', ['paint'], { uses: { x: '1' } }), n('p2', ['paint'], { provides: { x: '1' } })]);
    expect(link(m, 'p1', 'p2')).toMatchObject({ relation: 'works-with', confidence: 'guaranteed' });
    expect(link(m, 'p2', 'p1')?.relation).not.toBe('alternative');
  });
  it('declared requires beats the same-layer alternative inference', () => {
    const m = computeCompat([n('p1', ['paint'], { requires: { p2: '^1' } }), n('p2', ['paint'])]);
    expect(link(m, 'p1', 'p2')).toMatchObject({ relation: 'works-with', confidence: 'declared' });
    expect(link(m, 'p2', 'p1')?.relation).toBe('works-with');
  });
  it('composable layers (chassis, bolt-on) never infer alternatives', () => {
    const m = computeCompat([n('c1', ['chassis']), n('c2', ['chassis']), n('b1', ['bolt-on']), n('b2', ['bolt-on'])]);
    expect(link(m, 'c1', 'c2')).toBeUndefined();
    expect(link(m, 'b1', 'b2')).toBeUndefined();
  });
  it('chassis monorepo: light-dark-mode requiring color-scheme by package name is works-with, not alternative', () => {
    const cs = { ...n('color-scheme', ['chassis'], { provides: { 'color-scheme-tokens': '0.5' } }), catalogId: 'o/chassis/color-scheme', name: 'Color scheme', version: '0.5.3', repositoryOwner: 'o', repositoryName: 'chassis', packageName: '@o/color-scheme' };
    const ldm = { ...n('light-dark-mode', ['chassis'], { requires: { '@o/color-scheme': '^0.5.3' }, uses: { 'color-scheme-tokens': '^0.5' } }), catalogId: 'o/chassis/light-dark-mode', repositoryOwner: 'o', repositoryName: 'chassis', packageName: '@o/light-dark-mode' };
    const sk = { ...n('skittles', ['paint'], { requires: { '@o/color-scheme': '^0.5.0' }, uses: { 'color-scheme-tokens': '^0.5' } }), catalogId: 'o/sk/skittles' };
    const m = computeCompat([cs, ldm, sk]);
    expect(link(m, 'o/chassis/light-dark-mode', 'o/chassis/color-scheme')).toMatchObject({ relation: 'works-with', confidence: 'guaranteed' });
    expect(link(m, 'o/chassis/color-scheme', 'o/chassis/light-dark-mode')?.relation).toBe('works-with');
    expect(link(m, 'o/sk/skittles', 'o/chassis/color-scheme')).toMatchObject({ relation: 'works-with', confidence: 'guaranteed' });
  });
  it('declared conflict overrides', () => {
    const m = computeCompat([n('a', ['bolt-on'], { worksWith: { b: '*' }, conflictsWith: { b: '*' } }), n('b', ['chassis'])]);
    expect(link(m, 'a', 'b')?.relation).toBe('conflicts');
  });
  it('Antora non-overlap overrides works-with', () => {
    const m = computeCompat([n('a', ['bolt-on'], { worksWith: { b: '*' } }, [3]), n('b', ['chassis'], undefined, [4])]);
    expect(link(m, 'a', 'b')?.relation).toBe('antora-mismatch');
  });
  it('strict layering chain is guaranteed', () => {
    const A = n('A', ['paint'], { worksWith: { B: '^1' }, uses: { 'layout-markup': '4' } });
    const B = n('B', ['body-kit'], { worksWith: { C: '^1' }, provides: { 'layout-markup': '4' }, uses: { tokens: '0.5' } });
    const C = n('C', ['chassis'], { worksWith: { B: '^1' }, provides: { tokens: '0.5' } });
    const l = link(computeCompat([A, B, C]), 'A', 'C');
    expect(l).toMatchObject({ confidence: 'guaranteed', path: ['A', 'B', 'C'] });
  });
  it('reaching C directly makes the chain only likely, with the reason', () => {
    const A = n('A', ['paint'], { worksWith: { B: '^1' }, uses: { 'layout-markup': '4', 'chassis-markup': '1' } });
    const B = n('B', ['body-kit'], { worksWith: { C: '^1' }, provides: { 'layout-markup': '4' } });
    const C = n('C', ['chassis'], { provides: { 'chassis-markup': '1' } });
    const l = link(computeCompat([A, B, C]), 'A', 'C');
    expect(l?.confidence).toBe('likely');
    expect(l?.why).toContain("A reaches C's chassis-markup directly, not via B");
  });
});

it('a repo name resolves to the entry carrying relations, not the first module', () => {
  const mod = { ...n('mod', ['bolt-on']), repositoryName: 'theme' };
  const site = { ...n('site', ['body-kit'], { provides: { m: '1' } }), repositoryName: 'theme' };
  const m = computeCompat([mod, site, n('pack', ['chassis'], { requires: { theme: '*' } })]);
  expect(m.get('pack')?.[0].target).toBe('site');
});

describe('stack-wide contracts', () => {
  const N = (o: Partial<CompatNode> & { catalogId: string; name: string }, rel?: any): CompatNode => ({ version: '1.0.0', repositoryOwner: 'antora-supplemental', repositoryName: o.catalogId.split('/')[1], layers: [], ...o, relations: rel ? { source: 'declared', ...rel } : undefined });
  const cs = N({ catalogId: 'antora-supplemental/antora-ui-chassis/color-scheme', name: 'Color scheme', version: '0.5.3', layers: ['chassis'], packageName: '@antora-supplemental/color-scheme' }, { provides: { 'color-scheme-tokens': '0.5' } });
  const ldm = N({ catalogId: 'antora-supplemental/antora-ui-chassis/light-dark-mode', name: 'Light/Dark Mode', version: '0.1.3', layers: ['chassis'], packageName: '@antora-supplemental/light-dark-mode' }, { requires: { '@antora-supplemental/color-scheme': '^0.5.3' }, provides: { 'light-dark-slots': '0.1' }, uses: { 'color-scheme-tokens': '^0.5' } });
  const val = N({ catalogId: 'antora-supplemental/valentus-theme/valentus-site', name: 'Valentus Layout', layers: ['body-kit'] }, { worksWith: { '@antora-supplemental/color-scheme': '>=0.4.0' }, provides: { 'valentus-layout-markup': '4' }, uses: { 'color-scheme-tokens': '^0.5' } });
  const sk = N({ catalogId: 'antora-supplemental/skittles-theme/skittles-theme', name: 'Skittles', version: '0.1.0', layers: ['body-kit', 'paint'] }, {
    worksWith: { 'valentus-theme': '^4.2.2', '@antora-supplemental/color-scheme': '^0.5.3', '@antora-supplemental/light-dark-mode': '^0.1.3' },
    provides: { 'skittles-paint-tokens': '0.1' }, uses: { 'valentus-layout-markup': '4', 'color-scheme-tokens': '^0.5', 'light-dark-slots': '^0.1' },
  });
  const other = N({ catalogId: 'x/other-paint/other-paint', name: 'Other paint', layers: ['paint'] }, { provides: { 'color-scheme-tokens': '0.5' } });
  const all = [sk, cs, ldm, val, other];

  it('Skittles: no single provider or one-hop chain covers it, but the four-package stack is guaranteed', () => {
    const m = computeCompat(all);
    expect(m.get(sk.catalogId)!.some((l) => l.confidence === 'guaranteed' && l.target === val.catalogId)).toBe(false);
    const s = stackCoverage([sk, val, cs, ldm], all);
    expect(s.status).toBe('guaranteed');
    expect(s.missing).toEqual([]);
  });
  it('Skittles: the minimal guaranteed stack is Skittles + Valentus Layout + Color scheme + Light/Dark Mode', () => {
    const s = minimalStack(sk, all)!;
    expect(s.status).toBe('guaranteed');
    expect([...s.members].sort()).toEqual([sk, val, cs, ldm].map((n) => n.catalogId).sort());
    expect(s.members[0]).toBe(sk.catalogId);
    expect(computeStacks(all).get(sk.catalogId)?.status).toBe('guaranteed');
  });
  it('partial coverage is declared when relations tie the stack, likely otherwise, and lists the missing contracts', () => {
    const declared = stackCoverage([sk, cs], all);
    expect(declared.status).toBe('declared');
    expect(declared.missingContracts.sort()).toEqual(['light-dark-slots', 'valentus-layout-markup']);
    expect(declared.missing.join('; ')).toContain('valentus-layout-markup@4 (used by Skittles)');
    const loose = N({ catalogId: 'x/loose/loose', name: 'Loose', layers: ['bolt-on'] }, { uses: { 'color-scheme-tokens': '^0.5', 'nav-api': '1' } });
    const likely = stackCoverage([loose, cs], [loose, cs]);
    expect(likely.status).toBe('likely');
    expect(likely.missingContracts).toEqual(['nav-api']);
  });
  it('an unsatisfied version range is not covered', () => {
    const old = { ...cs, relations: { source: 'declared' as const, provides: { 'color-scheme-tokens': '0.4' } } };
    const s = stackCoverage([ldm, old], [ldm, old]);
    expect(s.status === 'guaranteed').toBe(false);
    expect(s.missingContracts).toEqual(['color-scheme-tokens']);
  });
  it('a declared requires outside the stack blocks guaranteed', () => {
    const s = stackCoverage([ldm, other], [ldm, other, cs]);
    expect(s.status === 'guaranteed').toBe(false);
    expect(s.missing.join()).toContain('requires Color scheme');
  });
});
