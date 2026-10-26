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
    repo: 'skittles-theme',
    branch: 'main',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.THEME, 'antora-paint', 'antora-light-theme', 'antora-dark-theme'],
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
  {
    // Monorepo: diagram-lightbox and mermaid-client, listed by registry-index.json at the repo root.
    owner: 'antora-supplemental',
    repo: 'antora-diagram-engines',
    branch: 'main',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.EXTENSION],
    localRegistryIndex: '../antora-diagram-engines/registry-index.json',
  },
  {
    // @antora/lunr-extension: the official search extension, hosted on GitLab (its topics don't include antora-extension).
    host: 'gitlab.com',
    owner: 'antora',
    repo: 'antora-lunr-extension',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.EXTENSION],
  },
  {
    // Default UI with light/dark mode: fork of antora/antora-ui-default; dark mode lives on this branch.
    host: 'gitlab.com',
    owner: 'AMDphreak',
    repo: 'antora-ui-default',
    branch: 'feat/root-theme-transition',
    discoveredVia: 'curated',
    githubTopics: [ANTORA_TOPICS.THEME, 'antora-light-theme', 'antora-dark-theme'],
  },
];
