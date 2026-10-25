import type { ExtensionCatalogEntry, ForkInfo } from '~/types/ui-module';

/** Minimal GitHub repo fields used for fork detection (GET /repos/{owner}/{repo}). */
export interface RepoForkFields {
  fork?: boolean;
  default_branch?: string;
  pushed_at?: string;
  topics?: string[];
  owner?: { login: string };
  parent?: { full_name: string; default_branch?: string };
  source?: { full_name: string; default_branch?: string };
}

/** GitHub compare API fields (GET /repos/{source}/compare/{base}...{fork owner}:{head}). */
export interface CompareFields {
  ahead_by?: number;
  behind_by?: number;
  html_url?: string;
}

/**
 * Forks are listed only when they carry their own `antora-extension` topic (topics are not copied to forks,
 * so the topic is explicit intent). Curated (seed list) repositories are always allowed.
 */
export function forkAllowed(repo: RepoForkFields, discoveredVia?: string): boolean {
  if (!repo.fork) return true;
  if (discoveredVia === 'curated') return true;
  return (repo.topics ?? []).map((t) => t.toLowerCase()).includes('antora-extension');
}

/** Fork metadata for a catalog entry, or undefined when the repository is not a fork. */
export function forkInfoFrom(repo: RepoForkFields, compare?: CompareFields | null): ForkInfo | undefined {
  if (!repo.fork || !repo.source) return undefined;
  const info: ForkInfo = { parent: repo.parent?.full_name ?? repo.source.full_name, source: repo.source.full_name };
  if (compare && typeof compare.ahead_by === 'number') info.aheadBy = compare.ahead_by;
  if (compare && typeof compare.behind_by === 'number') info.behindBy = compare.behind_by;
  if (compare?.html_url) info.compareUrl = compare.html_url;
  return info;
}

/** Same upstream repository and same module = same group. Plain package.json entries match by repository only. */
export function forkGroupKey(e: ExtensionCatalogEntry): string {
  const repo = (e.forkOf?.source ?? `${e.repositoryOwner}/${e.repositoryName}`).toLowerCase();
  return `${repo}::${e.manifestPath === 'package.json' ? '*' : e.id.toLowerCase()}`;
}

const byStars = (a: ExtensionCatalogEntry, b: ExtensionCatalogEntry) => (b.stars ?? 0) - (a.stars ?? 0) || a.catalogId.localeCompare(b.catalogId);

/** Every version of `entry` in the catalog: the upstream first (when listed), then forks by stars. */
export function forkVariants(entry: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): ExtensionCatalogEntry[] {
  const key = forkGroupKey(entry);
  const group = all.filter((e) => forkGroupKey(e) === key);
  return [...group.filter((e) => !e.forkOf).sort(byStars), ...group.filter((e) => e.forkOf).sort(byStars)];
}

/** One entry per fork group (the upstream, else the most-starred fork), with the number of other versions. */
export function collapseForks(entries: ExtensionCatalogEntry[], all: ExtensionCatalogEntry[] = entries): Array<{ entry: ExtensionCatalogEntry; forkCount: number }> {
  const out: Array<{ entry: ExtensionCatalogEntry; forkCount: number }> = [];
  const done = new Set<string>();
  for (const e of entries) {
    const key = forkGroupKey(e);
    if (done.has(key)) continue;
    done.add(key);
    const variants = forkVariants(e, all);
    const visible = variants.filter((v) => entries.includes(v));
    out.push({ entry: visible[0] ?? e, forkCount: variants.length - 1 });
  }
  return out;
}

/** npm name when the package is published under its own name (not private, scoped or bare package name). */
export function publishedName(e: ExtensionCatalogEntry): string | undefined {
  if (e.privatePackage || e.manifestPath !== 'package.json') return undefined;
  return /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(e.name) ? e.name : undefined;
}