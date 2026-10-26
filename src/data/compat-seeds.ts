import type { DeclaredRelations } from '~/lib/pkg-compat';

/**
 * Curated relations for packages that cannot carry antoraRegistry metadata yet
 * (antora-ui-chassis packages are being reworked in place; the stock Default UI lives upstream on GitLab).
 * Shown with confidence "curated", never "declared". A package's own declaration always wins over a seed.
 * Keys match a package name, owner/repo, or repository name.
 */
export const COMPAT_SEEDS: Record<string, DeclaredRelations> = {
  '@antora-supplemental/color-scheme': {
    source: 'curated',
    provides: { 'color-scheme-tokens': '0.5' },
  },
  '@antora-supplemental/light-dark-mode': {
    source: 'curated',
    requires: { '@antora-supplemental/color-scheme': '^0.4.0' },
    uses: { 'color-scheme-tokens': '^0.4' },
    provides: { 'light-dark-slots': '0.1' },
  },
  '@antora-supplemental/default-paint': {
    source: 'curated',
    uses: { 'default-ui-markup': '2' },
    provides: { 'default-ui-paint-tokens': '0.2' },
  },
  'antora/antora-ui-default': {
    source: 'curated',
    provides: { 'default-ui-markup': '2', 'antora-ui-model': '3' },
  },
};

export function seedFor(keys: string[]): DeclaredRelations | undefined {
  for (const k of keys) {
    const hit = Object.entries(COMPAT_SEEDS).find(([s]) => s.toLowerCase() === k.toLowerCase());
    if (hit) return hit[1];
  }
  return undefined;
}
