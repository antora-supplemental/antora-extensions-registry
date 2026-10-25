import type { AdminReport } from '~/lib/server/reports';
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
  reports: AdminReport[];
  trusted: Array<{ id: string; kind: string; name: string; note: string | null; addedBy: string | null }>;
  recentApprovals: Array<{ kind: 'theme' | 'extension'; name: string; repoUrl: string; approvedVia: string; at: string | null }>;
  loadErrors: string[];
}

/** The signed-in admin's user id, or null. Every admin server function checks this on the server. */
async function currentAdminId(): Promise<string | null> {
  const event = getRequestEvent();
  if (!event) return null;
  const { auth } = await import('~/server/auth');
  const { isAdminUser } = await import('~/server/admin');
  const session = await auth.api.getSession({ headers: event.request.headers });
  return (await isAdminUser(session?.user?.id)) ? session!.user.id : null;
}

async function currentAdmin(): Promise<boolean> {
  return (await currentAdminId()) !== null;
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

  let trusted: AdminData['trusted'] = [];
  const recentApprovals: AdminData['recentApprovals'] = [];
  try {
    const { client } = await import('~/server/db');
    const { listTrustedPublishers } = await import('~/lib/registry-write');
    trusted = (await listTrustedPublishers(client)).map((t) => ({ id: t.id, kind: t.kind, name: t.name, note: t.note, addedBy: t.addedBy }));
    const rows = await client.execute(`
      SELECT 'theme' AS kind, name, repoUrl, approvedVia, reviewedAt FROM theme WHERE approvedVia IS NOT NULL
      UNION ALL
      SELECT 'extension' AS kind, owner || '/' || name, repoUrl, approvedVia, reviewedAt FROM extension_repo WHERE approvedVia IS NOT NULL
      ORDER BY reviewedAt DESC LIMIT 20`);
    for (const r of rows.rows) {
      recentApprovals.push({
        kind: r.kind as 'theme' | 'extension',
        name: String(r.name),
        repoUrl: String(r.repoUrl),
        approvedVia: String(r.approvedVia),
        at: r.reviewedAt ? new Date(Number(r.reviewedAt) * 1000).toISOString() : null,
      });
    }
  } catch (error) {
    loadErrors.push(`Trusted publishers: ${error instanceof Error ? error.message : String(error)}`);
  }

  const reports: AdminData['reports'] = [];
  try {
    const { client } = await import('~/server/db');
    const rows = await client.execute(`
      SELECT r.id, r.itemKind, r.itemId, r.itemName, r.reason, r.message, r.createdAt, COALESCE(u.name, u.email, r.reporterId) AS reporter
      FROM report r LEFT JOIN user u ON u.id = r.reporterId
      WHERE r.status = 'open' ORDER BY r.createdAt DESC LIMIT 100`);
    for (const r of rows.rows) {
      reports.push({
        id: String(r.id), itemKind: String(r.itemKind), itemId: String(r.itemId), itemName: String(r.itemName),
        reason: String(r.reason), message: (r.message as string | null) ?? null, reporter: String(r.reporter),
        createdAt: new Date(Number(r.createdAt) * 1000).toISOString(),
      });
    }
  } catch (error) {
    loadErrors.push(`Reports: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { reports, trusted, recentApprovals, queue, catalogSource, syncedAt, discoveredRepoCount, indexedRepos, discoveredRepos, manifests, loadErrors };
}, 'admin-data');

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

/** Approve or reject a queue item. Admin-only; checked on the server. */
export async function reviewQueueItem(input: {
  kind: 'theme' | 'extension';
  id: string;
  decision: 'approve' | 'reject';
  reason?: string;
}): Promise<AdminActionResult> {
  'use server';
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, message: 'Admins only.' };
  if (input.kind !== 'theme' && input.kind !== 'extension') return { ok: false, message: 'Unknown item type.' };
  const { approveItem, rejectItem } = await import('~/server/registry');
  try {
    if (input.decision === 'approve') return await approveItem(input.kind, input.id, adminId, 'Approved by an admin');
    const reason = input.reason?.trim().slice(0, 500) || null;
    return await rejectItem(input.kind, input.id, adminId, reason);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

const TRUSTED_KINDS = ['github_user', 'github_org', 'gitlab_user', 'gitlab_group'] as const;

/** Add a trusted publisher. Admin-only. */
export async function addTrusted(input: { kind: string; name: string; note?: string }): Promise<AdminActionResult> {
  'use server';
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, message: 'Admins only.' };
  const kind = TRUSTED_KINDS.find((k) => k === input.kind);
  const name = input.name?.trim().replace(/^@/, '');
  if (!kind || !name || !/^[\w./-]+$/.test(name)) return { ok: false, message: 'Pick a type and enter a valid user, org or group name.' };
  const { client } = await import('~/server/db');
  const { addTrustedPublisher } = await import('~/lib/registry-write');
  await addTrustedPublisher(client, kind, name, adminId, input.note?.trim().slice(0, 200) || null);
  return { ok: true, message: `Added ${name.toLowerCase()} (${kind.replace('_', ' ')}).` };
}

/** Remove a trusted publisher. Admin-only. */
export async function removeTrusted(id: string): Promise<AdminActionResult> {
  'use server';
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, message: 'Admins only.' };
  const { client } = await import('~/server/db');
  await client.execute({ sql: 'DELETE FROM trusted_publisher WHERE id = ?', args: [id] });
  return { ok: true, message: `Removed ${id.split(':').slice(1).join(':')}.` };
}
