/**
 * Sync-time metadata: layers, bundle detection and preview images.
 * Declared values come from `antoraRegistry` in package.json or the antora-registry.md frontmatter;
 * anything guessed is marked `inferred` so the UI can say so and admins can override it.
 */
import { inferLayers, normalizeLayers } from '~/lib/layers';
import type { AntoraRegistryMetadata, ExtensionCatalogEntry, PreviewImage } from '~/types/ui-module';

/** A package depending on at least this many indexed extensions is treated as a bundle. */
export const BUNDLE_MIN_INDEXED_DEPS = 3;
const BUNDLE_KEYWORDS = ['antora-bundle', 'compose-pack', 'bundle', 'extension-pack'];
const MAX_README_PREVIEWS = 4;

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  private?: boolean;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  antoraRegistry?: AntoraRegistryMetadata;
}

export interface RepoMetadata {
  declared: AntoraRegistryMetadata;
  keywords: string[];
  dependencyNames: string[];
  privatePackage: boolean;
  homepage?: string;
  readmeImages: PreviewImage[];
}

type FetchText = (path: string) => Promise<string | null>;

/** Reads package.json `antoraRegistry`, antora-registry.md frontmatter and README images. package.json wins per field. */
export async function readRepoMetadata(owner: string, repo: string, branch: string, fetchText: FetchText, pkg?: PackageJson | null): Promise<RepoMetadata> {
  const front = await readRegistryFrontmatter(fetchText);
  const declared: AntoraRegistryMetadata = { ...front, ...(pkg?.antoraRegistry ?? {}) };
  return {
    declared,
    keywords: (pkg?.keywords ?? []).map((k) => String(k).toLowerCase()),
    dependencyNames: Object.keys(pkg?.dependencies ?? {}).filter((n) => n !== pkg?.name),
    privatePackage: pkg?.private === true,
    homepage: pkg?.homepage,
    readmeImages: await readmeImages(owner, repo, branch, fetchText),
  };
}

async function readRegistryFrontmatter(fetchText: FetchText): Promise<AntoraRegistryMetadata> {
  const text = await fetchText('antora-registry.md');
  if (!text) return {};
  try {
    const { default: matter } = await import('gray-matter');
    const data = matter(text).data as Record<string, unknown>;
    return {
      layers: (data.layers as string[] | undefined) ?? (data.layer as string | undefined),
      bundle: data.bundle as AntoraRegistryMetadata['bundle'],
      kind: typeof data.kind === 'string' ? data.kind : undefined,
      purpose: typeof data.purpose === 'string' ? data.purpose : undefined,
      previews: data.previews as AntoraRegistryMetadata['previews'],
      screenshots: data.screenshots as AntoraRegistryMetadata['screenshots'],
    };
  } catch {
    return {};
  }
}

function isBadge(url: string): boolean {
  return /shields\.io|badge|contrib\.rocks|\/actions\/workflows\/|codecov|travis-ci|circleci|badgen|coveralls|gitter/i.test(url);
}

export function resolveRepoUrl(owner: string, repo: string, branch: string, url: string): string | null {
  const u = url.trim();
  if (!u || u.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(u)) {
    const m = u.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}` : u;
  }
  const rel = u.replace(/^\.?\//, '');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rel}`;
}

/** First non-badge images in README.md / README.adoc. */
async function readmeImages(owner: string, repo: string, branch: string, fetchText: FetchText): Promise<PreviewImage[]> {
  const text = (await fetchText('README.md')) ?? (await fetchText('README.adoc'));
  if (!text) return [];
  const found: Array<{ url: string; caption?: string }> = [];
  const patterns: Array<[RegExp, number, number | null]> = [
    [/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, 2, 1],
    [/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*?(?:\balt=["']([^"']*)["'])?/gi, 1, 2],
    [/^image::?([^\s[]+)\[([^\],]*)/gm, 1, 2],
  ];
  for (const [re, urlGroup, altGroup] of patterns) {
    for (const m of text.matchAll(re)) found.push({ url: m[urlGroup], caption: altGroup ? m[altGroup] || undefined : undefined });
  }
  const seen = new Set<string>();
  const out: PreviewImage[] = [];
  for (const f of found) {
    if (isBadge(f.url)) continue;
    const url = resolveRepoUrl(owner, repo, branch, f.url);
    if (!url || seen.has(url) || !/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url)) continue;
    seen.add(url);
    out.push({ url, caption: f.caption, source: 'readme' });
    if (out.length >= MAX_README_PREVIEWS) break;
  }
  return out;
}

