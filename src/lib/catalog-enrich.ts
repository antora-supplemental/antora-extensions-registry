import { matchPackage } from './bundle-members';
import { liveImages } from '~/lib/preview-check';
/**
 * Sync-time metadata: layers, bundle detection and preview images.
 * Declared values come from `antoraRegistry` in package.json or the antora-registry.md frontmatter;
 * anything guessed is marked `inferred` so the UI can say so and admins can override it.
 */
import { classifyEntry, inferLayers, normalizeLayers } from '~/lib/layers';
import type { AntoraRegistryMetadata, ExtensionCatalogEntry, PreviewImage } from '~/types/ui-module';

/** A package depending on at least this many indexed extensions is treated as a bundle. */
export const BUNDLE_MIN_INDEXED_DEPS = 3;
const BUNDLE_KEYWORDS = ['antora-bundle', 'compose-pack', 'bundle', 'extension-pack'];
const MAX_README_PREVIEWS = 4;
const MAX_INTRO_PARAGRAPHS = 3;

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
  dependencySpecs: Record<string, string>;
  privatePackage: boolean;
  homepage?: string;
  readmeImages: PreviewImage[];
  readmeIntro?: string;
}

type FetchText = (path: string) => Promise<string | null>;

/** Reads package.json `antoraRegistry`, antora-registry.md frontmatter and README images. package.json wins per field. */
export async function readRepoMetadata(owner: string, repo: string, branch: string, fetchText: FetchText, pkg?: PackageJson | null): Promise<RepoMetadata> {
  const front = await readRegistryFrontmatter(fetchText);
  const declared: AntoraRegistryMetadata = { ...front, ...(pkg?.antoraRegistry ?? {}) };
  const md = await fetchText('README.md');
  const readme = md ?? (await fetchText('README.adoc'));
  return {
    declared,
    keywords: (pkg?.keywords ?? []).map((k) => String(k).toLowerCase()),
    dependencyNames: Object.keys(pkg?.dependencies ?? {}).filter((n) => n !== pkg?.name),
    dependencySpecs: Object.fromEntries(Object.entries(pkg?.dependencies ?? {}).filter(([n]) => n !== pkg?.name).map(([n, v]) => [n, String(v)])),
    privatePackage: pkg?.private === true,
    homepage: pkg?.homepage,
    readmeImages: await liveImages(readmeImages(owner, repo, branch, readme, md === null), MAX_README_PREVIEWS),
    readmeIntro: readme ? readmeIntro(readme) : undefined,
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
      longDescription: typeof data.longDescription === 'string' ? data.longDescription : undefined,
    };
  } catch {
    return {};
  }
}

function isBadge(url: string): boolean {
  return /shields\.io|badge|contrib\.rocks|\/actions\/workflows\/|codecov|travis-ci|circleci|badgen|coveralls|gitter/i.test(url);
}

/**
 * Raw-file base per repository for non-GitHub forges (GitLab registers `https://<host>/<path>/-/raw/`).
 * Everything that builds preview URLs goes through resolveRepoUrl, so registering the base is enough.
 */
const rawBases = new Map<string, string>();
export function registerRawBase(owner: string, repo: string, base: string): void {
  rawBases.set(`/${repo}`.toLowerCase(), base);
}

