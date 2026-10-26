import { displayTitle, rawPackageName } from './package-title';
import type { ExtensionCatalogEntry } from '../types/ui-module';

/** Case- and punctuation-insensitive key for comparing display titles. */
export const titleKey = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');

const forgeLabel = (host?: string) => {
  const h = (host ?? 'github.com').toLowerCase();
  return h === 'github.com' ? 'GitHub' : h === 'gitlab.com' ? 'GitLab' : h;
};

export interface TitleClaim { titleKey: string; catalogId: string; firstSeenAt: number }

/**
 * Display titles are unique across the registry (soft: titles never address anything). Identity stays
 * host/owner/repo/package. Per normalized title, the entry first seen with it (from `title_claim`) holds it; later
 * non-fork entries are still listed but get `titleDisambiguator` (owner, plus forge when hosts differ) and
 * `titleInUseBy` (the holder's catalogId). Claims for entries that renamed or left are dropped, so the title passes to
 * the next earliest entry. Mutates entries; returns the claim rows to store and the conflicts for the sync log.
 */
export function resolveTitleClaims<T extends ExtensionCatalogEntry>(entries: T[], existing: TitleClaim[], now: number) {
  const seen = new Map(existing.map((c) => [`${c.titleKey}\t${c.catalogId}`, c.firstSeenAt]));
  const groups = new Map<string, Array<{ e: T; at: number }>>();
  const claims: TitleClaim[] = [];
  for (const e of entries) {
    delete e.titleDisambiguator;
    delete e.titleInUseBy;
    // Forks and superseded entries make no claim (a replaced package is not a title clash).
    if (e.forkOf || e.supersededBy || e.replacedBy) continue;
    const k = titleKey(displayTitle(e));
    if (!k) continue;
    const at = seen.get(`${k}\t${e.catalogId}`) ?? now;
    claims.push({ titleKey: k, catalogId: e.catalogId, firstSeenAt: at });
    groups.set(k, [...(groups.get(k) ?? []), { e, at }]);
  }
  const conflicts: Array<{ title: string; holder: string; others: string[] }> = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => a.at - b.at || a.e.catalogId.localeCompare(b.e.catalogId));
    const holder = g[0].e;
    const hosts = new Set(g.map(({ e }) => (e.repositoryHost ?? 'github.com').toLowerCase()));
    for (const { e } of g.slice(1)) {
      const parts = [e.repositoryOwner];
      if (e.repositoryOwner.toLowerCase() === holder.repositoryOwner.toLowerCase()) parts.push(e.repositoryName);
      if (hosts.size > 1) parts.push(forgeLabel(e.repositoryHost));
      e.titleDisambiguator = parts.join(' · ');
      e.titleInUseBy = holder.catalogId;
    }
    conflicts.push({ title: displayTitle(holder), holder: holder.catalogId, others: g.slice(1).map(({ e }) => e.catalogId) });
  }
  return { claims, conflicts };
}

/** Valid npm package name. */
export const isNpmName = (n: string) => /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(n) && n.length <= 214;

/**
 * Optional extra info, never identity (Antora configs point at repository URLs). Looks up which entries are published to npm under their package name, counting a hit only when the npm package's
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
