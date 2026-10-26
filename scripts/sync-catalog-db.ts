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
import { OWNERS_DDL, ownerKeys, syncOwners } from '../src/lib/owners';
import { firstListedStatements } from '../src/lib/first-listed';
import { computeCompat, sortLinks } from '../src/lib/pkg-compat';
import { seedFor } from '../src/data/compat-seeds';
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

// Display-title collisions (disambiguator on cards and search) and npm publication (cheap lookup, cached in the DB rows).
{
  const { resolveTitleClaims, annotateNpm } = await import('../src/lib/title-collisions');
  // Migration: first-seen time per (normalized title, entry); the earliest current entry holds the title.
  await db.execute(`CREATE TABLE IF NOT EXISTS title_claim (
    titleKey TEXT NOT NULL, catalogId TEXT NOT NULL, firstSeenAt INTEGER NOT NULL, PRIMARY KEY (titleKey, catalogId))`);
  const existing = (await db.execute('SELECT titleKey, catalogId, firstSeenAt FROM title_claim')).rows.map((r) => ({ titleKey: String(r.titleKey), catalogId: String(r.catalogId), firstSeenAt: Number(r.firstSeenAt) }));
  const { claims, conflicts } = resolveTitleClaims(entries, existing, Date.now());
  await db.batch([
    { sql: 'DELETE FROM title_claim', args: [] },
    ...claims.map((c) => ({ sql: 'INSERT INTO title_claim (titleKey, catalogId, firstSeenAt) VALUES (?, ?, ?)', args: [c.titleKey, c.catalogId, c.firstSeenAt] })),
  ], 'write');
  for (const c of conflicts) console.log(`[registry] title already in use: "${c.title}" held by ${c.holder}; also on ${c.others.join(', ')} (ask them to set a unique antoraRegistry.title)`);
  await annotateNpm(entries);
  console.log(`[registry] titles: ${claims.length} claimed, ${conflicts.length} in use by more than one entry; npm (extra info): ${entries.filter((e) => e.npmName).length}`);
}

// Package-to-package compatibility: declared relations win; curated seeds fill packages that cannot declare yet.
for (const e of entries) {
  if (!e.relations) {
    const s = seedFor([e.name, `${e.repositoryOwner}/${e.repositoryName}`, e.repositoryName ?? '']);
    if (s) e.relations = s;
  }
}
const compat = computeCompat(entries.map((e) => ({ ...e, repositoryOwner: e.repositoryOwner ?? '', repositoryName: e.repositoryName ?? '' })));
for (const e of entries) {
  const links = compat.get(e.catalogId);
  if (links) e.compat = sortLinks(links);
}

// Cache previews in Turso and serve them from /previews/<hash>: never cache a failed first fetch, keep the
// cached copy (marked stale) when the source later breaks or leaves the README, refresh on a changed image.
const previewStore = await sqlPreviewStore(db);
const pv = await syncPreviewCache(entries, previewStore, fetch, ownerKeys(entries));
// Owners (GitHub users/orgs, GitLab users/groups): metadata on every entry + owner table; avatars cached like previews.
const owners = await syncOwners(entries, previewStore);
await db.execute(OWNERS_DDL);
console.log(`[registry] owners: ${owners.length} (${owners.filter((o) => o.avatar).length} with a cached avatar)`);
console.log(`[registry] previews: ${pv.cached} newly cached, ${pv.refreshed} refreshed, ${pv.servedStale} served from a stale source, ${pv.dropped.length} never cached, ${pv.purged} purged`);
for (const d of pv.dropped) console.log(`[registry] preview not cached: ${d}`);

const countByOwner = new Map<string, number>();
for (const e of entries) countByOwner.set(`${e.owner!.host}/${e.owner!.login}`, (countByOwner.get(`${e.owner!.host}/${e.owner!.login}`) ?? 0) + 1);
const ownerStmts = [
  { sql: 'DELETE FROM owner', args: [] },
  ...owners.map((o) => ({
    sql: 'INSERT INTO owner (host, login, type, profileUrl, avatarUrl, avatar, displayName, packageCount, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [o.host, o.login, o.type, o.profileUrl, o.avatarUrl ?? null, o.avatar ?? null, o.displayName ?? null, countByOwner.get(`${o.host}/${o.login}`) ?? 0, now],
  })),
];
// Releases per repository. Migration: create catalog_release here, idempotently. drizzle-kit
// push cannot do it in CI: it stops at an interactive "created or renamed?" prompt because the
// database still holds legacy tables, and exits without applying anything.
await db.execute(`CREATE TABLE IF NOT EXISTS catalog_release (
  repo text NOT NULL, tag text NOT NULL, version text NOT NULL,
  rolling integer NOT NULL, prerelease integer NOT NULL, antora text NOT NULL,
  antoraSource text, publishedAt text, installSpec text NOT NULL, assets text NOT NULL,
  syncedAt integer NOT NULL, PRIMARY KEY (repo, tag))`);