export function resolveRepoUrl(owner: string, repo: string, branch: string, url: string): string | null {
  const u = url.trim();
  if (!u || u.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(u)) {
    const m = u.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
    // GitLab blob links -> raw (gitlab.com or self-hosted: /-/blob/ is GitLab-specific).
    const g = u.match(/^(https?:\/\/[^/]+\/.+?)\/-\/blob\/(.+)$/);
    return g ? `${g[1]}/-/raw/${g[2]}` : u;
  }
  const rel = u.replace(/^\.?\//, '');
  const base = rawBases.get(`/${repo}`.toLowerCase());
  return base ? `${base}${branch}/${rel}` : `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rel}`;
}

/**
 * README intro: the prose before the first second-level heading (`==` / `##`), without the title,
 * attributes, badges, images, HTML or admonition blocks. At most MAX_INTRO_PARAGRAPHS paragraphs, as plain text.
 */
export function readmeIntro(text: string): string | undefined {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const body: string[] = [];
  for (const line of lines) {
    if (/^(==|##)\s/.test(line)) break;
    body.push(line);
  }
  const paragraphs = body
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(=\s|#\s|:|image::?|!\[|\[!|<|\[|\/\/|ifn?def::|include::|----|\.\.\.\.|\|===)/.test(p))
    .filter((p) => !/^[A-Za-z ]+:\s*\S+@\S+$/.test(p))
    // Lists, and the lead-in sentence that introduces one, are not intro prose.
    .filter((p) => !/^([*-]|\.|\d+\.)\s/.test(p) && !/:$/.test(p))
    .map((p) =>
      p
        .replace(/image:[^\s[]+\[[^\]]*\]/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/(?:link:)?https?:\/\/[^\s[]+\[([^\]]+)\]/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1$2')
        .replace(/\s*\n\s*/g, ' ')
        .trim(),
    )
    .filter((p) => p.length >= 40);
  return paragraphs.length ? paragraphs.slice(0, MAX_INTRO_PARAGRAPHS).join('\n\n') : undefined;
}

/** Joins a relative image target onto a repo directory and normalises ./ and ../ segments. */
function joinRepoPath(dir: string, target: string): string {
  const out: string[] = [];
  for (const seg of `${dir}/${target}`.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

function isRelativeTarget(url: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|\/|#|\{)/i.test(url.trim());
}

/**
 * First non-badge images in README.md / README.adoc. Relative paths resolve against `readmeDir` (the README's
 * folder; '' for the repository root), and AsciiDoc `image::` targets also go through `:imagesdir:`.
 * Returns up to twice MAX_README_PREVIEWS candidates; liveImages drops dead ones and applies the cap.
 */
export function readmeImages(owner: string, repo: string, branch: string, text: string | null, adoc = false, readmeDir = ''): PreviewImage[] {
  if (!text) return [];
  const imagesdir = adoc ? text.match(/^:imagesdir:[ \t]*(\S.*?)[ \t]*$/m)?.[1] ?? '' : '';
  const found: Array<{ url: string; caption?: string }> = [];
  const patterns: Array<[RegExp, number, number | null, boolean]> = [
    [/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, 2, 1, false],
    [/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*?(?:\balt=["']([^"']*)["'])?/gi, 1, 2, false],
    [/^image::?([^\s[]+)\[([^\],]*)/gm, 1, 2, true],
  ];
  for (const [re, urlGroup, altGroup, usesImagesdir] of patterns) {
    for (const m of text.matchAll(re)) {
      const raw = m[urlGroup];
      const dir = joinRepoPath(readmeDir, usesImagesdir ? imagesdir : '');
      const url = dir && isRelativeTarget(raw) ? joinRepoPath(dir, raw) : raw;
      found.push({ url, caption: altGroup ? m[altGroup] || undefined : undefined });
    }
  }
  const seen = new Set<string>();
  const out: PreviewImage[] = [];
  for (const f of found) {
    if (isBadge(f.url)) continue;
    const url = resolveRepoUrl(owner, repo, branch, f.url);
    if (!url || seen.has(url) || !/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url)) continue;
    seen.add(url);
    out.push({ url, caption: f.caption, source: 'readme' });
    if (out.length >= MAX_README_PREVIEWS * 2) break;
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
  if (Object.keys(meta.dependencySpecs ?? {}).length) out.dependencySpecs = meta.dependencySpecs;
  if (meta.privatePackage) out.privatePackage = true;
  if (meta.homepage) out.homepage = meta.homepage;
  if (typeof d.upstream === 'string' && d.upstream.trim()) out.upstream = d.upstream.trim();
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
  const declaredLong = typeof d.longDescription === 'string' ? d.longDescription.trim() : '';
  if (declaredLong) {
    out.longDescription = declaredLong;
    out.longDescriptionSource = 'declared';
  } else if (meta.readmeIntro) {
    out.longDescription = meta.readmeIntro;
    out.longDescriptionSource = 'readme';
  }
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
    const indexed = e.dependencyNames.filter((n) => byName.has(n.toLowerCase()) || matchPackage(n, entries));
    if (indexed.length < BUNDLE_MIN_INDEXED_DEPS) return e;
    return { ...e, bundle: { members: e.dependencyNames, source: 'inferred' as const, reason: `depends on ${indexed.length} indexed extensions` } };
  });
  const lookup = new Map(withBundles.map((e) => [e.name.toLowerCase(), e]));
  return withBundles.map((e) => {
    if (e.layerSource === 'declared' || e.layerSource === 'admin') return e;
    if (e.bundle) {
      const memberLayers = new Set(e.bundle.members.flatMap((m) => {
        const member = lookup.get(m.toLowerCase()) ?? matchPackage(m, withBundles);
        return member ? member.layers ?? inferLayers(member) : [];
      }));
      const layers = normalizeLayers([...memberLayers]);
      return layers.length ? { ...e, layers, layerSource: 'inferred' as const } : e;
    }
    return classifyEntry(e);
  });
}
