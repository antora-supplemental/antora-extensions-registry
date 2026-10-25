import { getRequestEvent } from 'solid-js/web';

export const CHECKS_PER_HOUR = 5;

export interface ExpediteResult {
  ok: boolean;
  /** Set when the request itself was refused (signed out, rate limited, bad input). */
  error?: string;
  repoUrl?: string;
  kind?: 'theme' | 'extension' | null;
  passed?: boolean;
  imported?: boolean;
  message?: string;
  criteria?: Array<{ id: string; label: string; ok: boolean; detail?: string }>;
  remaining?: number;
}

/** Signed-in users: check one repository now and import it if it meets the criteria. */
export async function expediteRepoCheck(repoUrl: string): Promise<ExpediteResult> {
  'use server';
  const event = getRequestEvent();
  if (!event) return { ok: false, error: 'No request.' };
  const { auth } = await import('~/server/auth');
  const session = await auth.api.getSession({ headers: event.request.headers });
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'Sign in to check a repository.' };
  const url = String(repoUrl ?? '').trim().slice(0, 300);
  if (!url) return { ok: false, error: 'Enter a GitHub repository URL.' };

  const { client } = await import('~/server/db');
  const since = Math.floor(Date.now() / 1000) - 3600;
  const used = Number(
    (await client.execute({ sql: 'SELECT COUNT(*) AS n FROM repo_check WHERE userId = ? AND createdAt > ?', args: [userId, since] })).rows[0]?.n ?? 0,
  );
  if (used >= CHECKS_PER_HOUR) {
    return { ok: false, error: `You've used all ${CHECKS_PER_HOUR} checks for this hour. Try again later.`, remaining: 0 };
  }

  const { checkAndImport } = await import('~/server/registry');
  let outcome;
  try {
    outcome = await checkAndImport(url, userId);
  } catch (error) {
    return { ok: false, error: `The check couldn't finish: ${error instanceof Error ? error.message : String(error)}` };
  }
  const { check } = outcome;
  await client.execute({
    sql: 'INSERT INTO repo_check (id, userId, repoUrl, kind, passed, imported, failures, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      crypto.randomUUID(), userId, check.repoUrl, check.kind, check.passed ? 1 : 0, outcome.imported ? 1 : 0,
      JSON.stringify(check.criteria.filter((c) => !c.ok)), Math.floor(Date.now() / 1000),
    ],
  });
  return {
    ok: true,
    repoUrl: check.repoUrl,
    kind: check.kind,
    passed: check.passed,
    imported: outcome.imported,
    message: outcome.message,
    criteria: check.criteria,
    remaining: CHECKS_PER_HOUR - used - 1,
  };
}
