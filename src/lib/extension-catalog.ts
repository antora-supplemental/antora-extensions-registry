import { knownExtensionRepos } from '~/data/extension-repos';
import {
  discoverExtensionReposFromTopics,
  mergeExtensionRepos,
  toKnownExtensionRepos,
} from '~/lib/github-topics';
import { buildExtensionCatalog, type ExtensionCatalogResult } from '~/lib/ui-modules';

import snapshot from '~/data/catalog-snapshot.json';

type FullCatalog = ExtensionCatalogResult & { discoveredRepoCount: number };

/** Build-time catalog (scripts/build-catalog-snapshot.ts, run in CI with GITHUB_TOKEN). */
export function catalogSnapshot(): FullCatalog | null {
  const snap = snapshot as unknown as FullCatalog;
  return snap?.modules?.length || snap?.recipes?.length ? snap : null;
}

export interface BuildFullCatalogOptions {
  includeTopicDiscovery?: boolean;
  topicSearchLimit?: number;
  siteRoot?: string;
  /** Skip the build-time snapshot and query GitHub live. */
  live?: boolean;
}

export async function buildFullExtensionCatalog(
  options: BuildFullCatalogOptions = {},
): Promise<ExtensionCatalogResult & { discoveredRepoCount: number }> {
  const {
    includeTopicDiscovery = true,
    topicSearchLimit = 30,
    siteRoot = process.cwd(),
    live = process.env.REGISTRY_LIVE_CATALOG === 'true',
  } = options;

  if (!live) {
    const snap = catalogSnapshot();
    if (snap) return snap;
  }

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