function declaredPreviews(owner: string, repo: string, branch: string, d: AntoraRegistryMetadata): PreviewImage[] {
  const list = [...(d.previews ?? []), ...(d.screenshots ?? [])];
  const out: PreviewImage[] = [];
  for (const p of list) {
    const raw = typeof p === 'string' ? p : p?.url ?? p?.src;
    if (!raw) continue;
    const url = resolveRepoUrl(owner, repo, branch, raw);
    if (url) out.push({ url, caption: typeof p === 'string' ? undefined : p.caption ?? p.alt, source: 'manifest' });
  }
  return out;
}

/** Applies declared metadata to an entry. Inferred layers and dependency-based bundles are filled in by finalizeCatalog. */
export function applyRepoMetadata(entry: ExtensionCatalogEntry, meta: RepoMetadata, branch = 'main'): ExtensionCatalogEntry {
  const d = meta.declared;
  const out: ExtensionCatalogEntry = { ...entry, dependencyNames: meta.dependencyNames };
  if (meta.privatePackage) out.privatePackage = true;
  if (meta.homepage) out.homepage = meta.homepage;
  if (!out.layers?.length) {
    const declaredLayers = normalizeLayers(d.layers ?? d.layer);
    if (declaredLayers.length) {
      out.layers = declaredLayers;
      out.layerSource = 'declared';
    }
  }
  const declaredBundle = d.bundle === true || Array.isArray(d.bundle) || d.kind === 'bundle' || d.purpose === 'compose-pack';
  if (declaredBundle) {
    out.bundle = {
      members: Array.isArray(d.bundle) ? d.bundle.map(String) : meta.dependencyNames,
      source: 'declared',
      reason: Array.isArray(d.bundle) || d.bundle === true ? 'antoraRegistry.bundle' : d.kind === 'bundle' ? 'kind: bundle' : 'purpose: compose-pack',
    };
  } else {
    const kw = meta.keywords.find((k) => BUNDLE_KEYWORDS.includes(k));
    if (kw) out.bundle = { members: meta.dependencyNames, source: 'inferred', reason: `keyword "${kw}"` };
  }
  const previews = declaredPreviews(entry.repositoryOwner, entry.repositoryName, branch, d);
  out.previews = previews.length ? previews : meta.readmeImages;
  if (!out.previews.length) delete out.previews;
  return out;
}

/**
 * Catalog-wide pass once every entry is known: dependency-based bundle detection,
 * then inferred layers for anything that declared none (bundles take their members' layers).
 */
export function finalizeCatalog(entries: ExtensionCatalogEntry[]): ExtensionCatalogEntry[] {
  const byName = new Map(entries.map((e) => [e.name.toLowerCase(), e]));
  const withBundles = entries.map((e) => {
    if (e.bundle || !e.dependencyNames?.length) return e;
    const indexed = e.dependencyNames.filter((n) => byName.has(n.toLowerCase()));
    if (indexed.length < BUNDLE_MIN_INDEXED_DEPS) return e;
    return { ...e, bundle: { members: e.dependencyNames, source: 'inferred' as const, reason: `depends on ${indexed.length} indexed extensions` } };
  });
  const lookup = new Map(withBundles.map((e) => [e.name.toLowerCase(), e]));
  return withBundles.map((e) => {
    if (e.layers?.length) return e;
    if (e.bundle) {
      const memberLayers = new Set(e.bundle.members.flatMap((m) => {
        const member = lookup.get(m.toLowerCase());
        return member ? member.layers ?? inferLayers(member) : [];
      }));
      const layers = normalizeLayers([...memberLayers]);
      return layers.length ? { ...e, layers, layerSource: 'inferred' as const } : e;
    }
    const layers = inferLayers(e);
    return layers.length ? { ...e, layers, layerSource: 'inferred' as const } : e;
  });
}
