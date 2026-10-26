import { displayTitle, rawPackageName } from './package-title';
import type { ExtensionCatalogEntry } from '../types/ui-module';

/** Case- and punctuation-insensitive key for comparing display titles. */
export const titleKey = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');

const forgeLabel = (host?: string) => {
  const h = (host ?? 'github.com').toLowerCase();
  return h === 'github.com' ? 'GitHub' : h === 'gitlab.com' ? 'GitLab' : h;
};

/**
 * Identity stays host/owner/repo/package; titles are never forced unique. Entries whose display titles collide
 * (fork-grouped entries excluded) get `titleDisambiguator`: the owner, plus the forge when the colliding hosts differ.
 * Mutates and returns the entries.
 */
export function annotateTitleCollisions<T extends ExtensionCatalogEntry>(entries: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const e of entries) {
    delete e.titleDisambiguator;
    if (e.forkOf) continue;
    const k = titleKey(displayTitle(e));
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const hosts = new Set(g.map((e) => (e.repositoryHost ?? 'github.com').toLowerCase()));
    const owners = new Set(g.map((e) => e.repositoryOwner.toLowerCase()));
    for (const e of g) {
      const parts = [e.repositoryOwner];
      if (hosts.size > 1) parts.push(forgeLabel(e.repositoryHost));
      // Same owner twice (e.g. two packages in one org): add the repository so the pair still differs.
      if (owners.size < g.length && g.filter((x) => x.repositoryOwner.toLowerCase() === e.repositoryOwner.toLowerCase()).length > 1) parts.splice(1, 0, e.repositoryName);
      e.titleDisambiguator = parts.join(' · ');
    }
  }
  return entries;
}

/** Valid npm package name. */
export const isNpmName = (n: string) => /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(n) && n.length <= 214;

/**
 * Looks up which entries are published to npm under their package name, counting a hit only when the npm package's
 * repository points at the same owner/repo (so a same-named package from someone else is not claimed).
 */
export async function annotateNpm<T extends ExtensionCatalogEntry>(entries: T[], fetchImpl: typeof fetch = fetch, concurrency = 8): Promise<T[]> {
  const todo = entries.filter((e) => !e.privatePackage && isNpmName(rawPackageName(e)));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const e = todo[i++];
      const name = rawPackageName(e);
      try {
        const res = await fetchImpl(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, { headers: { accept: 'application/json' } });
        if (!res.ok) continue;
        const doc = (await res.json()) as { repository?: string | { url?: string } };
        const url = (typeof doc.repository === 'string' ? doc.repository : doc.repository?.url ?? '').toLowerCase();
        if (url.includes(`${e.repositoryOwner}/${e.repositoryName}`.toLowerCase())) e.npmName = name;
      } catch {
        /* offline or rate-limited: leave unset */
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return entries;
}
