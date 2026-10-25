import { knownExtensionRepos } from '~/data/extension-repos';
import {
  discoverExtensionReposFromTopics,
  mergeExtensionRepos,
  toKnownExtensionRepos,
} from '~/lib/github-topics';
import { buildExtensionCatalog, type ExtensionCatalogResult } from '~/lib/ui-modules';
import type { KnownExtensionRepo } from '~/types/ui-module';

import { readCatalogFromDb } from '~/lib/catalog-db';
import snapshot from '~/data/catalog-snapshot.json';

type FullCatalog = ExtensionCatalogResult & {
  discoveredRepoCount: number;
  source?: 'database' | 'snapshot' | 'live';
  syncedAt?: string;
};

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
  /** Repositories approved in the database (expedited checks, admin approvals). */
  extraRepos?: KnownExtensionRepo[];
  /** `owner/repo` (lowercase) of rejected repositories to leave out. */
  excludeRepos?: Set<string>;
}

export async function buildFullExtensionCatalog(
  options: BuildFullCatalogOptions = {},
): Promise<FullCatalog> {
  const {
    includeTopicDiscovery = true,
    topicSearchLimit = 30,
    siteRoot = process.cwd(),
    live = process.env.REGISTRY_LIVE_CATALOG === 'true',
    extraRepos = [],
    excludeRepos,
  } = options;

  if (!live) {
    const fromDb = await readCatalogFromDb();
    if (fromDb) return fromDb;
    const snap = catalogSnapshot();
    if (snap) return { ...snap, source: 'snapshot' } as FullCatalog;
  }

  let repos = knownExtensionRepos;

  if (includeTopicDiscovery) {
    const topicHits = await discoverExtensionReposFromTopics(topicSearchLimit);
    const discovered = toKnownExtensionRepos(topicHits);
    repos = mergeExtensionRepos(knownExtensionRepos, discovered);
    // GitLab (gitlab.com): projects with the antora-extension topic. Optional GITLAB_TOKEN raises the rate limit.
    const { discoverGitLabByTopic } = await import('~/lib/gitlab');
    const key = (r: KnownExtensionRepo) => `${r.host ?? 'github.com'}/${r.owner}/${r.repo}`.toLowerCase();
    const known = new Set(repos.map(key));
    for (const hit of await discoverGitLabByTopic()) if (!known.has(key(hit))) repos.push(hit);
  }

  const have = new Set(repos.map((r) => `${r.owner}/${r.repo}`.toLowerCase()));
  repos = [...repos, ...extraRepos.filter((r) => !have.has(`${r.owner}/${r.repo}`.toLowerCase()))];
  if (excludeRepos?.size) repos = repos.filter((r) => !excludeRepos.has(`${r.owner}/${r.repo}`.toLowerCase()));

  const catalog = await buildExtensionCatalog(repos, siteRoot);
  return {
    ...catalog,
    discoveredRepoCount: repos.length - knownExtensionRepos.length,
    source: 'live',
  };
}
