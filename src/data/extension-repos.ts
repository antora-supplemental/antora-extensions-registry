import type { KnownExtensionRepo } from '~/types/ui-module';
import { ANTORA_TOPICS } from './github-topics';

/**
 * Curated extension repositories. GitHub topic search (`antora-extension`) supplements this.
 */
export const knownExtensionRepos: KnownExtensionRepo[] = [
  {
    owner: 'antora-supplemental',
    repo: 'valentus-theme',
    branch: 'main',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.EXTENSION],
    localRegistryIndex: '../valentus-theme/ui-modules/registry-index.json',
  },
];
