/**
 * Antora version compatibility per release.
 *
 * Precedence, first hit wins, per release:
 *  1. SemVer build metadata on the tag: `v4.2.0+antora.3` (or an alias tag `vX.Y.Z+antora.N` on the same version).
 *     `+antora-solid` and `+antora.solid` mean Antora 4.
 *  2. `antora` in package.json `engines` at that tag (a semver range, e.g. ">=3 <4" or "^4").
 *  3. package.json `peerDependencies` on `@antora/*` or `antora` at that tag.
 *  4. Repository default: `antoraRegistry.antora` in package.json on the default branch (e.g. "3" or [3, 4]).
 *  5. Otherwise the release is listed with no Antora line ("unknown"); nothing is guessed.
 */
export const ANTORA_LINES = [
  { major: 3, label: 'Antora 3', codename: undefined as string | undefined, current: true },
  { major: 4, label: 'Antora 4', codename: 'antora-solid', current: false },
] as const;

export type AntoraCompatSource = 'build-metadata' | 'engines' | 'peer-dependencies' | 'repo-default';

export interface ReleaseAsset { name: string; url: string }

export interface ReleaseInfo {
  tag: string;
  /** SemVer without the leading v and without build metadata, e.g. 4.2.0; rolling tags keep their prefix (4, 4.2). */
  version: string;
  /** Moving alias such as v4 or v4.2 that tracks the newest matching release. */
  rolling: boolean;
  prerelease: boolean;
  publishedAt?: string;
  htmlUrl?: string;
  /** Antora majors this release targets; empty when undeclared. */
  antora: number[];
  antoraSource?: AntoraCompatSource;
  /** e.g. 4.2.0+antora.3 */
  label?: string;
  /** Git install spec pinned to this tag, e.g. github:owner/repo#v4.2.0 */
  installSpec: string;
  /** Release assets (UI bundles); ui-bundle.zip first. */
  assets: ReleaseAsset[];
}

export function antoraLineLabel(major: number): string {
  const l = ANTORA_LINES.find((x) => x.major === major);
  return l ? (l.codename ? `${l.label} (${l.codename})` : l.label) : `Antora ${major}`;
}

/** `+antora.3`, `+antora-3`, `+antora-solid`, `+antora.solid` -> major. */
export function antoraFromBuildMetadata(tag: string): number | null {
  const m = tag.match(/\+(?:.*\.)?antora[.-]?(\d+|solid)\b/i);
  if (!m) return null;
  return m[1].toLowerCase() === 'solid' ? 4 : Number(m[1]);
}

