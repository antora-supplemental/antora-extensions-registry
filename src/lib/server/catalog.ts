import { cache } from '@solidjs/router';
import { buildFullExtensionCatalog } from '~/lib/extension-catalog';
import { loadGalleryThemes } from '~/lib/themes/catalog';
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
      catalogError: 'Could not fetch extension manifests from known repositories.',
    };
  }
}, 'extension-catalog');

export const loadThemes = cache(async (): Promise<Theme[]> => {
  'use server';
  return loadGalleryThemes();
}, 'themes-gallery');
