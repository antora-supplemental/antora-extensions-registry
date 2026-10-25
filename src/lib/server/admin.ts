import { cache } from '@solidjs/router';
import { getRequestEvent } from 'solid-js/web';

export interface AdminQueueItem {
  id: string;
  kind: 'theme' | 'extension';
  name: string;
  repoUrl: string;
  detail: string;
  submittedAt: string;
}

export interface AdminData {
  queue: AdminQueueItem[];
  catalogSource: string;
  syncedAt: string | null;
  discoveredRepoCount: number;
  indexedRepos: Array<{ owner: string; repo: string; moduleCount: number; recipeCount: number }>;
  discoveredRepos: Array<{ owner: string; repo: string }>;
  manifests: Array<{ catalogId: string; name: string; manifestPath: string }>;
  loadErrors: string[];
}

async function currentAdmin(): Promise<boolean> {
  const event = getRequestEvent();
  if (!event) return false;
  const { auth } = await import('~/server/auth');
  const { isAdminUser } = await import('~/server/admin');
  const session = await auth.api.getSession({ headers: event.request.headers });
  return isAdminUser(session?.user?.id);
}

/** Whether the signed-in user may open /admin. */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  'use server';
  return currentAdmin();
}, 'is-admin');

/** Everything the admin page shows; null when the caller is not an admin. */
export const loadAdminData = cache(async (): Promise<AdminData | null> => {
  'use server';
  if (!(await currentAdmin())) return null;

  const loadErrors: string[] = [];
  const queue: AdminQueueItem[] = [];
  try {
    const { eq } = await import('drizzle-orm');
    const { db } = await import('~/server/db');
    const { themes, extensionRepos } = await import('~/server/db/schema');
    const pendingThemes = await db.select().from(themes).where(eq(themes.status, 'pending'));
    for (const t of pendingThemes) {
      queue.push({ id: t.id, kind: 'theme', name: t.name, repoUrl: t.repoUrl, detail: `by ${t.authorName}`, submittedAt: t.createdAt.toISOString() });
    }
    const pendingRepos = await db.select().from(extensionRepos).where(eq(extensionRepos.status, 'pending'));
    for (const r of pendingRepos) {
      queue.push({
        id: r.id,
        kind: 'extension',
        name: `${r.owner}/${r.name}`,
        repoUrl: r.repoUrl,
        detail: `${r.moduleCount} modules, ${r.recipeCount} bundles`,
        submittedAt: r.createdAt.toISOString(),
      });
    }
  } catch (error) {
    loadErrors.push(`Review queue: ${error instanceof Error ? error.message : String(error)}`);
  }

  let catalogSource = 'unavailable';
  let syncedAt: string | null = null;
  let discoveredRepoCount = 0;
  let indexedRepos: AdminData['indexedRepos'] = [];
  let manifests: AdminData['manifests'] = [];
  const discoveredRepos: AdminData['discoveredRepos'] = [];
  try {
    const { buildFullExtensionCatalog } = await import('~/lib/extension-catalog');
    const { knownExtensionRepos } = await import('~/data/extension-repos');
    const catalog = await buildFullExtensionCatalog({ includeTopicDiscovery: true });
    catalogSource = catalog.source ?? 'live';
    syncedAt = catalog.syncedAt ?? null;
    discoveredRepoCount = catalog.discoveredRepoCount;
    indexedRepos = catalog.indexedRepos.map((r) => ({ owner: r.owner, repo: r.repo, moduleCount: r.moduleCount, recipeCount: r.recipeCount }));
    const curated = new Set(knownExtensionRepos.map((r) => `${r.owner}/${r.repo}`.toLowerCase()));
    for (const r of indexedRepos) {
      if (!curated.has(`${r.owner}/${r.repo}`.toLowerCase())) discoveredRepos.push({ owner: r.owner, repo: r.repo });
    }
    manifests = [...catalog.modules, ...catalog.recipes]
      .map((e) => ({ catalogId: e.catalogId, name: e.name, manifestPath: e.manifestPath }))
      .sort((a, b) => a.catalogId.localeCompare(b.catalogId));
  } catch (error) {
    loadErrors.push(`Extension catalog: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { queue, catalogSource, syncedAt, discoveredRepoCount, indexedRepos, discoveredRepos, manifests, loadErrors };
}, 'admin-data');
