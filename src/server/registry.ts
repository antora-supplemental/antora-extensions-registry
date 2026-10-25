import { checkRepository, type RepoCheckResult } from '~/lib/registry-check';
import { publishExtensionRepo, repoStatus, trustedReason, upsertApprovedTheme } from '~/lib/registry-write';
import { client } from '~/server/db';
import { linkedLogins } from '~/server/admin';

export interface ImportOutcome {
  check: RepoCheckResult;
  imported: boolean;
  /** Plain-language result shown in the UI. */
  message: string;
  approvedVia: string | null;
}

/**
 * Check a repository against the registry criteria and import it when it passes.
 * Used by the /add expedite form (with a user) and admin discovery (without).
 */
export async function checkAndImport(repoUrl: string, userId: string | null): Promise<ImportOutcome> {
  const check = await checkRepository(repoUrl);
  if (!check.passed || !check.owner || !check.repo) {
    return { check, imported: false, approvedVia: null, message: 'Not imported: fix the failed criteria and check again.' };
  }
  const existing = await repoStatus(client, check.repoUrl);
  if (existing?.status === 'rejected') {
    return {
      check,
      imported: false,
      approvedVia: null,
      message: `Not imported: an admin rejected this repository${existing.reviewNote ? ` (${existing.reviewNote})` : ''}. Open an issue to ask for another review.`,
    };
  }
  const trusted = await trustedReason(
    client,
    { host: 'github', owner: check.owner },
    userId ? await linkedLogins(userId) : undefined,
  );
  const approvedVia = trusted ?? 'Meets the registry criteria (automatic check)';

  if (check.kind === 'theme' && check.theme) {
    await upsertApprovedTheme(client, check.theme, { submittedBy: userId, approvedVia });
  } else if (check.kind === 'extension' && check.extension) {
    await publishExtensionRepo(
      client,
      { owner: check.owner, name: check.repo, repoUrl: check.repoUrl, source: check.extension.source, moduleCount: check.extension.moduleCount, recipeCount: check.extension.recipeCount },
      check.extension.entries,
      { submittedBy: userId, approvedVia },
    );
  }
  const what = check.kind === 'theme' ? 'Listed in Themes' : `Listed in Extensions (${check.extension?.entries.length ?? 0} entries)`;
  return { check, imported: true, approvedVia, message: `${what}. ${approvedVia}.` };
}

/** Trusted-publisher reason for a form submission, or null when it needs review. */
export async function submissionTrust(repoOwner: string, userId: string): Promise<string | null> {
  return trustedReason(client, { host: 'github', owner: repoOwner }, await linkedLogins(userId));
}

export interface ReviewResult {
  ok: boolean;
  message: string;
}

/** Publish a pending theme or extension repository. Shared by admin review and trusted submissions. */
export async function approveItem(
  kind: 'theme' | 'extension',
  id: string,
  reviewedBy: string | null,
  approvedVia: string,
): Promise<ReviewResult> {
  const now = Math.floor(Date.now() / 1000);
  if (kind === 'theme') {
    const row = (await client.execute({ sql: 'SELECT repoUrl, name FROM theme WHERE id = ?', args: [id] })).rows[0];
    if (!row) return { ok: false, message: 'Theme not found.' };
    // Fill appearance/base theme/preview from the repository when they can be read; approval doesn't require it.
    const check = await checkRepository(String(row.repoUrl)).catch(() => null);
    const t = check?.theme;
    await client.execute({
      sql: `UPDATE theme SET status = 'approved', reviewNote = NULL, reviewedBy = ?, reviewedAt = ?, approvedVia = ?, updatedAt = ?,
              appearance = COALESCE(?, appearance), baseTheme = COALESCE(?, baseTheme), previewImage = COALESCE(?, previewImage)
            WHERE id = ?`,
      args: [reviewedBy, now, approvedVia, now, t?.appearance ?? null, t?.baseTheme ?? null, t?.previewImage || null, id],
    });
    return { ok: true, message: `Approved ${row.name}: it's now listed in Themes.` };
  }

  const row = (await client.execute({ sql: 'SELECT owner, name, repoUrl, submittedBy FROM extension_repo WHERE id = ?', args: [id] })).rows[0];
  if (!row) return { ok: false, message: 'Extension repository not found.' };
  const { buildExtensionCatalog } = await import('~/lib/ui-modules');
  const catalog = await buildExtensionCatalog([{ owner: String(row.owner), repo: String(row.name), discoveredVia: 'submission' }]);
  const entries = [...catalog.modules, ...catalog.recipes];
  if (entries.length === 0) {
    return { ok: false, message: `Not approved: no manifest could be read from ${row.owner}/${row.name}, so there is nothing to list.` };
  }
  await publishExtensionRepo(
    client,
    { owner: String(row.owner), name: String(row.name), repoUrl: String(row.repoUrl), source: 'submission', moduleCount: catalog.modules.length, recipeCount: catalog.recipes.length },
    entries,
    { submittedBy: (row.submittedBy as string | null) ?? null, reviewedBy, approvedVia },
  );
  return { ok: true, message: `Approved ${row.owner}/${row.name}: ${entries.length} ${entries.length === 1 ? 'entry is' : 'entries are'} now listed in Extensions.` };
}

export async function rejectItem(kind: 'theme' | 'extension', id: string, reviewedBy: string | null, reason: string | null): Promise<ReviewResult> {
  const now = Math.floor(Date.now() / 1000);
  const table = kind === 'theme' ? 'theme' : 'extension_repo';
  const row = (await client.execute({ sql: `SELECT repoUrl FROM ${table} WHERE id = ?`, args: [id] })).rows[0];
  if (!row) return { ok: false, message: 'Item not found.' };
  await client.execute({
    sql: `UPDATE ${table} SET status = 'rejected', reviewNote = ?, reviewedBy = ?, reviewedAt = ?, approvedVia = NULL, updatedAt = ? WHERE id = ?`,
    args: [reason, reviewedBy, now, now, id],
  });
  if (kind === 'extension') {
    const r = (await client.execute({ sql: 'SELECT owner, name FROM extension_repo WHERE id = ?', args: [id] })).rows[0];
    if (r) await client.execute({ sql: 'DELETE FROM catalog_entry WHERE lower(repoOwner) = lower(?) AND lower(repoName) = lower(?)', args: [r.owner, r.name] });
  }
  return { ok: true, message: `Rejected ${row.repoUrl}${reason ? `: ${reason}` : ''}. The record is kept, and discovery won't re-import it.` };
}
