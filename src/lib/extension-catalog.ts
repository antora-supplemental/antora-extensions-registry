import { knownExtensionRepos } from '~/data/extension-repos';
import {
  discoverExtensionReposFromTopics,
  mergeExtensionRepos,
  toKnownExtensionRepos,
} from '~/lib/github-topics';
import { buildExtensionCatalog, type ExtensionCatalogResult } from '~/lib/ui-modules';

export interface BuildFullCatalogOptions {
  includeTopicDiscovery?: boolean;
  topicSearchLimit?: number;
  siteRoot?: string;
}

export async function buildFullExtensionCatalog(
  options: BuildFullCatalogOptions = {},
): Promise<ExtensionCatalogResult & { discoveredRepoCount: number }> {
  const {
    includeTopicDiscovery = true,
    topicSearchLimit = 30,
    siteRoot = process.cwd(),
  } = options;

  let repos = knownExtensionRepos;

  if (includeTopicDiscovery) {
    const topicHits = await discoverExtensionReposFromTopics(topicSearchLimit);
    const discovered = toKnownExtensionRepos(topicHits);
    repos = mergeExtensionRepos(knownExtensionRepos, discovered);
  }

  const catalog = await buildExtensionCatalog(repos, siteRoot);
  return {
    ...catalog,
    discoveredRepoCount: repos.length - knownExtensionRepos.length,
  };
}
