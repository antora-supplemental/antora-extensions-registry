/** Search result filters shared by the home typeahead and /search. */
export type SearchType = 'all' | 'extensions' | 'themes';

export const EXTENSION_KIND_LABELS: Record<string, string> = {
  'antora-extension': 'Antora extensions',
  'ui-module': 'UI modules',
  'ui-recipe': 'Bundles',
};

export const SEARCH_CATEGORIES: Array<{ label: string; href: string }> = [
  { label: 'All extensions', href: '/search?type=extensions' },
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