/** Majors a simple npm range allows, limited to known Antora lines (2..9). */
export function majorsFromRange(range: string | undefined | null): number[] {
  if (!range || typeof range !== 'string') return [];
  if (/^\s*(\*|x|latest)\s*$/i.test(range)) return [];
  const out = new Set<number>();
  for (const part of range.split('||')) {
    const nums = [...part.matchAll(/(>=|<=|>|<|\^|~|=)?\s*v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/g)];
    if (!nums.length) continue;
    let lo = 0;
    let hi = 99;
    let exact: number | null = null;
    for (const [, op, maj, min, pat] of nums) {
      const n = Number(maj);
      if (op === '>=') lo = Math.max(lo, n);
      else if (op === '>') lo = Math.max(lo, (min && min !== '0') || (pat && pat !== '0') ? n : n + 1);
      else if (op === '<') hi = Math.min(hi, (min && min !== '0') || (pat && pat !== '0') ? n : n - 1);
      else if (op === '<=') hi = Math.min(hi, n);
      else exact = n; // ^, ~, =, bare
    }
    if (exact !== null) out.add(exact);
    else for (let i = Math.max(lo, 2); i <= Math.min(hi, 9); i++) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

interface PkgCompat {
  engines?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  antoraRegistry?: { antora?: unknown };
}

export function antoraFromEngines(pkg: PkgCompat | null | undefined): number[] {
  return majorsFromRange(pkg?.engines?.antora);
}

export function antoraFromPeerDeps(pkg: PkgCompat | null | undefined): number[] {
  const peers = pkg?.peerDependencies ?? {};
  const out = new Set<number>();
  for (const [name, range] of Object.entries(peers)) {
    if (name === 'antora' || name.startsWith('@antora/')) {
      // @antora/lunr-extension etc. version independently; only the core packages name the Antora line.
      if (!/^(antora|@antora\/(site-generator|site-generator-default|cli|playbook-builder|content-aggregator|ui-loader|asciidoc-loader|navigation-builder|page-composer|site-mapper|site-publisher|logger|user-require-helper))$/.test(name)) continue;
      for (const m of majorsFromRange(range)) out.add(m);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function antoraRepoDefault(pkg: PkgCompat | null | undefined): number[] {
  const v = pkg?.antoraRegistry?.antora;
  const list = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
  const out = new Set<number>();
  for (const x of list) {
    const s = String(x).toLowerCase().trim();
    if (s === 'antora-solid' || s === 'solid') out.add(4);
    else for (const m of majorsFromRange(s)) out.add(m);
  }
  return [...out].sort((a, b) => a - b);
}

/** Resolves one release's compatibility from the precedence list. */
export function resolveCompat(
  tag: string,
  tagPkg: PkgCompat | null | undefined,
  repoDefault: number[],
  aliasMajor?: number | null,
): { antora: number[]; source?: AntoraCompatSource } {
  const meta = antoraFromBuildMetadata(tag) ?? aliasMajor ?? null;
  if (meta !== null) return { antora: [meta], source: 'build-metadata' };
  const eng = antoraFromEngines(tagPkg);
  if (eng.length) return { antora: eng, source: 'engines' };
  const peer = antoraFromPeerDeps(tagPkg);
  if (peer.length) return { antora: peer, source: 'peer-dependencies' };
  if (repoDefault.length) return { antora: repoDefault, source: 'repo-default' };
  return { antora: [] };
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const ROLLING = /^v?(\d+)(?:\.(\d+))?$/;

export function parseTag(tag: string): { version: string; rolling: boolean; key: number[] } | null {
  const s = tag.match(SEMVER);
  if (s) return { version: `${s[1]}.${s[2]}.${s[3]}${s[4] ?? ''}`, rolling: false, key: [+s[1], +s[2], +s[3], s[4] ? 0 : 1] };
  const r = tag.match(ROLLING);
  if (r) return { version: r[2] === undefined ? r[1] : `${r[1]}.${r[2]}`, rolling: true, key: [+r[1], r[2] === undefined ? 9999 : +r[2], 9999, 1] };
  return null;
}

export function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}

export interface RawRelease { tag_name: string; prerelease?: boolean; draft?: boolean; published_at?: string; html_url?: string; assets?: Array<{ name: string; browser_download_url: string }> }

/**
 * Builds the release list from GitHub releases and tags. Tags with `+antora.N` build metadata that alias a plain
 * release (`v4.2.0+antora.3` next to `v4.2.0`) set that release's Antora line and are not listed twice.
 * Rolling tags (v4, v4.2) take the compatibility of the newest full release they cover.
 */
export async function buildReleases(opts: {
  installBase: string; // e.g. github:owner/repo
  releases: RawRelease[];
  tags: string[];
  readTagPackage: (tag: string) => Promise<PkgCompat | null>;
  repoDefault: number[];
  max?: number;
}): Promise<ReleaseInfo[]> {
  const max = opts.max ?? 40;
  const aliasMajor = new Map<string, number>();
  for (const t of opts.tags) {
    const m = antoraFromBuildMetadata(t);
    const p = parseTag(t.replace(/\+.*$/, ''));
    if (m !== null && p && !p.rolling) aliasMajor.set(p.version, m);
  }
  const byTag = new Map<string, RawRelease>();
  for (const r of opts.releases) if (!r.draft) byTag.set(r.tag_name, r);
  // Tags without a release: only full semver ones that are not +antora aliases of another tag.
  for (const t of opts.tags) {
    if (byTag.has(t)) continue;
    const p = parseTag(t);
    if (!p || p.rolling) continue;
    if (t.includes('+') && opts.tags.includes(t.replace(/\+.*$/, ''))) continue;
    byTag.set(t, { tag_name: t });
  }
  const parsed = [...byTag.values()]
    .map((r) => ({ r, p: parseTag(r.tag_name) }))
    .filter((x): x is { r: RawRelease; p: NonNullable<ReturnType<typeof parseTag>> } => Boolean(x.p))
    .sort((a, b) => compareKeys(b.p.key, a.p.key));
  const full = parsed.filter((x) => !x.p.rolling).slice(0, max);
  const out: ReleaseInfo[] = [];
  let pkgReads = 0;
  for (const { r, p } of full) {
    const alias = aliasMajor.get(p.version) ?? null;
    const needPkg = antoraFromBuildMetadata(r.tag_name) === null && alias === null;
    const pkg = needPkg && pkgReads++ < 15 ? await opts.readTagPackage(r.tag_name) : null;
    const c = resolveCompat(r.tag_name, pkg, opts.repoDefault, alias);
    out.push(toInfo(r, p, c, opts.installBase));
  }
  for (const { r, p } of parsed.filter((x) => x.p.rolling)) {
    const prefix = `${p.version}.`;
    const target = out.find((x) => !x.rolling && !x.prerelease && x.version.startsWith(prefix) && !x.version.includes('-'));
    const c = target ? { antora: target.antora, source: target.antoraSource } : resolveCompat(r.tag_name, null, opts.repoDefault);
    out.push({ ...toInfo(r, p, c, opts.installBase), prerelease: false, ...(target ? { label: `tracks ${target.version}` } : {}) });
  }
  return out;
}

function toInfo(r: RawRelease, p: { version: string; rolling: boolean }, c: { antora: number[]; source?: AntoraCompatSource }, installBase: string): ReleaseInfo {
  const assets = (r.assets ?? [])
    .map((a) => ({ name: a.name, url: a.browser_download_url }))
    .sort((a, b) => (a.name === 'ui-bundle.zip' ? -1 : b.name === 'ui-bundle.zip' ? 1 : a.name.localeCompare(b.name)));
  return {
    tag: r.tag_name,
    version: p.version,
    rolling: p.rolling,
    prerelease: Boolean(r.prerelease) && !p.rolling,
    ...(r.published_at ? { publishedAt: r.published_at } : {}),
    ...(r.html_url ? { htmlUrl: r.html_url } : {}),
    antora: c.antora,
    ...(c.source ? { antoraSource: c.source } : {}),
    ...(c.antora.length === 1 && !p.rolling ? { label: `${p.version}+antora.${c.antora[0]}` } : {}),
    installSpec: `${installBase}#${r.tag_name}`,
    assets,
  };
}

/** Releases grouped by Antora major (newest line first); "unknown" collects undeclared releases. */
export function groupByAntora(releases: ReleaseInfo[]): Array<{ major: number | null; latest?: ReleaseInfo; releases: ReleaseInfo[] }> {
  const groups = new Map<number | null, ReleaseInfo[]>();
  for (const r of releases) {
    const keys = r.antora.length ? r.antora : [null];
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (b ?? -1) - (a ?? -1))
    .map(([major, list]) => {
      const sorted = [...list].sort((a, b) => compareKeys(parseTag(b.tag)!.key, parseTag(a.tag)!.key));
      return { major, latest: sorted.find((x) => !x.rolling && !x.prerelease) ?? sorted[0], releases: sorted };
    });
}

/** Union of Antora majors over the entry's releases (or the repo default when it has none). */
export function antoraMajorsOf(e: { releases?: ReleaseInfo[]; antora?: number[] }): number[] {
  const s = new Set<number>(e.antora ?? []);
  for (const r of e.releases ?? []) for (const m of r.antora) s.add(m);
  return [...s].sort((a, b) => a - b);
}
