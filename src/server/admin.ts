import { and, eq } from 'drizzle-orm';
import { serverEnv } from '~/env/server';
import { db } from '~/server/db';
import { accounts } from '~/server/db/auth-schema';

/** GitHub logins allowed into /admin, from ADMIN_GITHUB_LOGINS (comma-separated, case-insensitive). */
export function adminGithubLogins(): string[] {
  return (serverEnv.ADMIN_GITHUB_LOGINS ?? '')
    .split(',')
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
}

const loginCache = new Map<string, { login: string | null; at: number }>();
const LOGIN_TTL_MS = 60 * 60 * 1000;

/** Resolves the GitHub login for a numeric GitHub account id (cached for an hour). */
export async function githubLoginForAccountId(accountId: string): Promise<string | null> {
  const hit = loginCache.get(accountId);
  if (hit && Date.now() - hit.at < LOGIN_TTL_MS) return hit.login;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Antora-Extensions-Registry',
  };
  if (serverEnv.GITHUB_TOKEN) headers.Authorization = `Bearer ${serverEnv.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/user/${encodeURIComponent(accountId)}`, { headers });
  if (!res.ok) return hit?.login ?? null;
  const login = ((await res.json()) as { login?: string }).login?.toLowerCase() ?? null;
  loginCache.set(accountId, { login, at: Date.now() });
  return login;
}

/** True when the user has a linked GitHub sign-in whose login is listed in ADMIN_GITHUB_LOGINS. */
export async function isAdminUser(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const allowed = adminGithubLogins();
  if (allowed.length === 0) return false;
  try {
    const rows = await db
      .select({ accountId: accounts.accountId })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'github')));
    for (const row of rows) {
      const login = await githubLoginForAccountId(row.accountId);
      if (login && allowed.includes(login)) return true;
    }
  } catch (error) {
    console.error('[registry] admin check failed:', error);
  }
  return false;
}

/** Linked GitHub and GitLab logins for a user (used for trusted-publisher matching). */
export async function linkedLogins(userId: string): Promise<{ githubLogins: string[]; gitlabLogins: string[] }> {
  const out = { githubLogins: [] as string[], gitlabLogins: [] as string[] };
  try {
    const rows = await db
      .select({ providerId: accounts.providerId, accountId: accounts.accountId })
      .from(accounts)
      .where(eq(accounts.userId, userId));
    for (const row of rows) {
      if (row.providerId === 'github') {
        const login = await githubLoginForAccountId(row.accountId);
        if (login) out.githubLogins.push(login);
      } else if (row.providerId === 'gitlab') {
        const res = await fetch(`https://gitlab.com/api/v4/users/${encodeURIComponent(row.accountId)}`);
        if (res.ok) {
          const u = (await res.json()) as { username?: string };
          if (u.username) out.gitlabLogins.push(u.username.toLowerCase());
        }
      }
    }
  } catch (error) {
    console.error('[registry] linked login lookup failed:', error);
  }
  return out;
}
