import { antoraRepoDefault } from '~/lib/antora-compat';
import { parseColorSchemes, type ColorScheme } from '~/lib/color-schemes';
import { readRelations } from '~/lib/pkg-compat';
import { fetchRepoReleaseInfo } from '~/lib/repo-releases';
import fs from 'node:fs';
import path from 'node:path';
import JSON5 from 'json5';
import { appearanceTags } from '~/data/github-topics';
import { parseGitHubUrl, fetchRepoInfo } from '~/lib/github';
import { resolveKnownRepoRef } from '~/lib/repo-identity';
import { liveImages } from '~/lib/preview-check';
import { applyRepoMetadata, finalizeCatalog, readRepoMetadata, type PackageJson } from '~/lib/catalog-enrich';
import { normalizeLayers } from '~/lib/layers';
import { forkAllowed, forkInfoFrom, type CompareFields } from '~/lib/fork-groups';
import { fetchGitLabProject, fetchGitLabRaw, gitlabForkFields, gitlabProjectUrl, gitlabRawBase, isGitHubHost, parseGitLabUrl } from '~/lib/gitlab';
import { registerRawBase } from '~/lib/catalog-enrich';
import type {
  ExtensionCatalogEntry,
  ExtensionDiscoveryResult,
  ForkInfo,
  KnownExtensionRepo,
  RegistryIndex,
  UiModuleManifest,
  UiModulesRegistry,
} from '~/types/ui-module';

const UI_MODULES_ROOT = 'ui-modules';
const REGISTRY_INDEX_PATH = `${UI_MODULES_ROOT}/registry-index.json`;
const REGISTRY_PATH = `${UI_MODULES_ROOT}/registry.json5`;

const BRANCH_CANDIDATES = ['main', 'master'] as const;

export function rawGitHubUrl(
  owner: string,
  repo: string,
  filePath: string,
  branch = 'main',
): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

async function fetchRawText(
  owner: string,
  repo: string,
  filePath: string,
  branch = 'main',
): Promise<string | null> {
  for (const candidate of [branch, ...BRANCH_CANDIDATES]) {
    const url = rawGitHubUrl(owner, repo, filePath, candidate);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Antora-Extensions-Registry' },
      });
      if (response.ok) return await response.text();
    } catch {
      continue;
    }
  }
  return null;
}

function parseJson5<T>(text: string): T {
  return JSON5.parse(text) as T;
}

