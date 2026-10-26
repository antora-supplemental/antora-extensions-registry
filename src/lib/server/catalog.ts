import { themeDetailHref } from '~/lib/theme-href';
import { cache } from '@solidjs/router';
import { buildFullExtensionCatalog } from '~/lib/extension-catalog';
import { loadGalleryThemes } from '~/lib/themes/catalog';
import { isNewListing } from '~/lib/new-items';
import { readCatalogOverlay } from '~/lib/catalog-db';
import { applyOverlay, DEFAULT_FEATURED } from '~/lib/catalog-overlay';
import { classifyEntry } from '~/lib/layers';
import type { Theme } from '~/types/theme';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

export interface ExtensionCatalogPayload {
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
  discoveredRepoCount: number;
  catalogError: string | null;
  /** Catalog ids for the home-page featured slot (admin-configurable). */
  featured: string[];
}

export const loadExtensionCatalog = cache(async (): Promise<ExtensionCatalogPayload> => {
  'use server';
  try {
    const [catalog, overlay] = await Promise.all([
      buildFullExtensionCatalog({ includeTopicDiscovery: true }),
      readCatalogOverlay(),
    ]);
    return {
      modules: applyOverlay(catalog.modules.map(classifyEntry), overlay),
      recipes: applyOverlay(catalog.recipes.map(classifyEntry), overlay),
      discoveredRepoCount: catalog.discoveredRepoCount,
      catalogError: null,
      featured: overlay.featured,
    };
  } catch (error) {
    console.error('Failed to load extension catalog:', error);
    return {
      modules: [],
      recipes: [],
      discoveredRepoCount: 0,
      featured: DEFAULT_FEATURED,
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
  /** Extension type (antora-extension, ui-module, ui-recipe, ui-bundle), 'bundle', or 'theme'. */
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
    type: e.bundle ? 'bundle' : e.type,
    id: e.catalogId,
    name: e.name,
    href: `/extensions/${e.catalogId}`,
    isNew: isNewListing(e.firstListedAt),
  }));
  // Theme detail pages live at /themes/<owner>/<repo>.
  const th = themes.map((t) => ({
    kind: 'theme' as const,
    type: 'theme',
    id: t.id,
    name: t.name,
    href: themeDetailHref(t),
    isNew: isNewListing(t.firstListedAt),
  }));
  return [...ext, ...th];
}, 'search-index');
