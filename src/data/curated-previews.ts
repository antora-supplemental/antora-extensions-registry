import type { PreviewImage } from '~/types/ui-module';

/**
 * Registry-maintained previews for entries whose repositories have no screenshots yet.
 * Manifest previews (antoraRegistry.previews) and admin uploads take precedence.
 */
export const CURATED_PREVIEWS: Record<string, PreviewImage[]> = {
  'antora-supplemental/antora-search-chat/antora-search-chat': [
    { url: '/previews/antora-search-chat/search-light.png', caption: 'Search/Ask omnibox on the facto-stack demo site (light)', source: 'curated' },
    { url: '/previews/antora-search-chat/search-dark.png', caption: 'Search/Ask omnibox on the facto-stack demo site (dark)', source: 'curated' },
    {
      url: 'https://raw.githubusercontent.com/antora-supplemental/antora-search-chat/main/diagrams/search-compound-layout.svg',
      caption: 'Compound search layout (from the repository diagrams)',
      source: 'curated',
    },
  ],
};