function repoSlug(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

function catalogId(owner: string, repo: string, moduleId: string): string {
  return `${repoSlug(owner, repo)}/${moduleId}`;
}

function inferTags(entry: {
  id: string;
  name: string;
  description: string;
  type: string;
  requires?: string[];
  partials?: { provide?: string[]; replace?: string[] };
}): string[] {
  const tags = new Set<string>(['ui-module']);
  const text = `${entry.id} ${entry.name} ${entry.description}`.toLowerCase();

  const keywords: Record<string, string[]> = {
    layout: ['layout', 'chrome', 'header', 'nav', 'mast'],
    breadcrumb: ['breadcrumb', 'bc-', 'trail', 'crumb'],
    recipe: ['recipe'],
    fragment: ['fragment', 'cluster'],
  };

  if (entry.type === 'ui-recipe') tags.add('recipe');
  if ((entry.partials?.provide?.length ?? 0) > 0) tags.add('fragment');
  if ((entry.partials?.replace?.length ?? 0) > 0) tags.add('override');
  if ((entry.requires?.length ?? 0) > 0) tags.add('composed');

  for (const [tag, words] of Object.entries(keywords)) {
    if (words.some((word) => text.includes(word))) tags.add(tag);
  }

  return Array.from(tags);
}

function enrichEntry(
  base: Omit<
    ExtensionCatalogEntry,
    'catalogId' | 'tags' | 'stars' | 'author' | 'lastUpdated' | 'githubRepoId' | 'githubTopics'
  >,
  owner: string,
  repo: string,
  repoMeta?: {
    stars: number;
    author: string;
    lastUpdated: string;
    githubRepoId?: number;
    githubTopics?: string[];
  },
): ExtensionCatalogEntry {
  const topicTags = repoMeta?.githubTopics ? appearanceTags(repoMeta.githubTopics) : [];
  return {
    ...base,
    catalogId: catalogId(owner, repo, base.id),
    tags: [...new Set([...inferTags(base), ...topicTags])],
    stars: repoMeta?.stars ?? 0,
    author: repoMeta?.author ?? owner,
    lastUpdated: repoMeta?.lastUpdated ?? new Date().toISOString(),
    githubRepoId: repoMeta?.githubRepoId,
    githubTopics: repoMeta?.githubTopics,
  };
}

function declaredLayerFields(value: unknown): Pick<ExtensionCatalogEntry, 'layers' | 'layerSource'> {
  const layers = normalizeLayers(value);
  return layers.length ? { layers, layerSource: 'declared' } : {};
}

function indexToCatalog(
  index: RegistryIndex,
  owner: string,
  repo: string,
  repoMeta?: {
    stars: number;
    author: string;
    lastUpdated: string;
    githubRepoId?: number;
    githubTopics?: string[];
  },
): { modules: ExtensionCatalogEntry[]; recipes: ExtensionCatalogEntry[] } {
  const repository = index.repository || `https://github.com/${owner}/${repo}`;

  const modules = index.modules.map((mod) =>
    enrichEntry(
      {
        id: mod.id,
        name: mod.name,
        version: mod.version,
        type: 'ui-module',
        description: mod.description,
        repository,
        repositoryOwner: owner,
        repositoryName: repo,
        manifestPath: mod.manifestPath,
        modulePath: mod.modulePath,
        requires: mod.requires ?? [],
        recommends: mod.recommends ?? [],
        conflicts: mod.conflicts ?? [],
        partials: mod.partials,
        slots: mod.slots,
        uiFileCount: mod.uiFileCount,
        install: mod.install,
        ...declaredLayerFields(mod.layers),
      },
      owner,
      repo,
      repoMeta,
    ),
  );

  const recipes = index.recipes.map((recipe) =>
    enrichEntry(
      {
        id: recipe.id,
        name: recipe.name,
        version: recipe.version,
        type: 'ui-recipe',
        description: recipe.description,
        repository,
        repositoryOwner: owner,
        repositoryName: repo,
        manifestPath: recipe.manifestPath,
        requires: [],
        recommends: [],
        conflicts: [],
        modules: recipe.modules,
        install: recipe.install,
        ...declaredLayerFields(recipe.layers),
      },
      owner,
      repo,
      repoMeta,
    ),
  );

  return { modules, recipes };
}

async function buildIndexFromRegistry(
  registry: UiModulesRegistry,
  owner: string,
  repo: string,
  branch: string,
): Promise<RegistryIndex> {
  const repository = registry.repository || `https://github.com/${owner}/${repo}`;
  const modules: RegistryIndex['modules'] = [];
  const recipes: RegistryIndex['recipes'] = [];

  for (const entry of registry.modules) {
    const manifestRel = `${UI_MODULES_ROOT}/${entry.path}/${entry.manifest ?? 'ui-module.json5'}`;
    const manifestText = await fetchRawText(owner, repo, manifestRel, branch);
    if (!manifestText) continue;

    const manifest = parseJson5<UiModuleManifest>(manifestText);
    if (manifest.type !== 'ui-module') continue;

    modules.push({
      id: entry.id,
      name: manifest.name,
      version: manifest.version,
      type: 'ui-module',
      description: manifest.description ?? '',
      repository: manifest.repository ?? repository,
      manifestPath: `${entry.path}/${entry.manifest ?? 'ui-module.json5'}`.replace(/\\/g, '/'),
      modulePath: entry.path,
      requires: manifest.requires ?? [],
      recommends: manifest.recommends ?? [],
      conflicts: manifest.conflicts ?? [],
      partials: manifest.ui?.partials,
      slots: manifest.slots,
      layers: manifest.layers,
      install: {
        orchestrator: {
          registry: `./${REGISTRY_PATH}`,
          modules: [entry.id],
        },
      },
    });
  }

  for (const recipeEntry of registry.recipes ?? []) {
    const recipeRel = `${UI_MODULES_ROOT}/${recipeEntry.path}`;
    const recipeText = await fetchRawText(owner, repo, recipeRel, branch);
    if (!recipeText) continue;

    const recipe = parseJson5<UiModuleManifest>(recipeText);
    if (recipe.type !== 'ui-recipe' || !recipe.modules) continue;

    recipes.push({
      id: recipeEntry.id,
      name: recipe.name,
      version: recipe.version,
      type: 'ui-recipe',
      description: recipe.description ?? '',
      modules: recipe.modules,
      manifestPath: recipeEntry.path,
      layers: recipe.layers,
      install: {
        orchestrator: {
          registry: `./${REGISTRY_PATH}`,
          recipe: recipeEntry.id,
        },
      },
    });
  }

  return {
    schema: registry.schema ?? '1.0',
    repository,
    source: REGISTRY_PATH,
    modules,
    recipes,
  };
}

export async function discoverUiModules(repoUrl: string): Promise<ExtensionDiscoveryResult> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { valid: false, error: 'Invalid GitHub URL format' };
  }

  const { owner, repo } = parsed;
  // GitHub API metadata is optional: unauthenticated calls are rate limited, raw files are not.
  const repoInfo = await fetchRepoInfo(owner, repo);
  const repoMeta = {
    stars: repoInfo?.stargazers_count ?? 0,
    author: repoInfo?.owner.login ?? owner,
    lastUpdated: repoInfo?.updated_at ?? new Date().toISOString(),
  };
  const htmlUrl = repoInfo?.html_url ?? `https://github.com/${owner}/${repo}`;

  const indexText =
    (await fetchRawText(owner, repo, REGISTRY_INDEX_PATH)) ??
    (await fetchRawText(owner, repo, 'registry-index.json'));
  if (indexText) {
    try {
      const index = JSON.parse(indexText) as RegistryIndex;
      const catalog = indexToCatalog(index, owner, repo, repoMeta);
      return {
        valid: true,
        repository: index.repository || htmlUrl,
        source: 'registry-index.json',
        modules: catalog.modules,
        recipes: catalog.recipes,
      };
    } catch {
      return { valid: false, error: 'Failed to parse ui-modules/registry-index.json' };
    }
  }

  const registryText = await fetchRawText(owner, repo, REGISTRY_PATH);
  if (!registryText) {
    return {
      valid: false,
      error: `No UI module catalog found. Add ${REGISTRY_PATH} or run ui-modules:validate to publish registry-index.json.`,
    };
  }

  try {
    const registry = parseJson5<UiModulesRegistry>(registryText);
    if (!Array.isArray(registry.modules) || registry.modules.length === 0) {
      return { valid: false, error: 'registry.json5 contains no modules' };
    }

    const index = await buildIndexFromRegistry(registry, owner, repo, 'main');
    const catalog = indexToCatalog(index, owner, repo, repoMeta);
    return {
      valid: true,
      repository: registry.repository || htmlUrl,
      source: 'registry.json5',
      modules: catalog.modules,
      recipes: catalog.recipes,
    };
  } catch {
    return { valid: false, error: 'Failed to parse ui-modules/registry.json5' };
  }
}

