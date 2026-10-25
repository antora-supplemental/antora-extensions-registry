/**
 * Durable preview cache. The daily sync downloads each preview once it answers 200 + image/* (at most
 * MAX_PREVIEW_BYTES), stores the bytes by SHA-256 in Turso and rewrites the preview URL to /previews/<hash>,
 * so pages never depend on raw.githubusercontent.com being fast or reachable.
 *
 * - A URL that has never fetched as an image is never cached and never shown.
 * - A cached URL that later 404s, stops being an image, or disappears from the README keeps its cached copy,
 *   marked stale (internal only).
 * - A URL that returns a different valid image refreshes the cache.
 * - Rows are keyed by catalogId, so packages that leave the catalog are purged with their images.
 */
import { createHash } from 'node:crypto';
import type { ExtensionCatalogEntry, PreviewImage } from '~/types/ui-module';
import type { FetchLike } from '~/lib/preview-check';

export const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
export const PREVIEW_ROUTE = '/previews/';

export interface CachedPreview {
  catalogId: string;
  sourceUrl: string;
  hash: string;
  contentType: string;
  caption?: string;
  source: PreviewImage['source'];
  stale: boolean;
}

export interface PreviewStore {
  list(catalogId: string): Promise<CachedPreview[]>;
  put(row: CachedPreview, bytes: Uint8Array): Promise<void>;
  markStale(catalogId: string, sourceUrl: string): Promise<void>;
  /** Deletes rows for packages not in `keep` and blobs no row references. */
  purgeExcept(keep: string[]): Promise<number>;
}

export type FetchedImage = { ok: true; bytes: Uint8Array; contentType: string; hash: string } | { ok: false; reason: string };

/** GET the image; ok only for 200 + image/* within the size cap. */
export async function fetchImage(url: string, fetchImpl: FetchLike = fetch, maxBytes = MAX_PREVIEW_BYTES): Promise<FetchedImage> {
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'Antora-Extensions-Registry' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
    if (!contentType.startsWith('image/')) return { ok: false, reason: `not an image (${contentType || 'no content-type'})` };
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) return { ok: false, reason: `too large (${declared} bytes)` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > maxBytes) return { ok: false, reason: `too large (${bytes.byteLength} bytes)` };
    return { ok: true, bytes, contentType, hash: createHash('sha256').update(bytes).digest('hex') };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

const isCacheable = (p: PreviewImage) => p.source !== 'upload' && /^https?:\/\//i.test(p.url);

export interface PreviewCacheReport {
  cached: number;
  refreshed: number;
  servedStale: number;
  dropped: string[];
  purged: number;
}

/** Applies the cache to every entry in place. Previews end up pointing at /previews/<hash>. */
export async function syncPreviewCache(entries: ExtensionCatalogEntry[], store: PreviewStore, fetchImpl: FetchLike = fetch, extraKeep: string[] = []): Promise<PreviewCacheReport> {
  const report: PreviewCacheReport = { cached: 0, refreshed: 0, servedStale: 0, dropped: [], purged: 0 };
  for (const e of entries) {
    const known = new Map((await store.list(e.catalogId)).map((c) => [c.sourceUrl, c]));
    const out: PreviewImage[] = [];
    const seen = new Set<string>();
    for (const p of e.previews ?? []) {
      if (!isCacheable(p)) { out.push(p); continue; }
      seen.add(p.url);
      const prior = known.get(p.url);
      const got = await fetchImage(p.url, fetchImpl);
      if (got.ok) {
        if (!prior || prior.hash !== got.hash || prior.stale) {
          await store.put({ catalogId: e.catalogId, sourceUrl: p.url, hash: got.hash, contentType: got.contentType, caption: p.caption, source: p.source, stale: false }, got.bytes);
          if (prior) report.refreshed++; else report.cached++;
        }
        out.push({ ...p, url: PREVIEW_ROUTE + got.hash, sourceUrl: p.url });
      } else if (prior) {
        await store.markStale(e.catalogId, p.url);
        report.servedStale++;
        out.push({ ...p, url: PREVIEW_ROUTE + prior.hash, sourceUrl: p.url, stale: true });
      } else {
        report.dropped.push(`${p.url} (${got.reason})`);
      }
    }
    // Cached previews the README (or manifest) no longer references: keep showing them, marked stale.
    for (const c of known.values()) {
      if (seen.has(c.sourceUrl)) continue;
      if (!c.stale) await store.markStale(e.catalogId, c.sourceUrl);
      report.servedStale++;
      out.push({ url: PREVIEW_ROUTE + c.hash, caption: c.caption, source: c.source, sourceUrl: c.sourceUrl, stale: true });
    }
    if (out.length) e.previews = out;
    else delete e.previews;
  }
  report.purged = await store.purgeExcept([...entries.map((e) => e.catalogId), ...extraKeep]);
  return report;
}