const releaseRows = new Map<string, { repo: string; r: NonNullable<(typeof entries)[number]['releases']>[number] }>();
for (const e of entries) {
  const repo = `${e.repositoryOwner}/${e.repositoryName}`.toLowerCase();
  for (const r of e.releases ?? []) releaseRows.set(`${repo}#${r.tag}`, { repo, r });
}
const releaseStmts = [
  { sql: 'DELETE FROM catalog_release', args: [] },
  ...[...releaseRows.values()].map(({ repo, r }) => ({
    sql: 'INSERT INTO catalog_release (repo, tag, version, rolling, prerelease, antora, antoraSource, publishedAt, installSpec, assets, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [repo, r.tag, r.version, r.rolling ? 1 : 0, r.prerelease ? 1 : 0, JSON.stringify(r.antora), r.antoraSource ?? null, r.publishedAt ?? null, r.installSpec, JSON.stringify(r.assets), now],
  })),
];
// Compatibility links (also in each payload). Created idempotently for the same reason as catalog_release.
await db.execute(`CREATE TABLE IF NOT EXISTS catalog_compat (
  source text NOT NULL, target text NOT NULL, relation text NOT NULL, confidence text NOT NULL,
  why text NOT NULL, path text, contracts text, syncedAt integer NOT NULL, PRIMARY KEY (source, target))`);
const compatStmts = [
  { sql: 'DELETE FROM catalog_compat', args: [] },
  ...[...compat].flatMap(([source, links]) =>
    links.map((l) => ({
      sql: 'INSERT OR REPLACE INTO catalog_compat (source, target, relation, confidence, why, path, contracts, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [source, l.target, l.relation, l.confidence, l.why, l.path ? JSON.stringify(l.path) : null, l.contracts ? JSON.stringify(l.contracts) : null, now],
    })),
  ),
];
console.log(`[registry] compat: ${compatStmts.length - 1} links across ${compat.size} packages`);
console.log(`[registry] releases: ${releaseRows.size} across ${new Set([...releaseRows.values()].map((x) => x.repo)).size} repos`);
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
    args: [`${r.host ? r.host + '/' : ''}${r.owner}/${r.repo}`.toLowerCase(), `https://${r.host ?? 'github.com'}/${r.owner}/${r.repo}`, r.owner, r.repo, r.moduleCount, r.recipeCount, now, now],
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
await db.batch([...stmts, ...ownerStmts, ...releaseStmts, ...compatStmts], 'write');
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

// Preview cache readback (diagnostics only: counts and value types, never contents or secrets).
try {
  const n = await db.execute('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM preview_blob');
  const one = await db.execute('SELECT hash, typeof(bytes) AS t, length(bytes) AS len FROM preview_blob LIMIT 1');
  const r = one.rows[0];
  console.log(`[registry] preview_blob: ${n.rows[0].n} rows, ${n.rows[0].bytes} bytes; sample ${r ? `${String(r.hash).slice(0, 12)} ${r.t} ${r.len}` : 'none'}`);
} catch (err) {
  console.log(`[registry] preview_blob readback failed: ${(err as Error).name}`);
}
// Browse snapshots: one denormalized row per view (read by the site in a single query), then CDN purge.
{
  const { serializeSnapshot, SNAPSHOT_KEYS, CACHE_TAG } = await import('../src/lib/browse-cache');
  const { classifyEntry } = await import('../src/lib/layers');
  const { readFirstListed } = await import('../src/lib/first-listed');
  const first = await readFirstListed(db, 'extension');
  const all = entries.map((e) => classifyEntry(first.get(e.catalogId) ? { ...e, firstListedAt: first.get(e.catalogId) } : e));
  const repoMap = new Map<string, { owner: string; repo: string; githubRepoId?: number; moduleCount: number; recipeCount: number }>();
  for (const e of all) {
    const key = `${e.repositoryHost ?? 'github.com'}/${e.repositoryOwner}/${e.repositoryName}`;
    const r = repoMap.get(key) ?? { owner: e.repositoryOwner, repo: e.repositoryName, githubRepoId: e.githubRepoId, moduleCount: 0, recipeCount: 0 };
    if (e.type === 'ui-recipe') r.recipeCount++; else r.moduleCount++;
    repoMap.set(key, r);
  }
  const extSnap = serializeSnapshot({
    modules: all.filter((e) => e.type !== 'ui-recipe'),
    recipes: all.filter((e) => e.type === 'ui-recipe'),
    indexedRepos: [...repoMap.values()],
    discoveredRepoCount: catalog.discoveredRepoCount,
    syncedAt: new Date().toISOString(),
  });
  await db.batch([
    { sql: "INSERT INTO catalog_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [SNAPSHOT_KEYS.extensions, extSnap] },
  ], 'write');
  console.log(`[registry] browse snapshots: extensions ${Math.round(extSnap.length / 1024)} KB`);
  // Optional CDN purge (names only: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID). Without them the 5-minute s-maxage applies.
  if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) {
    const res = await fetch('https://api.netlify.com/api/v1/purge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: process.env.NETLIFY_SITE_ID, cache_tags: [CACHE_TAG] }),
    });
    console.log(`[registry] CDN purge (${CACHE_TAG}): HTTP ${res.status}`);
  } else {
    console.log('[registry] CDN purge skipped (NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID not set); pages refresh within 5 minutes');
  }
}