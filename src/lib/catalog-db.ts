import { createClient, type Client } from '@libsql/client';
import type { ExtensionCatalogResult } from '~/lib/ui-modules';
import type { ExtensionCatalogEntry, PreviewImage } from '~/types/ui-module';
import { DEFAULT_FEATURED, emptyOverlay, type CatalogOverlay } from '~/lib/catalog-overlay';

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
/** Shared read client for catalog data (also used by /previews/<hash>). */
export function getClient(): Client {
  client ??= createClient({ url: process.env.DB_URL!, authToken: process.env.DB_AUTH_TOKEN });
  return client;
}

/** Reads the catalog synced by scripts/sync-catalog-db.ts. Returns null when empty/unreachable. */
export async function readCatalogFromDb(): Promise<DbCatalog | null> {
  if (!catalogDbConfigured()) return null;
  try {
    const c = getClient();
    // One indexed read of the sync-time snapshot; the per-table path below is the fallback for older syncs.
    const { parseSnapshot, SNAPSHOT_KEYS } = await import('~/lib/browse-cache');
    const snap = await c.execute({ sql: 'SELECT value FROM catalog_meta WHERE key = ?', args: [SNAPSHOT_KEYS.extensions] });
    const fromSnap = parseSnapshot<Omit<DbCatalog, 'source'>>(snap.rows[0]?.value);
    if (fromSnap) return { ...fromSnap, source: 'database' };
    const rows = await c.execute('SELECT payload FROM catalog_entry ORDER BY repoOwner, repoName, catalogId');
    if (rows.rows.length === 0) return null;
    const { readFirstListed } = await import('~/lib/first-listed');
    const first = await readFirstListed(c, 'extension');
    const entries = rows.rows.map((r) => {
      const e = JSON.parse(String(r.payload)) as ExtensionCatalogEntry;
      const at = first.get(e.catalogId);
      return at ? { ...e, firstListedAt: at } : e;
    });
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

function parseList(v: unknown): string[] | null {
  if (v === null || v === undefined) return null;
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

/**
 * Admin overrides, uploaded previews and the featured slot. Each table is optional:
 * before the schema push adds them, this returns the defaults.
 */
export async function readCatalogOverlay(): Promise<CatalogOverlay> {
  const overlay = emptyOverlay();
  if (!catalogDbConfigured()) return overlay;
  const c = getClient();
  // One round trip for all three tables; falls back to separate reads if a table is missing.
  try {
    const [o, p, f] = await c.batch([
      'SELECT catalogId, layers, bundleMembers FROM catalog_override',
      'SELECT catalogId, url, caption FROM catalog_preview ORDER BY position, createdAt',
      "SELECT value FROM catalog_meta WHERE key = 'featured'",
    ], 'read');
    for (const r of o.rows) overlay.overrides.set(String(r.catalogId), { catalogId: String(r.catalogId), layers: parseList(r.layers), bundleMembers: parseList(r.bundleMembers) });
    for (const r of p.rows) {
      const id = String(r.catalogId);
      overlay.uploads.set(id, [...(overlay.uploads.get(id) ?? []), { url: String(r.url), caption: (r.caption as string | null) ?? undefined, source: 'upload' } satisfies PreviewImage]);
    }
    overlay.featured = (f.rows.length ? parseList(f.rows[0].value) : null) ?? DEFAULT_FEATURED;
    return overlay;
  } catch { /* a table is missing: per-table reads below */ }
  try {
    const rows = await c.execute('SELECT catalogId, layers, bundleMembers FROM catalog_override');
    for (const r of rows.rows) {
      const catalogId = String(r.catalogId);
      overlay.overrides.set(catalogId, { catalogId, layers: parseList(r.layers), bundleMembers: parseList(r.bundleMembers) });
    }
  } catch { /* table not created yet */ }
  try {
    const rows = await c.execute('SELECT catalogId, url, caption FROM catalog_preview ORDER BY position, createdAt');
    for (const r of rows.rows) {
      const id = String(r.catalogId);
      const list = overlay.uploads.get(id) ?? [];
      list.push({ url: String(r.url), caption: (r.caption as string | null) ?? undefined, source: 'upload' } satisfies PreviewImage);
      overlay.uploads.set(id, list);
    }
  } catch { /* table not created yet */ }
  try {
    const rows = await c.execute({ sql: "SELECT value FROM catalog_meta WHERE key = 'featured'", args: [] });
    const featured = rows.rows.length ? parseList(rows.rows[0].value) : null;
    overlay.featured = featured ?? DEFAULT_FEATURED;
  } catch { /* keep default */ }
  return overlay;
}
