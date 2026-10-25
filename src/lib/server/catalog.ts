import { cache } from '@solidjs/router';
import { buildFullExtensionCatalog } from '~/lib/extension-catalog';
import { loadGalleryThemes } from '~/lib/themes/catalog';
import { isNewListing } from '~/lib/new-items';
import type { Theme } from '~/types/theme';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

export interface ExtensionCatalogPayload {
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
  discoveredRepoCount: number;
  catalogError: string | null;
}

export const loadExtensionCatalog = cache(async (): Promise<ExtensionCatalogPayload> => {
  'use server';
  try {
    const catalog = await buildFullExtensionCatalog({ includeTopicDiscovery: true });
    return {
      modules: catalog.modules,
      recipes: catalog.recipes,
      discoveredRepoCount: catalog.discoveredRepoCount,
      catalogError: null,
    };
  } catch (error) {
    console.error('Failed to load extension catalog:', error);
    return {
      modules: [],
      recipes: [],
      discoveredRepoCount: 0,
      catalogError: "Some extensions couldn't be loaded. Try again later.",
    };
  }
}, 'extension-catalog');

export const loadThemes = cache(async (): Promise<Theme[]> => {
  'use server';
  return loadGalleryThemes();
}, 'themes-gallery');

/** Compact name index for search typeahead: just enough to label and link each suggestion. */
export interface SearchIndexItem {
  kind: 'extension' | 'theme';
  /** Extension type (antora-extension, ui-module, ui-recipe, ui-bundle) or 'theme'. */
  type: string;
  id: string;
  name: string;
  href: string;
  /** First listed within NEW_WINDOW_DAYS. */
  isNew: boolean;
}

export const loadSearchIndex = cache(async (): Promise<SearchIndexItem[]> => {
  'use server';
  const [catalog, themes] = await Promise.all([loadExtensionCatalog(), loadThemes()]);
  const ext = [...catalog.modules, ...catalog.recipes].map((e) => ({
    kind: 'extension' as const,
    type: e.type,
    id: e.catalogId,
    name: e.name,
    href: `/extensions/${e.catalogId}`,
    isNew: isNewListing(e.firstListedAt),
  }));
  // Themes have no detail page; a suggestion opens the theme-filtered results for that name.
  const th = themes.map((t) => ({
    kind: 'theme' as const,
    type: 'theme',
    id: t.id,
    name: t.name,
    href: `/search?q=${encodeURIComponent(t.name)}&type=themes`,
    isNew: isNewListing(t.firstListedAt),
  }));
  return [...ext, ...th];
}, 'search-index');
