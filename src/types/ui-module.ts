/** Catalog entry types derived from ui-modules/registry.json5 manifests. */

export type ExtensionKind = 'ui-module' | 'ui-recipe' | 'ui-bundle' | 'antora-extension';

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
  /** ISO date this entry was first listed in the registry (never changes). */
  firstListedAt?: string;
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
  /** Layers from the antora-ui-chassis model (engine, chassis, body-kit, paint, bolt-on). */
  layers?: LayerId[];
  /** Where `layers` came from: the repo declared them, the sync guessed, or an admin set them. */
  layerSource?: MetadataSource;
  /** Set when the entry is a bundle (compose pack) of other extensions. */
  bundle?: BundleInfo;
  /** Preview images for cards and the detail-page gallery. */
  previews?: PreviewImage[];
  /** npm dependency names from package.json (bundle detection, "contains" list). */
  dependencyNames?: string[];
  /** package.json `"private": true`: not on npm, install from the Git repository. */
  privatePackage?: boolean;
  homepage?: string;
  /** Full description: `antoraRegistry.longDescription`, else the README intro. Plain text, paragraphs separated by blank lines. */
  longDescription?: string;
  longDescriptionSource?: 'declared' | 'readme';
}

export type LayerId = 'engine' | 'chassis' | 'body-kit' | 'paint' | 'bolt-on';
export type MetadataSource = 'declared' | 'inferred' | 'admin';

export interface BundleInfo {
  /** Package names (or catalog ids) of the members. */
  members: string[];
  source: MetadataSource;
  /** Why the sync decided this is a bundle, e.g. "depends on 5 indexed extensions". */
  reason?: string;
}

export interface PreviewImage {
  url: string;
  caption?: string;
  /** manifest = antoraRegistry.previews / antora-registry.md screenshots; readme = first README images; upload = added in /admin. */
  source: 'manifest' | 'readme' | 'upload' | 'curated';
}

/** The `antoraRegistry` block in package.json (or the antora-registry.md frontmatter). */
export interface AntoraRegistryMetadata {
  layers?: string[] | string;
  layer?: string;
  /** `true`, or the member package names. */
  bundle?: boolean | string[];
  kind?: string;
  purpose?: string;
  previews?: Array<string | { url?: string; src?: string; caption?: string; alt?: string }>;
  screenshots?: Array<string | { url?: string; src?: string; caption?: string; alt?: string }>;
  /** Full description shown below the summary. Paragraphs separated by blank lines; `code` spans allowed. */
  longDescription?: string;
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
    /** Declared layers (see lib/layers.ts). */
    layers?: string[];
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
    layers?: string[];
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
  /** Declared layers (see lib/layers.ts). */
  layers?: string[];
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
