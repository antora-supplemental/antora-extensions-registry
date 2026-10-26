import { test as it } from 'node:test';
import assert from 'node:assert/strict';
const describe = (_: string, fn: () => void) => fn();
const expect = (v: any) => ({
  toBe: (x: any) => assert.equal(v, x),
  toEqual: (x: any) => assert.deepEqual(v, x),
  toContain: (x: string) => assert.ok(String(v).includes(x), `${v} should contain ${x}`),
  toMatchObject: (x: Record<string, any>) => { for (const k of Object.keys(x)) assert.deepEqual(v?.[k], x[k], k); },
});
import { computeCompat, readRelations, satisfies, type CompatNode } from '../src/lib/pkg-compat';

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
  it('same exclusive layer is an alternative, never compatible', () => {
    const m = computeCompat([n('p1', ['paint'], { uses: { x: '1' } }), n('p2', ['paint'], { provides: { x: '1' } })]);
    expect(link(m, 'p1', 'p2')?.relation).toBe('alternative');
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
