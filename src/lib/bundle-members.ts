import type { ExtensionCatalogEntry } from '~/types/ui-module';

/** `@scope/name` -> `scope` (lower case); undefined for unscoped names. */
export function packageScope(name: string): string | undefined {
  const m = /^@([^/]+)\//.exec(name.trim());
  return m ? m[1].toLowerCase() : undefined;
}

/** `@scope/name` -> `name`; unscoped names unchanged (lower case). */
export function unscopedName(name: string): string {
  return name.trim().replace(/^@[^/]+\//, '').toLowerCase();
}

/**
 * Find the catalog entry for a package name from package.json `dependencies`.
 * Catalog `name` is often a display name (`Chassis compose`) rather than the npm name,
 * so after an exact name match this falls back to `@<repo owner>/<module id or repo name>`.
 */
export function matchPackage(name: string, all: ExtensionCatalogEntry[]): ExtensionCatalogEntry | undefined {
  const lower = name.trim().toLowerCase();
  const exact = all.find((e) => e.name.toLowerCase() === lower || e.catalogId.toLowerCase() === lower);
  if (exact) return exact;
  const scope = packageScope(name);
  if (!scope) return undefined;
  const bare = unscopedName(name);
  const sameOwner = all.filter((e) => (e.repositoryOwner ?? '').toLowerCase() === scope);
  return (
    sameOwner.find((e) => e.id.toLowerCase() === bare) ??
    sameOwner.find((e) => {
      const repo = (e.repositoryName ?? '').toLowerCase();
      return repo === bare || repo === `antora-${bare}`;
    })
  );
}

/** Link for a package that is not in the registry, from its dependency spec when known. */
export function externalPackageUrl(name: string, spec?: string, bundleOwner?: string): { url: string; kind: 'repo' | 'npm' | 'search' } {
  const gh = spec ? /^(?:github:|git\+https:\/\/github\.com\/|https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:#([^&]*))?(?:&path:(.+))?$/.exec(spec.trim()) : null;
  if (spec && gh && !/^[\^~<>=\d*]/.test(spec.trim())) {
    const [, owner, repo, ref, path] = gh;
    const base = `https://github.com/${owner}/${repo}`;
    return { url: path ? `${base}/tree/${ref || 'HEAD'}/${path.replace(/^\/+/, '')}` : base, kind: 'repo' };
  }
  const scope = packageScope(name);
  // Same-org git dependency whose spec is not synced yet: npm would 404, so search the org instead.
  if (!spec && scope && bundleOwner && scope === bundleOwner.toLowerCase()) {
    return { url: `https://github.com/orgs/${scope}/repositories?q=${encodeURIComponent(unscopedName(name))}`, kind: 'search' };
  }
  return { url: `https://www.npmjs.com/package/${name.trim()}`, kind: 'npm' };
}

export interface BundleMember {
  name: string;
  entry?: ExtensionCatalogEntry;
  external?: { url: string; kind: 'repo' | 'npm' | 'search' };
}

/** Bundle members resolved against the catalog; unlisted ones carry an external link. */
export function bundleMembers(bundle: ExtensionCatalogEntry, all: ExtensionCatalogEntry[]): BundleMember[] {
  return (bundle.bundle?.members ?? []).map((name) => {
    const entry = matchPackage(name, all);
    if (entry && entry.catalogId !== bundle.catalogId) return { name, entry };
    return { name, external: externalPackageUrl(name, bundle.dependencySpecs?.[name], bundle.repositoryOwner) };
  });
}