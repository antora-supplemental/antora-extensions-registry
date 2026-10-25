/** Search result filters shared by the home typeahead and /search. */
export type SearchType = 'all' | 'extensions' | 'themes';

export const EXTENSION_KIND_LABELS: Record<string, string> = {
  'antora-extension': 'Antora extensions',
  'ui-module': 'UI modules',
  'ui-recipe': 'UI recipes',
  /** Compose packs and UI recipes: anything that bundles other entries (lib/layers.ts isBundle). */
  bundle: 'Bundles',
};

/**
 * No broader "All extensions" entry: every listed extension is Antora-specific (no AsciiDoc-only packages as of
 * 2026-10-25), so it duplicated the kinds below. Re-add it as "Antora + AsciiDoc extensions" if those appear.
 */
export const SEARCH_CATEGORIES: Array<{ label: string; href: string }> = [
  ...Object.entries(EXTENSION_KIND_LABELS).map(([kind, label]) => ({
    label,
    href: `/search?type=extensions&kind=${kind}`,
  })),
  { label: 'Themes', href: '/search?type=themes' },
];

export function searchHref(q: string, type: SearchType = 'all', kind?: string): string {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (type !== 'all') p.set('type', type);
  if (kind && type === 'extensions') p.set('kind', kind);
  const s = p.toString();
  return s ? `/search?${s}` : '/search';
}