function readLocalRegistryIndex(
  ref: KnownExtensionRepo,
  siteRoot: string,
): RegistryIndex | null {
  if (!ref.localRegistryIndex) return null;
  const indexPath = path.resolve(siteRoot, ref.localRegistryIndex);
  if (!fs.existsSync(indexPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8')) as RegistryIndex;
  } catch {
    return null;
  }
}

export async function indexKnownRepo(
  ref: KnownExtensionRepo,
  siteRoot = process.cwd(),
): Promise<{ modules: ExtensionCatalogEntry[]; recipes: ExtensionCatalogEntry[] }> {
  const resolved = await resolveKnownRepoRef(ref);
  const owner = resolved?.owner ?? ref.owner;
  const repo = resolved?.name ?? ref.repo;
  const repoUrl = resolved?.htmlUrl ?? `https://github.com/${owner}/${repo}`;

  const repoInfo = await fetchRepoInfo(owner, repo);
  const repoMeta = {
    stars: repoInfo?.stargazers_count ?? 0,
    author: repoInfo?.owner.login ?? owner,
    lastUpdated: repoInfo?.updated_at ?? new Date().toISOString(),
    githubRepoId: resolved?.repoId ?? ref.githubRepoId ?? repoInfo?.id,
    githubTopics: ref.githubTopics,
  };

  const localIndex = readLocalRegistryIndex(ref, siteRoot);
  if (localIndex) {
    return indexToCatalog(localIndex, owner, repo, repoMeta);
  }

  const result = await discoverUiModules(repoUrl);
  if (!result.valid) {
    // Preview URLs are built on this branch: the repo's real default branch (e.g. master), or HEAD when the API is unavailable.
    const pkgEntry = await packageJsonEntry(owner, repo, ref.branch ?? repoInfo?.default_branch ?? 'HEAD', repoMeta);
    if (pkgEntry) return { modules: [pkgEntry], recipes: [] };
    console.warn(`Failed to index ${ref.owner}/${ref.repo}: ${result.error}`);
    return { modules: [], recipes: [] };
  }
  return { modules: result.modules ?? [], recipes: result.recipes ?? [] };
}

/**
 * Plain Antora extensions (no ui-modules catalog) are listed from package.json.
 */
async function packageJsonEntry(
  owner: string,
  repo: string,
  branch: string,
  repoMeta: { stars: number; author: string; lastUpdated: string; githubRepoId?: number; githubTopics?: string[] },
  forge?: { fetchText: (path: string) => Promise<string | null>; repoUrl: string },
): Promise<ExtensionCatalogEntry | null> {
  const fetchText = forge?.fetchText ?? ((p: string) => fetchRawText(owner, repo, p, branch));
  const text = await fetchText('package.json');
  if (!text) return null;
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(text);
  } catch {
    return null;
  }
  const base = enrichEntry(
    {
      id: repo,
      name: pkg.name ?? repo,
      version: pkg.version ?? '0.0.0',
      type: 'antora-extension',
      description: pkg.description ?? '',
      repository: forge?.repoUrl ?? `https://github.com/${owner}/${repo}`,
      repositoryOwner: owner,
      repositoryName: repo,
      manifestPath: 'package.json',
      requires: [],
      recommends: [],
      conflicts: [],
    } as Parameters<typeof enrichEntry>[0],
    owner,
    repo,
    repoMeta,
  );
  const meta = await readRepoMetadata(owner, repo, branch, fetchText, pkg);
  const entry = applyRepoMetadata(base, meta, branch);
  if (entry.previews?.length) {
    entry.previews = await liveImages(entry.previews);
    if (!entry.previews.length) delete entry.previews;
  }
  entry.tags = [...new Set(['antora-extension', ...entry.tags.filter((t) => t !== 'ui-module')])];
  return entry;
}

