/**
 * GitLab support (gitlab.com and self-hosted): REST API v4 project metadata, topic discovery and raw files.
 * Unauthenticated by default; set GITLAB_TOKEN (optional) for higher rate limits. Only public projects are listed.
 */
import type { KnownExtensionRepo } from '~/types/ui-module';
import type { RepoForkFields } from '~/lib/fork-groups';

export const DEFAULT_GITLAB_HOST = 'gitlab.com';
const UA = 'Antora-Extensions-Registry';

export function isGitHubHost(host?: string): boolean {
  return !host || host.toLowerCase() === 'github.com';
}

/** `gitlab.com/group/sub/project` style key; GitHub keys stay `owner/repo`. */
export function hostQualified(host: string | undefined, owner: string, repo: string): string {
  return isGitHubHost(host) ? `${owner}/${repo}` : `${host!.toLowerCase()}/${owner}/${repo}`;
}

export function gitlabProjectUrl(host: string, owner: string, repo: string): string {
  return `https://${host}/${owner}/${repo}`;
}

/** Raw file URL base: `https://<host>/<owner>/<repo>/-/raw/`, followed by `<ref>/<path>`. */
export function gitlabRawBase(host: string, owner: string, repo: string): string {
  return `https://${host}/${owner}/${repo}/-/raw/`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' };
  if (process.env.GITLAB_TOKEN) h['PRIVATE-TOKEN'] = process.env.GITLAB_TOKEN;
  return h;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** GET with one polite retry on 429 (honours Retry-After up to 30 s). */
async function getJson<T>(url: string, fetchImpl: FetchLike): Promise<{ data: T | null; res: Response | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: headers(), signal: AbortSignal.timeout(15_000) });
      if (res.status === 429 && attempt === 0) {
        const wait = Math.min(30, Number(res.headers.get('retry-after') ?? 5)) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) return { data: null, res };
      return { data: (await res.json()) as T, res };
    } catch {
      return { data: null, res: null };
    }
  }
  return { data: null, res: null };
}

export interface GitLabProject {
  id: number;
  path: string;
  path_with_namespace: string;
  namespace?: { full_path: string };
  description?: string | null;
  default_branch?: string;
  star_count?: number;
  last_activity_at?: string;
  archived?: boolean;
  topics?: string[];
  tag_list?: string[];
  web_url?: string;
  visibility?: string;
  forked_from_project?: { path_with_namespace: string; default_branch?: string; web_url?: string } | null;
}

export function splitPath(pathWithNamespace: string): { owner: string; repo: string } {
  const i = pathWithNamespace.lastIndexOf('/');
  return { owner: pathWithNamespace.slice(0, i), repo: pathWithNamespace.slice(i + 1) };
}

export async function fetchGitLabProject(host: string, owner: string, repo: string, fetchImpl: FetchLike = fetch): Promise<GitLabProject | null> {
  const id = encodeURIComponent(`${owner}/${repo}`);
  return (await getJson<GitLabProject>(`https://${host}/api/v4/projects/${id}`, fetchImpl)).data;
}

/**
 * GitLab project -> the GitHub-shaped fields fork grouping uses. `forked_from_project` is the direct parent;
 * GitLab has no "source" (network root), so the parent is used for both, host-qualified for grouping.
 */
export function gitlabForkFields(host: string, p: GitLabProject): RepoForkFields & { archived?: boolean; stars: number } {
  const parent = p.forked_from_project?.path_with_namespace;
  const q = parent ? `${host.toLowerCase()}/${parent}` : undefined;
  return {
    fork: Boolean(parent),
    default_branch: p.default_branch,
    pushed_at: p.last_activity_at,
    topics: p.topics ?? p.tag_list ?? [],
    owner: { login: splitPath(p.path_with_namespace).owner },
    parent: q ? { full_name: q, default_branch: p.forked_from_project?.default_branch } : undefined,
    source: q ? { full_name: q, default_branch: p.forked_from_project?.default_branch } : undefined,
    archived: p.archived,
    stars: p.star_count ?? 0,
  };
}

/** Public projects with the topic, paginated (per_page 100, at most `maxPages`). Stops early on errors or rate limits. */
export async function discoverGitLabByTopic(topic = 'antora-extension', host = DEFAULT_GITLAB_HOST, maxPages = 3, fetchImpl: FetchLike = fetch): Promise<KnownExtensionRepo[]> {
  const out: KnownExtensionRepo[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://${host}/api/v4/projects?topic=${encodeURIComponent(topic)}&visibility=public&archived=false&simple=false&per_page=100&page=${page}&order_by=last_activity_at`;
    const { data, res } = await getJson<GitLabProject[]>(url, fetchImpl);
    if (!data) break;
    for (const p of data) {
      const { owner, repo } = splitPath(p.path_with_namespace);
      out.push({ host, owner, repo, branch: p.default_branch, discoveredVia: 'gitlab-topic', githubTopics: p.topics ?? p.tag_list ?? [] });
    }
    const next = res?.headers.get('x-next-page');
    if (data.length < 100 || next === '') break;
  }
  return out;
}

/** Raw text of a file on the given ref (raw URL; works unauthenticated for public projects). */
export async function fetchGitLabRaw(host: string, owner: string, repo: string, ref: string, filePath: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(`${gitlabRawBase(host, owner, repo)}${encodeURI(ref)}/${filePath}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Parses `https://<host>/<group>/.../<project>` (any non-GitHub host) or `gitlab:group/project`. */
export function parseGitLabUrl(input: string): { host: string; owner: string; repo: string } | null {
  const s = input.trim().replace(/^git\+/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  const short = s.match(/^gitlab:([^#]+)/);
  if (short) {
    const { owner, repo } = splitPath(short[1]);
    return owner ? { host: DEFAULT_GITLAB_HOST, owner, repo } : null;
  }
  const m = s.match(/^(?:https?:\/\/|ssh:\/\/git@|git@)([^/:]+)[/:](.+)$/);
  if (!m || isGitHubHost(m[1])) return null;
  const path = m[2].split('/-/')[0];
  const { owner, repo } = splitPath(path);
  return owner && repo ? { host: m[1].toLowerCase(), owner, repo } : null;
}