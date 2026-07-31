/** Catalog entry types derived from ui-modules/registry.json5 manifests. */

export type ExtensionKind = 'ui-module' | 'ui-recipe' | 'ui-bundle';

export interface UiModuleSlots {
  head?: {
    scripts?: string[];
    stylesheets?: string[];
    fragments?: string[];
  };
  foot?: {
    scripts?: string[];
  };
}

export interface UiModulePartials {
  provide?: string[];
  replace?: string[];
}

export interface UiModuleInstall {
  orchestrator?: {
    registry: string;
    modules?: string[];
    recipe?: string;
  };
}

/** Single module or recipe row in the extensions catalog. */
export interface ExtensionCatalogEntry {
  /** Globally unique id: `{repoSlug}/{moduleId}` */
  catalogId: string;
  id: string;
  name: string;
  version: string;
  type: ExtensionKind;
  description: string;
  repository: string;
  repositoryOwner: string;
  repositoryName: string;
  manifestPath: string;
  modulePath?: string;
  requires: string[];
  recommends: string[];
  conflicts: string[];
  partials?: UiModulePartials;
  slots?: UiModuleSlots;
  modules?: string[];
  uiFileCount?: number;
  install?: UiModuleInstall;
  tags: string[];
  stars: number;
  author: string;
  lastUpdated: string;
  githubRepoId?: number;
  githubTopics?: string[];
}

export interface RegistryModuleRef {
  id: string;
  path: string;
  manifest?: string;
}

export interface RegistryRecipeRef {
  id: string;
  path: string;
}

export interface UiModulesRegistry {
  schema?: string;
  repository?: string;
  modules: RegistryModuleRef[];
  recipes?: RegistryRecipeRef[];
}

export interface RegistryIndex {
  schema: string;
  generatedAt?: string;
  repository: string;
  source: string;
  modules: Array<{
    id: string;
    name: string;
    version: string;
    type: 'ui-module';
    description: string;
    repository: string;
    manifestPath: string;
    modulePath: string;
    requires: string[];
    recommends: string[];
    conflicts: string[];
    partials?: UiModulePartials;
    slots?: UiModuleSlots;
    uiFileCount?: number;
    install?: UiModuleInstall;
  }>;
  recipes: Array<{
    id: string;
    name: string;
    version: string;
    type: 'ui-recipe';
    description: string;
    modules: string[];
    manifestPath: string;
    install?: UiModuleInstall;
  }>;
}

export interface UiModuleManifest {
  id: string;
  name: string;
  version: string;
  type: 'ui-module' | 'ui-recipe';
  description?: string;
  repository?: string;
  requires?: string[];
  recommends?: string[];
  conflicts?: string[];
  modules?: string[];
  slots?: UiModuleSlots;
  ui?: {
    partials?: UiModulePartials;
  };
}

export interface ExtensionDiscoveryResult {
  valid: boolean;
  error?: string;
  repository?: string;
  source?: 'registry-index.json' | 'registry.json5';
  modules?: ExtensionCatalogEntry[];
  recipes?: ExtensionCatalogEntry[];
}

export interface KnownExtensionRepo {
  owner: string;
  repo: string;
  branch?: string;
  /** Monorepo dev fallback: path to registry-index.json relative to site root */
  localRegistryIndex?: string;
  /** How this repo entered the catalog */
  discoveredVia?: 'curated' | 'github-topic' | 'submission';
  /** Topics on the repo when discovered via GitHub */
  githubTopics?: string[];
  /** Stable GitHub repo id — survives renames within GitHub */
  githubRepoId?: number;
}
