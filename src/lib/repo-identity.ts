/**
 * Stable repository location across renames.
 */

export type RepoProvider = 'github';

export interface RepoLocation {
  provider: RepoProvider;
  repoId: number;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  ownerId?: number;
}

const GITHUB_API = 'https://api.github.com';

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Antora-Extensions-Registry',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface GitHubRepoPayload {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  owner: { login: string; id?: number };
}

function toLocation(data: GitHubRepoPayload): RepoLocation {
  return {
    provider: 'github',
    repoId: data.id,
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    htmlUrl: data.html_url,
    ownerId: data.owner.id,
  };
}

export async function resolveGitHubRepoById(repoId: number): Promise<RepoLocation | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repositories/${repoId}`, {
      headers: githubHeaders(),
    });
    if (!response.ok) return null;
    return toLocation((await response.json()) as GitHubRepoPayload);
  } catch {
    return null;
  }
}

export async function resolveGitHubRepo(
  owner: string,
  repo: string,
): Promise<RepoLocation | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: githubHeaders(),
    });
    if (!response.ok) return null;
    return toLocation((await response.json()) as GitHubRepoPayload);
  } catch {
    return null;
  }
}

export async function resolveKnownRepoRef(ref: {
  owner: string;
  repo: string;
  githubRepoId?: number;
}): Promise<(RepoLocation & { ref: typeof ref }) | null> {
  if (ref.githubRepoId) {
    const byId = await resolveGitHubRepoById(ref.githubRepoId);
    if (byId) return { ...byId, ref };
  }
  const byName = await resolveGitHubRepo(ref.owner, ref.repo);
  if (byName) return { ...byName, ref };
  return null;
}

export function dedupeReposById<T extends { owner: string; repo: string; githubRepoId?: number }>(
  repos: T[],
): T[] {
  const seenId = new Set<number>();
  const seenSlug = new Set<string>();
  const out: T[] = [];

  for (const ref of repos) {
    if (ref.githubRepoId) {
      if (seenId.has(ref.githubRepoId)) continue;
      seenId.add(ref.githubRepoId);
      out.push(ref);
      continue;
    }
    const slug = `${ref.owner}/${ref.repo}`.toLowerCase();
    if (seenSlug.has(slug)) continue;
    seenSlug.add(slug);
    out.push(ref);
  }

  return out;
}

export interface RepoClaimNote {
  githubRepoId: number;
  message: string;
}

export const REPO_CLAIM_GUIDANCE: RepoClaimNote = {
  githubRepoId: 0,
  message:
    'If a repository was deleted and recreated, the new repo has a new githubRepoId. ' +
    'Contact a registry curator to link your account (github owner id) to the new repo id. ' +
    'Automated claim verification is planned; not required for same-owner renames (id is preserved).',
};