/** In-memory store (tests, dry runs). */
export function memoryPreviewStore(): PreviewStore & { rows: CachedPreview[]; blobs: Map<string, Uint8Array> } {
  const rows: CachedPreview[] = [];
  const blobs = new Map<string, Uint8Array>();
  return {
    rows,
    blobs,
    async list(id) { return rows.filter((r) => r.catalogId === id).map((r) => ({ ...r })); },
    async put(row, bytes) {
      const i = rows.findIndex((r) => r.catalogId === row.catalogId && r.sourceUrl === row.sourceUrl);
      if (i >= 0) rows[i] = row; else rows.push(row);
      blobs.set(row.hash, bytes);
    },
    async markStale(id, url) { const r = rows.find((x) => x.catalogId === id && x.sourceUrl === url); if (r) r.stale = true; },
    async purgeExcept(keep) {
      const k = new Set(keep);
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (!k.has(rows[i].catalogId)) rows.splice(i, 1);
      for (const h of [...blobs.keys()]) if (!rows.some((r) => r.hash === h)) blobs.delete(h);
      return before - rows.length;
    },
  };
}

type Exec = { execute(q: { sql: string; args?: unknown[] } | string): Promise<{ rows: Record<string, unknown>[]; rowsAffected: number }> };

export const PREVIEW_CACHE_DDL = [
  'CREATE TABLE IF NOT EXISTS preview_blob (hash TEXT PRIMARY KEY, contentType TEXT NOT NULL, size INTEGER NOT NULL, bytes BLOB NOT NULL, createdAt INTEGER NOT NULL)',
  `CREATE TABLE IF NOT EXISTS preview_cache (catalogId TEXT NOT NULL, sourceUrl TEXT NOT NULL, hash TEXT NOT NULL, contentType TEXT NOT NULL,
     caption TEXT, source TEXT NOT NULL, stale INTEGER NOT NULL DEFAULT 0, updatedAt INTEGER NOT NULL, PRIMARY KEY (catalogId, sourceUrl))`,
];

/** Turso/libsql store (the database the registry already uses; no extra service or env var). */
export async function sqlPreviewStore(db: Exec): Promise<PreviewStore> {
  for (const sql of PREVIEW_CACHE_DDL) await db.execute(sql);
  const now = () => Math.floor(Date.now() / 1000);
  return {
    async list(id) {
      const r = await db.execute({ sql: 'SELECT * FROM preview_cache WHERE catalogId = ?', args: [id] });
      return r.rows.map((x) => ({
        catalogId: String(x.catalogId), sourceUrl: String(x.sourceUrl), hash: String(x.hash), contentType: String(x.contentType),
        caption: (x.caption as string | null) ?? undefined, source: String(x.source) as PreviewImage['source'], stale: Number(x.stale) === 1,
      }));
    },
    async put(row, bytes) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO preview_blob (hash, contentType, size, bytes, createdAt) VALUES (?, ?, ?, ?, ?)', args: [row.hash, row.contentType, bytes.byteLength, bytes, now()] });
      await db.execute({
        sql: `INSERT INTO preview_cache (catalogId, sourceUrl, hash, contentType, caption, source, stale, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
              ON CONFLICT(catalogId, sourceUrl) DO UPDATE SET hash = excluded.hash, contentType = excluded.contentType, caption = excluded.caption, source = excluded.source, stale = 0, updatedAt = excluded.updatedAt`,
        args: [row.catalogId, row.sourceUrl, row.hash, row.contentType, row.caption ?? null, row.source, now()],
      });
    },
    async markStale(id, url) {
      await db.execute({ sql: 'UPDATE preview_cache SET stale = 1, updatedAt = ? WHERE catalogId = ? AND sourceUrl = ?', args: [now(), id, url] });
    },
    async purgeExcept(keep) {
      if (!keep.length) return 0; // never wipe the cache on an empty catalog
      const r = await db.execute({ sql: `DELETE FROM preview_cache WHERE catalogId NOT IN (${keep.map(() => '?').join(',')})`, args: keep });
      await db.execute('DELETE FROM preview_blob WHERE hash NOT IN (SELECT hash FROM preview_cache)');
      return r.rowsAffected;
    },
  };
}