export interface ExtensionCatalogResult {
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
  indexedRepos: Array<{
    /** Omitted for github.com. */
    host?: string;
    owner: string;
    repo: string;
    githubRepoId?: number;
    discoveredVia?: KnownExtensionRepo['discoveredVia'];
    moduleCount: number;
    recipeCount: number;
  }>;
}

function applyRepoCanonicalNames(
  entries: ExtensionCatalogEntry[],
  ref: KnownExtensionRepo,
  owner: string,
  repo: string,
): ExtensionCatalogEntry[] {
  const repository = `https://github.com/${owner}/${repo}`;
  return entries.map((entry) => ({
    ...entry,
    catalogId: `${owner}/${repo}`.toLowerCase() + `/${entry.id}`,
    repository,
    repositoryOwner: owner,
    repositoryName: repo,
    githubRepoId: entry.githubRepoId ?? ref.githubRepoId,
    githubTopics: entry.githubTopics ?? ref.githubTopics,
  }));
}

/** Ahead/behind of a fork's default branch against its source (GitHub compare API); null when unavailable. */
async function fetchCompare(info: { source?: { full_name: string; default_branch?: string }; default_branch?: string }, owner: string): Promise<CompareFields | null> {
  if (!info.source) return null;
  const base = info.source.default_branch ?? 'HEAD';
  const head = `${owner}:${info.default_branch ?? 'HEAD'}`;
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'Antora-Extensions-Registry' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${info.source.full_name}/compare/${encodeURIComponent(base)}...${head}`, { headers });
    return res.ok ? ((await res.json()) as CompareFields) : null;
  } catch {
    return null;
  }
}

/**
 * Cross-host grouping: a repository that is not a GitHub fork but declares `antoraRegistry.upstream`
 * (for example a GitHub copy of a GitLab project) is grouped with that upstream.
 */
export function upstreamFork(e: Pick<ExtensionCatalogEntry, 'upstream'>): ForkInfo | undefined {
  if (!e.upstream) return undefined;
  const gl = parseGitLabUrl(e.upstream);
  const gh = e.upstream.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?]|$)/i);
  const source = gl ? `${gl.host}/${gl.owner}/${gl.repo}` : gh ? `${gh[1]}/${gh[2]}` : undefined;
  return source ? { parent: source, source } : undefined;
}

/** package.json antoraRegistry extras read through a forge's raw-file fetcher. */
async function gitlabExtras(fetchText: (p: string) => Promise<string | null>) {
  let pkg: any = null;
  try { pkg = JSON.parse((await fetchText('package.json')) ?? 'null'); } catch { pkg = null; }
  const antora = antoraRepoDefault(pkg);
  const decl = pkg?.antoraRegistry?.colorSchemes;
  const paths: string[] = (Array.isArray(decl) ? decl : decl ? [decl] : []).filter((p: unknown): p is string => typeof p === 'string').slice(0, 3);
  const colorSchemes: ColorScheme[] = [];
  for (const p of paths) {
    const css = await fetchText(p.replace(/^\.?\//, ''));
    if (css) colorSchemes.push(...parseColorSchemes(css));
  }
  const relations = readRelations(pkg?.antoraRegistry ?? pkg?.['antora-registry']);
  return { antora, colorSchemes, relations };
}

/** GitLab project (gitlab.com or self-hosted): package.json-listed extension, same enrichment as GitHub. */
async function indexGitLabRepo(ref: KnownExtensionRepo): Promise<ExtensionCatalogEntry[] | null> {
  const host = ref.host!.toLowerCase();
  const project = await fetchGitLabProject(host, ref.owner, ref.repo);
  if (!project) {
    console.warn(`[registry] GitLab project ${host}/${ref.owner}/${ref.repo} not found or not public`);
    return null;
  }
  const fields = gitlabForkFields(host, project);
  if (!forkAllowed(fields, ref.discoveredVia)) {
    console.log(`[registry] skipping GitLab fork ${host}/${ref.owner}/${ref.repo}: no antora-extension topic of its own`);
    return null;
  }
  if (fields.archived && ref.discoveredVia !== 'curated') return null;
  const branch = ref.branch ?? project.default_branch ?? 'HEAD';
  registerRawBase(ref.owner, ref.repo, gitlabRawBase(host, ref.owner, ref.repo));
  const repoUrl = project.web_url ?? gitlabProjectUrl(host, ref.owner, ref.repo);
  const entry = await packageJsonEntry(
    ref.owner,
    ref.repo,
    branch,
    { stars: fields.stars, author: fields.owner!.login, lastUpdated: project.last_activity_at ?? new Date().toISOString(), githubTopics: fields.topics },
    { fetchText: (p) => fetchGitLabRaw(host, ref.owner, ref.repo, branch, p), repoUrl },
  );
  if (!entry) {
    console.warn(`[registry] GitLab project ${host}/${ref.owner}/${ref.repo} has no readable package.json on ${branch}`);
    return null;
  }
  const forkOf = fields.fork ? forkInfoFrom(fields, null) : upstreamFork(entry);
  // Same repo-level extras as GitHub (no releases API here): Antora default, relations, declared color schemes.
  const extras = await gitlabExtras((p) => fetchGitLabRaw(host, ref.owner, ref.repo, branch, p));
  return [{
    ...(extras.relations ? { relations: extras.relations } : {}),
    ...entry,
    ...(extras.antora.length ? { antora: extras.antora } : {}),
    ...(extras.colorSchemes.length ? { colorSchemes: extras.colorSchemes } : {}),
    catalogId: `${host}/${ref.owner}/${ref.repo}`.toLowerCase() + `/${entry.id}`,
    repositoryHost: host,
    ...(forkOf ? { forkOf } : {}),
    ...(project.last_activity_at ? { pushedAt: project.last_activity_at } : {}),
  }];
}

export async function buildExtensionCatalog(
  repos: KnownExtensionRepo[],
  siteRoot = process.cwd(),
): Promise<ExtensionCatalogResult> {
  const modules: ExtensionCatalogEntry[] = [];
  const recipes: ExtensionCatalogEntry[] = [];
  const indexedRepos: ExtensionCatalogResult['indexedRepos'] = [];
  const seen = new Set<string>();

  for (const ref of repos) {
    if (!isGitHubHost(ref.host)) {
      const r = await indexGitLabRepo(ref);
      if (!r) continue;
      let n = 0;
      for (const entry of r) {
        if (seen.has(entry.catalogId)) continue;
        seen.add(entry.catalogId);
        modules.push(entry);
        n++;
      }
      if (n) indexedRepos.push({ host: ref.host, owner: ref.owner, repo: ref.repo, discoveredVia: ref.discoveredVia, moduleCount: n, recipeCount: 0 });
      continue;
    }
    const resolved = await resolveKnownRepoRef(ref);
    const owner = resolved?.owner ?? ref.owner;
    const repo = resolved?.name ?? ref.repo;

    const info = await fetchRepoInfo(owner, repo);
    if (info && !forkAllowed(info, ref.discoveredVia)) {
      console.log(`[registry] skipping fork ${owner}/${repo}: no antora-extension topic of its own`);
      continue;
    }
    const forkOf = info ? forkInfoFrom(info, info.fork ? await fetchCompare(info, owner) : null) : undefined;
    const result = await indexKnownRepo(ref, siteRoot);
    const withRepoInfo = (list: ExtensionCatalogEntry[]) =>
      list.map((e) => {
        const declared = forkOf ?? upstreamFork(e);
        return { ...e, ...(declared ? { forkOf: declared } : {}), ...(info?.pushed_at ? { pushedAt: info.pushed_at } : {}) };
      });
    // Releases (per-release Antora compatibility) and declared color schemes; one lookup per repo.
    const extras = info ? await fetchRepoReleaseInfo(owner, repo, info.default_branch ?? 'main') : null;
    // Multi-package repos repeat the list on every entry: keep it short there (newest 12 plus rolling tags).
    const many = result.modules.length + result.recipes.length > 3;
    const repoReleases = extras ? (many ? [...extras.releases.filter((r) => !r.rolling).slice(0, 12), ...extras.releases.filter((r) => r.rolling)] : extras.releases) : [];
    // Repo-level relations describe the whole package: on recipes when the repo has any, else on every entry.
    const relTargets = result.recipes.length ? 'recipes' : 'all';
    const withExtras = (list: ExtensionCatalogEntry[], kind: 'modules' | 'recipes' = 'modules') =>
      extras
        ? list.map((e) => ({
            ...(extras.relations && (relTargets === 'all' || kind === 'recipes') ? { relations: extras.relations } : {}),
            ...e,
            ...(repoReleases.length ? { releases: repoReleases } : {}),
            ...(extras.antora.length ? { antora: extras.antora } : {}),
            ...(extras.colorSchemes.length ? { colorSchemes: extras.colorSchemes } : {}),
          }))
        : list;
    const canonicalModules = withExtras(withRepoInfo(applyRepoCanonicalNames(result.modules, ref, owner, repo)));
    const canonicalRecipes = withExtras(withRepoInfo(applyRepoCanonicalNames(result.recipes, ref, owner, repo)), 'recipes');

    let modCount = 0;
    let recCount = 0;

    for (const entry of canonicalModules) {
      if (seen.has(entry.catalogId)) continue;
      seen.add(entry.catalogId);
      modules.push(entry);
      modCount++;
    }
    for (const entry of canonicalRecipes) {
      if (seen.has(entry.catalogId)) continue;
      seen.add(entry.catalogId);
      recipes.push(entry);
      recCount++;
    }

    if (modCount > 0 || recCount > 0) {
      indexedRepos.push({
        owner,
        repo,
        githubRepoId: resolved?.repoId ?? ref.githubRepoId,
        discoveredVia: ref.discoveredVia,
        moduleCount: modCount,
        recipeCount: recCount,
      });
    }
  }

  const finalized = finalizeCatalog([...modules, ...recipes]);
  const byId = new Map(finalized.map((e) => [e.catalogId, e]));
  return {
    modules: modules.map((e) => byId.get(e.catalogId)!),
    recipes: recipes.map((e) => byId.get(e.catalogId)!),
    indexedRepos,
  };
}

/** Git install spec: `github:owner/repo` on GitHub, `git+https://<host>/<path>.git` on GitLab (incl. self-hosted). */
export function gitInstallSpec(entry: Pick<ExtensionCatalogEntry, 'repositoryOwner' | 'repositoryName' | 'repositoryHost'>): string {
  if (!isGitHubHost(entry.repositoryHost)) return `git+https://${entry.repositoryHost}/${entry.repositoryOwner}/${entry.repositoryName}.git`;
  return `github:${entry.repositoryOwner}/${entry.repositoryName}`;
}

export function formatInstallSnippet(entry: ExtensionCatalogEntry): string {
  const registry = entry.install?.orchestrator?.registry ?? './ui-modules/registry.json5';
  const lines = [
    'antora:',
    '  extensions:',
    '    - require: ./ui-modules/packages/orchestrator/lib/index.js',
    `      registry: ${registry}`,
  ];

  if (entry.type === 'antora-extension') {
    const snippet = ['antora:', '  extensions:', `    - require: '${entry.name}'`];
    if (entry.privatePackage) {
      // Not published to npm: install from the Git repository first.
      return [`# Not on npm yet: pnpm add ${gitInstallSpec(entry)}`, ...snippet].join('\n');
    }
    return snippet.join('\n');
  }

  if (entry.install?.orchestrator?.recipe) {
    lines.push(`      recipe: ${entry.install.orchestrator.recipe}`);
  } else if (entry.type === 'ui-module') {
    lines.push('      modules:');
    lines.push(`        - ${entry.id}`);
  }

  return lines.join('\n');
}
