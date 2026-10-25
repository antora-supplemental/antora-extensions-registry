/**
 * Daily catalog sync (catalog-sync workflow). Fetches the catalog from GitHub and writes it to Turso.
 * Env: DB_URL, DB_AUTH_TOKEN, GITHUB_TOKEN.
 *
 * - Extensions: curated + topic-discovered + repos approved in the database; rejected repos are left out.
 * - Themes: curated themes are upserted; newly discovered theme repos are checked against the
 *   registry criteria and imported when they pass.
 * - Trusted publishers are seeded, and first-listed dates are recorded once and never changed.
 */
import { createClient } from '@libsql/client';
import { buildFullExtensionCatalog } from '../src/lib/extension-catalog';
import { themesFromKnownRepos } from '../src/data/known-theme-repos';
import { discoverThemeReposFromTopics } from '../src/lib/github-topics';
import { checkRepository } from '../src/lib/registry-check';
import { sqlPreviewStore, syncPreviewCache } from '../src/lib/preview-cache';
import { firstListedStatements } from '../src/lib/first-listed';
import { SEED_TRUSTED_PUBLISHERS, repoStatus, trustedReason, upsertApprovedTheme } from '../src/lib/registry-write';

const url = process.env.DB_URL;
if (!url) throw new Error('DB_URL is required');
const db = createClient({ url, authToken: process.env.DB_AUTH_TOKEN });
const now = Math.floor(Date.now() / 1000);

await db.batch(
  SEED_TRUSTED_PUBLISHERS.map((t) => ({
    sql: 'INSERT OR IGNORE INTO trusted_publisher (id, kind, name, addedBy, note, createdAt) VALUES (?, ?, ?, NULL, ?, ?)',
    args: [`${t.kind}:${t.name.toLowerCase()}`, t.kind, t.name.toLowerCase(), t.note, now],
  })),
  'write',
);

const repoRows = (await db.execute('SELECT owner, name, status, createdAt FROM extension_repo')).rows;
const rejected = new Set(repoRows.filter((r) => r.status === 'rejected').map((r) => `${r.owner}/${r.name}`.toLowerCase()));
const approvedInDb = repoRows
  .filter((r) => r.status === 'approved')
  .map((r) => ({ owner: String(r.owner), repo: String(r.name), discoveredVia: 'submission' as const }));
const repoCreated = new Map(repoRows.map((r) => [`${r.owner}/${r.name}`.toLowerCase(), Number(r.createdAt)]));

const catalog = await buildFullExtensionCatalog({ includeTopicDiscovery: true, live: true, extraRepos: approvedInDb, excludeRepos: rejected });
const entries = [...catalog.modules, ...catalog.recipes];
if (entries.length === 0) throw new Error('Catalog came back empty; refusing to wipe the database.');

// Cache previews in Turso and serve them from /previews/<hash>: never cache a failed first fetch, keep the
// cached copy (marked stale) when the source later breaks or leaves the README, refresh on a changed image.
const pv = await syncPreviewCache(entries, await sqlPreviewStore(db));
console.log(`[registry] previews: ${pv.cached} newly cached, ${pv.refreshed} refreshed, ${pv.servedStale} served from a stale source, ${pv.dropped.length} never cached, ${pv.purged} purged`);
for (const d of pv.dropped) console.log(`[registry] preview not cached: ${d}`);

const curatedThemes = themesFromKnownRepos();
const stmts = [
  { sql: 'DELETE FROM catalog_entry', args: [] },
  ...entries.map((e) => ({
    sql: 'INSERT OR REPLACE INTO catalog_entry (catalogId, repoOwner, repoName, type, name, version, payload, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [e.catalogId, e.repositoryOwner ?? '', e.repositoryName ?? '', e.type, e.name, e.version, JSON.stringify(e), now],
  })),
  // First listing: earliest record we have for the repository, else now. INSERT OR IGNORE keeps existing dates.
  ...firstListedStatements(
    'extension',
    entries.map((e) => ({ id: e.catalogId, at: repoCreated.get(`${e.repositoryOwner}/${e.repositoryName}`.toLowerCase()) || now })),
  ),
  ...catalog.indexedRepos.map((r) => ({
    sql: `INSERT INTO extension_repo (id, repoUrl, owner, name, catalogSource, moduleCount, recipeCount, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'github-sync', ?, ?, 'approved', ?, ?)
          ON CONFLICT(repoUrl) DO UPDATE SET moduleCount = excluded.moduleCount, recipeCount = excluded.recipeCount, updatedAt = excluded.updatedAt`,
    args: [`${r.owner}/${r.repo}`.toLowerCase(), `https://github.com/${r.owner}/${r.repo}`, r.owner, r.repo, r.moduleCount, r.recipeCount, now, now],
  })),
  ...curatedThemes.map((t) => ({
    sql: `INSERT INTO theme (id, name, description, authorName, repoUrl, demoUrl, previewImage, stars, tags, appearance, baseTheme, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'approved', ?, ?)
          ON CONFLICT(repoUrl) DO UPDATE SET name = excluded.name, description = excluded.description, demoUrl = excluded.demoUrl,
            previewImage = excluded.previewImage, tags = excluded.tags, appearance = excluded.appearance, updatedAt = excluded.updatedAt`,
    args: [t.id, t.name, t.description, t.author, t.repoUrl, t.demoUrl ?? null, t.previewImage ?? null, JSON.stringify(t.tags), t.appearance ?? null, t.baseTheme ?? null, now, now],
  })),
  // Themes: backfill from the theme row's createdAt (earliest record).
  { sql: "INSERT OR IGNORE INTO first_listed (id, kind, itemId, firstListedAt) SELECT 'theme:' || id, 'theme', id, createdAt FROM theme WHERE status = 'approved'", args: [] },
  { sql: "INSERT INTO catalog_meta (key, value) VALUES ('syncedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [new Date().toISOString()] },
  { sql: "INSERT INTO catalog_meta (key, value) VALUES ('discoveredRepoCount', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [String(catalog.discoveredRepoCount)] },
];
await db.batch(stmts, 'write');
console.log(`[registry] synced ${entries.length} catalog entries from ${catalog.indexedRepos.length} repos into the database`);

// Newly discovered theme repositories: check and import the ones that meet the criteria.
const curatedUrls = new Set(curatedThemes.map((t) => t.repoUrl.toLowerCase()));
let imported = 0;
for (const hit of await discoverThemeReposFromTopics(50)) {
  if (curatedUrls.has(hit.repoUrl.toLowerCase()) || (await repoStatus(db, hit.repoUrl))) continue;
  const check = await checkRepository(hit.repoUrl);
  if (!check.passed || !check.theme || !check.owner) {
    console.log(`[registry] theme ${hit.owner}/${hit.repo} not imported: ${check.criteria.filter((c) => !c.ok).map((c) => c.label).join('; ')}`);
    continue;
  }
  const approvedVia = (await trustedReason(db, { host: 'github', owner: check.owner })) ?? 'Meets the registry criteria (daily discovery)';
  await upsertApprovedTheme(db, check.theme, { approvedVia });
  imported++;
  console.log(`[registry] imported theme ${hit.owner}/${hit.repo}: ${approvedVia}`);
}
console.log(`[registry] imported ${imported} new theme(s) from topic discovery`);
