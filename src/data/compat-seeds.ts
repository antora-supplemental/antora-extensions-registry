import type { DeclaredRelations } from '~/lib/pkg-compat';

/**
 * Curated relations for packages that cannot carry antoraRegistry metadata yet
 * (the stock Default UI lives upstream on GitLab). antora-ui-chassis packages now declare their own blocks, so their seeds are retired.
 * Shown with confidence "curated", never "declared". A package's own declaration always wins over a seed.
 * Keys match a package name, owner/repo, or repository name.
 */
export const COMPAT_SEEDS: Record<string, DeclaredRelations> = {
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
