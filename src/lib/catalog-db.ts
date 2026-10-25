import { createClient, type Client } from '@libsql/client';
import type { ExtensionCatalogResult } from '~/lib/ui-modules';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

export type DbCatalog = ExtensionCatalogResult & {
  discoveredRepoCount: number;
  source: 'database';
  syncedAt?: string;
};

function isRemote(url: string) {
  return /^(libsql|https?):\/\//.test(url);
}

export function catalogDbConfigured(): boolean {
  const catalogOnly = process.env.REGISTRY_CATALOG_ONLY === 'true' || process.env.REGISTRY_CATALOG_ONLY === '1';
  const url = process.env.DB_URL ?? '';
  return !catalogOnly && isRemote(url) && Boolean(process.env.DB_AUTH_TOKEN);
}

let client: Client | null = null;
function getClient(): Client {
  client ??= createClient({ url: process.env.DB_URL!, authToken: process.env.DB_AUTH_TOKEN });
  return client;
}

/** Reads the catalog synced by scripts/sync-catalog-db.ts. Returns null when empty/unreachable. */
export async function readCatalogFromDb(): Promise<DbCatalog | null> {
  if (!catalogDbConfigured()) return null;
  try {
    const c = getClient();
    const rows = await c.execute('SELECT payload FROM catalog_entry ORDER BY repoOwner, repoName, catalogId');
    if (rows.rows.length === 0) return null;
    const entries = rows.rows.map((r) => JSON.parse(String(r.payload)) as ExtensionCatalogEntry);
    const meta = await c.execute("SELECT key, value FROM catalog_meta");
    const m = Object.fromEntries(meta.rows.map((r) => [String(r.key), String(r.value)]));
    const modules = entries.filter((e) => e.type !== 'ui-recipe');
    const recipes = entries.filter((e) => e.type === 'ui-recipe');
    const repoMap = new Map<string, ExtensionCatalogResult['indexedRepos'][number]>();
    for (const e of entries) {
      const key = `${e.repositoryOwner}/${e.repositoryName}`;
      const r = repoMap.get(key) ?? { owner: e.repositoryOwner ?? '', repo: e.repositoryName ?? '', githubRepoId: e.githubRepoId, moduleCount: 0, recipeCount: 0 };
      if (e.type === 'ui-recipe') r.recipeCount++; else r.moduleCount++;
      repoMap.set(key, r);
    }
    return {
      modules,
      recipes,
      indexedRepos: [...repoMap.values()],
      discoveredRepoCount: Number(m.discoveredRepoCount ?? 0),
      source: 'database',
      syncedAt: m.syncedAt,
    };
  } catch (error) {
    console.error('[registry] catalog DB read failed; using snapshot:', error);
    return null;
  }
}
