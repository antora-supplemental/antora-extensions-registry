import fs from 'node:fs';
import path from 'node:path';
import JSON5 from 'json5';
import { appearanceTags } from '~/data/github-topics';
import { parseGitHubUrl, fetchRepoInfo } from '~/lib/github';
import { resolveKnownRepoRef } from '~/lib/repo-identity';
import type {
  ExtensionCatalogEntry,
  ExtensionDiscoveryResult,
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
    dark: ['dark', 'theme', 'toggle'],
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
  const repoInfo = await fetchRepoInfo(owner, repo);
  if (!repoInfo) {
    return { valid: false, error: 'Repository not found or not accessible' };
  }

  const repoMeta = {
    stars: repoInfo.stargazers_count,
    author: repoInfo.owner.login,
    lastUpdated: repoInfo.updated_at,
  };

  const indexText = await fetchRawText(owner, repo, REGISTRY_INDEX_PATH);
  if (indexText) {
    try {
      const index = JSON.parse(indexText) as RegistryIndex;
      const catalog = indexToCatalog(index, owner, repo, repoMeta);
      return {
        valid: true,
        repository: index.repository || repoInfo.html_url,
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
      repository: registry.repository || repoInfo.html_url,
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
    console.warn(`Failed to index ${ref.owner}/${ref.repo}: ${result.error}`);
    return { modules: [], recipes: [] };
  }
  return { modules: result.modules ?? [], recipes: result.recipes ?? [] };
}

export interface ExtensionCatalogResult {
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
  indexedRepos: Array<{
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

export async function buildExtensionCatalog(
  repos: KnownExtensionRepo[],
  siteRoot = process.cwd(),
): Promise<ExtensionCatalogResult> {
  const modules: ExtensionCatalogEntry[] = [];
  const recipes: ExtensionCatalogEntry[] = [];
  const indexedRepos: ExtensionCatalogResult['indexedRepos'] = [];
  const seen = new Set<string>();

  for (const ref of repos) {
    const resolved = await resolveKnownRepoRef(ref);
    const owner = resolved?.owner ?? ref.owner;
    const repo = resolved?.name ?? ref.repo;

    const result = await indexKnownRepo(ref, siteRoot);
    const canonicalModules = applyRepoCanonicalNames(result.modules, ref, owner, repo);
    const canonicalRecipes = applyRepoCanonicalNames(result.recipes, ref, owner, repo);

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

  return { modules, recipes, indexedRepos };
}

export function formatInstallSnippet(entry: ExtensionCatalogEntry): string {
  const registry = entry.install?.orchestrator?.registry ?? './ui-modules/registry.json5';
  const lines = [
    'antora:',
    '  extensions:',
    '    - require: ./ui-modules/packages/orchestrator/lib/index.js',
    `      registry: ${registry}`,
  ];

  if (entry.install?.orchestrator?.recipe) {
    lines.push(`      recipe: ${entry.install.orchestrator.recipe}`);
  } else if (entry.type === 'ui-module') {
    lines.push('      modules:');
    lines.push(`        - ${entry.id}`);
  }

  return lines.join('\n');
}
