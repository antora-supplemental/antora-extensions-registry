import { readRelations, type DeclaredRelations } from '~/lib/pkg-compat';
import { antoraRepoDefault, buildReleases, type RawRelease, type ReleaseInfo } from '~/lib/antora-compat';
import { parseColorSchemes, type ColorScheme } from '~/lib/color-schemes';

const API = 'https://api.github.com';

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'Antora-Extensions-Registry' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: headers() });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function rawText(owner: string, repo: string, ref: string, path: string): Promise<string | null> {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`, { headers: { 'User-Agent': 'Antora-Extensions-Registry' } });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

async function rawJson(owner: string, repo: string, ref: string, path: string): Promise<any | null> {
  const t = await rawText(owner, repo, ref, path);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export interface RepoReleaseInfo {
  releases: ReleaseInfo[];
  /** Repo default from package.json antoraRegistry.antora. */
  antora: number[];
  colorSchemes: ColorScheme[];
  /** Declared package relations and contracts (antoraRegistry requires/worksWith/conflictsWith/provides/uses). */
  relations?: DeclaredRelations;
}

/** Releases with per-release Antora compatibility, plus declared color schemes, for a GitHub repo. */
export async function fetchRepoReleaseInfo(owner: string, repo: string, branch: string): Promise<RepoReleaseInfo> {
  const [rels, tags, pkg] = await Promise.all([
    getJson<RawRelease[]>(`${API}/repos/${owner}/${repo}/releases?per_page=100`),
    getJson<Array<{ name: string }>>(`${API}/repos/${owner}/${repo}/tags?per_page=100`),
    rawJson(owner, repo, branch, 'package.json'),
  ]);
  const repoDefault = antoraRepoDefault(pkg);
  const releases = await buildReleases({
    installBase: `github:${owner}/${repo}`,
    releases: rels ?? [],
    tags: (tags ?? []).map((t) => t.name),
    readTagPackage: (tag) => rawJson(owner, repo, tag, 'package.json'),
    repoDefault,
  });
  const decl = pkg?.antoraRegistry?.colorSchemes;
  const paths: string[] = (Array.isArray(decl) ? decl : decl ? [decl] : []).filter((p: unknown): p is string => typeof p === 'string').slice(0, 3);
  const colorSchemes: ColorScheme[] = [];
  for (const p of paths) {
    const css = await rawText(owner, repo, branch, p.replace(/^\.?\//, ''));
    if (css) colorSchemes.push(...parseColorSchemes(css));
  }
  const relations = readRelations(pkg?.antoraRegistry ?? pkg?.['antora-registry']);
  return { releases, antora: repoDefault, colorSchemes, ...(relations ? { relations } : {}) };
}

export interface PackageInfo { packageName?: string; relations?: DeclaredRelations; antora: number[]; releases: ReleaseInfo[]; colorSchemes: ColorScheme[] }

/**
 * Monorepo packages (manifestPath under a subdirectory): each package's own package.json antoraRegistry block,
 * and releases from its `<dir>-v<semver>` tags. Releases and tags are read once for the repo.
 */
export async function fetchMonorepoPackageInfo(
  owner: string,
  repo: string,
  branch: string,
  packages: Array<{ manifestPath: string; modulePath?: string }>,
): Promise<Map<string, PackageInfo>> {
  const out = new Map<string, PackageInfo>();
  const [rels, tags] = await Promise.all([
    getJson<RawRelease[]>(`${API}/repos/${owner}/${repo}/releases?per_page=100`),
    getJson<Array<{ name: string }>>(`${API}/repos/${owner}/${repo}/tags?per_page=100`),
  ]);
  for (const p of packages) {
    const dir = p.modulePath ?? p.manifestPath.replace(/\/?package\.json$/, '');
    const pkg = await rawJson(owner, repo, branch, p.manifestPath);
    if (!pkg) continue;
    const name = dir.split('/').pop()!;
    const repoDefault = antoraRepoDefault(pkg);
    const releases = await buildReleases({
      installBase: `github:${owner}/${repo}`,
      releases: rels ?? [],
      tags: (tags ?? []).map((t) => t.name),
      readTagPackage: (tag) => rawJson(owner, repo, tag, p.manifestPath),
      repoDefault,
      tagPrefix: `${name}-v`,
      installPath: dir,
      max: 12,
    });
    const decl = pkg?.antoraRegistry?.colorSchemes;
    const paths: string[] = (Array.isArray(decl) ? decl : decl ? [decl] : []).filter((x: unknown): x is string => typeof x === 'string').slice(0, 3);
    const colorSchemes: ColorScheme[] = [];
    for (const cp of paths) {
      const css = await rawText(owner, repo, branch, `${dir}/${cp.replace(/^\.?\//, '')}`);
      if (css) colorSchemes.push(...parseColorSchemes(css));
    }
    const relations = readRelations(pkg?.antoraRegistry ?? pkg?.['antora-registry']);
    out.set(p.manifestPath, { ...(typeof pkg.name === 'string' ? { packageName: pkg.name } : {}), antora: repoDefault, releases, colorSchemes, ...(relations ? { relations } : {}) });
  }
  return out;
}
