/**
 * Fetch the catalog from GitHub (GITHUB_TOKEN recommended) and upsert it into Turso.
 * Env: DB_URL, DB_AUTH_TOKEN, GITHUB_TOKEN. Also syncs curated themes.
 */
import { createClient } from '@libsql/client';
import { buildFullExtensionCatalog } from '../src/lib/extension-catalog';
import { themesFromKnownRepos } from '../src/data/known-theme-repos';

const url = process.env.DB_URL;
if (!url) throw new Error('DB_URL is required');
const db = createClient({ url, authToken: process.env.DB_AUTH_TOKEN });

const catalog = await buildFullExtensionCatalog({ includeTopicDiscovery: true, live: true });
const entries = [...catalog.modules, ...catalog.recipes];
if (entries.length === 0) throw new Error('Catalog came back empty; refusing to wipe the database.');

const now = Math.floor(Date.now() / 1000);
const stmts = [
  { sql: 'DELETE FROM catalog_entry', args: [] },
  ...entries.map((e) => ({
    sql: 'INSERT INTO catalog_entry (catalogId, repoOwner, repoName, type, name, version, payload, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [e.catalogId, e.repositoryOwner ?? '', e.repositoryName ?? '', e.type, e.name, e.version, JSON.stringify(e), now],
  })),
  ...catalog.indexedRepos.map((r) => ({
    sql: `INSERT INTO extension_repo (id, repoUrl, owner, name, catalogSource, moduleCount, recipeCount, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'github-sync', ?, ?, 'approved', ?, ?)
          ON CONFLICT(repoUrl) DO UPDATE SET moduleCount = excluded.moduleCount, recipeCount = excluded.recipeCount, updatedAt = excluded.updatedAt`,
    args: [`${r.owner}/${r.repo}`.toLowerCase(), `https://github.com/${r.owner}/${r.repo}`, r.owner, r.repo, r.moduleCount, r.recipeCount, now, now],
  })),
  ...themesFromKnownRepos().map((t) => ({
    sql: `INSERT INTO theme (id, name, description, authorName, repoUrl, demoUrl, previewImage, stars, tags, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'approved', ?, ?)
          ON CONFLICT(repoUrl) DO UPDATE SET name = excluded.name, description = excluded.description, demoUrl = excluded.demoUrl,
            previewImage = excluded.previewImage, tags = excluded.tags, updatedAt = excluded.updatedAt`,
    args: [t.id, t.name, t.description, t.author, t.repoUrl, t.demoUrl ?? null, t.previewImage ?? null, JSON.stringify(t.tags), now, now],
  })),
  { sql: "INSERT INTO catalog_meta (key, value) VALUES ('syncedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [new Date().toISOString()] },
  { sql: "INSERT INTO catalog_meta (key, value) VALUES ('discoveredRepoCount', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [String(catalog.discoveredRepoCount)] },
];
await db.batch(stmts, 'write');
console.log(`[registry] synced ${entries.length} catalog entries from ${catalog.indexedRepos.length} repos into the database`);
