/**
 * Writes for registry imports. Takes a raw libsql client so the daily sync
 * script and the server share one implementation.
 */
import type { Client } from '@libsql/client';
import { firstListedStatements } from '~/lib/first-listed';
import type { Theme } from '~/types/theme';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

type Status = 'pending' | 'approved' | 'rejected';

export async function repoStatus(db: Client, repoUrl: string): Promise<{ kind: 'theme' | 'extension'; status: Status; reviewNote: string | null } | null> {
  const t = await db.execute({ sql: 'SELECT status, reviewNote FROM theme WHERE lower(repoUrl) = lower(?) LIMIT 1', args: [repoUrl] });
  if (t.rows[0]) return { kind: 'theme', status: t.rows[0].status as Status, reviewNote: (t.rows[0].reviewNote as string | null) ?? null };
  const e = await db.execute({ sql: 'SELECT status, reviewNote FROM extension_repo WHERE lower(repoUrl) = lower(?) LIMIT 1', args: [repoUrl] });
  if (e.rows[0]) return { kind: 'extension', status: e.rows[0].status as Status, reviewNote: (e.rows[0].reviewNote as string | null) ?? null };
  return null;
}

/** Insert or update an approved theme. */
export async function upsertApprovedTheme(db: Client, theme: Theme, opts: { submittedBy?: string | null; reviewedBy?: string | null; approvedVia?: string | null } = {}) {
  const now = Math.floor(Date.now() / 1000);
  await db.execute({
    sql: `INSERT INTO theme (id, name, description, authorId, authorName, repoUrl, demoUrl, previewImage, stars, tags, status, appearance, baseTheme, reviewedBy, reviewedAt, approvedVia, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(repoUrl) DO UPDATE SET description = excluded.description, demoUrl = excluded.demoUrl,
            previewImage = excluded.previewImage, stars = excluded.stars, tags = excluded.tags, status = 'approved',
            appearance = excluded.appearance, baseTheme = excluded.baseTheme, reviewedBy = excluded.reviewedBy,
            reviewedAt = excluded.reviewedAt, approvedVia = excluded.approvedVia, updatedAt = excluded.updatedAt`,
    args: [
      theme.id, theme.name, theme.description, opts.submittedBy ?? null, theme.author, theme.repoUrl,
      theme.demoUrl || null, theme.previewImage || null, theme.stars, JSON.stringify(theme.tags),
      theme.appearance ?? null, theme.baseTheme ?? null, opts.reviewedBy ?? null, now, opts.approvedVia ?? null, now, now,
    ],
  });
  // First listing only; later approvals and updates keep the original date.
  await db.execute({
    sql: "INSERT OR IGNORE INTO first_listed (id, kind, itemId, firstListedAt) SELECT 'theme:' || id, 'theme', id, ? FROM theme WHERE repoUrl = ?",
    args: [now, theme.repoUrl],
  });
}

/** Replace a repository's catalog entries and mark the repository approved. */
export async function publishExtensionRepo(
  db: Client,
  repo: { owner: string; name: string; repoUrl: string; source: string; moduleCount: number; recipeCount: number },
  entries: ExtensionCatalogEntry[],
  opts: { submittedBy?: string | null; reviewedBy?: string | null; approvedVia?: string | null } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  await db.batch(
    [
      { sql: 'DELETE FROM catalog_entry WHERE lower(repoOwner) = lower(?) AND lower(repoName) = lower(?)', args: [repo.owner, repo.name] },
      ...entries.map((e) => ({
        sql: 'INSERT OR REPLACE INTO catalog_entry (catalogId, repoOwner, repoName, type, name, version, payload, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [e.catalogId, e.repositoryOwner ?? repo.owner, e.repositoryName ?? repo.name, e.type, e.name, e.version, JSON.stringify(e), now],
      })),
      {
        sql: `INSERT INTO extension_repo (id, repoUrl, owner, name, catalogSource, moduleCount, recipeCount, status, submittedBy, reviewedBy, reviewedAt, approvedVia, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)
              ON CONFLICT(repoUrl) DO UPDATE SET status = 'approved', catalogSource = excluded.catalogSource, moduleCount = excluded.moduleCount,
                recipeCount = excluded.recipeCount, reviewedBy = excluded.reviewedBy, reviewedAt = excluded.reviewedAt, approvedVia = excluded.approvedVia, updatedAt = excluded.updatedAt`,
        args: [`${repo.owner}/${repo.name}`.toLowerCase(), repo.repoUrl, repo.owner, repo.name, repo.source, repo.moduleCount, repo.recipeCount, opts.submittedBy ?? null, opts.reviewedBy ?? null, now, opts.approvedVia ?? null, now, now],
      },
      ...firstListedStatements('extension', entries.map((e) => ({ id: e.catalogId, at: now }))),
    ],
    'write',
  );
}

