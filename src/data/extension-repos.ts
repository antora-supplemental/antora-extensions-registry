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
  {
    owner: 'antora-supplemental',
    repo: 'antora-ui-chassis',
    branch: 'main',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.EXTENSION, 'page-state', 'chassis-compose'],
    localRegistryIndex: '../antora-ui-chassis/registry-index.json',
  },
  {
    owner: 'antora-supplemental',
    repo: 'antora-glossary',
    branch: 'main',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.EXTENSION, 'glossary', 'antora-glossary'],
  },
  {
    // Compose pack (bundle). Its topics don't include antora-extension, so topic search misses it.
    owner: 'antora-supplemental',
    repo: 'facto-stack',
    branch: 'main',
    discoveredVia: 'curated',
    githubTopics: ['facto-stack'],
  },
];