export type TrustedKind = 'github_user' | 'github_org' | 'gitlab_user' | 'gitlab_group';
export interface TrustedPublisher { id: string; kind: TrustedKind; name: string; addedBy: string | null; note: string | null; createdAt: number }

export const SEED_TRUSTED_PUBLISHERS: Array<{ kind: TrustedKind; name: string; note: string }> = [
  { kind: 'github_org', name: 'antora-supplemental', note: 'Registry maintainers' },
];

export async function listTrustedPublishers(db: Client): Promise<TrustedPublisher[]> {
  const r = await db.execute('SELECT id, kind, name, addedBy, note, createdAt FROM trusted_publisher ORDER BY kind, name');
  return r.rows.map((x) => ({ id: String(x.id), kind: x.kind as TrustedKind, name: String(x.name), addedBy: (x.addedBy as string) ?? null, note: (x.note as string) ?? null, createdAt: Number(x.createdAt) }));
}

export async function addTrustedPublisher(db: Client, kind: TrustedKind, name: string, addedBy: string | null, note: string | null) {
  const n = name.trim().toLowerCase();
  await db.execute({
    sql: 'INSERT INTO trusted_publisher (id, kind, name, addedBy, note, createdAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
    args: [`${kind}:${n}`, kind, n, addedBy, note, Math.floor(Date.now() / 1000)],
  });
}

const ghHeaders = (): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Antora-Extensions-Registry',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

/**
 * Why a submission is trusted, or null. Checks the repository owner first, then
 * the submitter's linked GitHub/GitLab logins and their public GitHub org memberships.
 */
export async function trustedReason(
  db: Client,
  repo: { host: 'github' | 'gitlab'; owner: string },
  submitter?: { githubLogins?: string[]; gitlabLogins?: string[] },
): Promise<string | null> {
  const list = await listTrustedPublishers(db);
  if (list.length === 0) return null;
  const has = (kind: TrustedKind, name: string) => list.some((t) => t.kind === kind && t.name === name.toLowerCase());
  const owner = repo.owner.toLowerCase();
  if (repo.host === 'github') {
    if (has('github_org', owner)) return `Trusted publisher: repository owner is GitHub org ${owner}`;
    if (has('github_user', owner)) return `Trusted publisher: repository owner is GitHub user ${owner}`;
  } else {
    const top = owner.split('/')[0];
    if (has('gitlab_group', owner) || has('gitlab_group', top)) return `Trusted publisher: repository is in GitLab group ${top}`;
    if (has('gitlab_user', owner)) return `Trusted publisher: repository owner is GitLab user ${owner}`;
  }
  for (const login of submitter?.githubLogins ?? []) {
    if (has('github_user', login)) return `Trusted publisher: submitted by GitHub user ${login.toLowerCase()}`;
    if (list.some((t) => t.kind === 'github_org')) {
      try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/orgs`, { headers: ghHeaders() });
        if (res.ok) {
          for (const org of (await res.json()) as Array<{ login: string }>) {
            if (has('github_org', org.login)) return `Trusted publisher: submitter ${login.toLowerCase()} is a public member of GitHub org ${org.login.toLowerCase()}`;
          }
        }
      } catch { /* membership is best effort */ }
    }
  }
  for (const login of submitter?.gitlabLogins ?? []) {
    if (has('gitlab_user', login)) return `Trusted publisher: submitted by GitLab user ${login.toLowerCase()}`;
  }
  return null;
}
