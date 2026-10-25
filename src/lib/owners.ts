/**
 * Owner (user / organization) metadata for GitHub and GitLab, plus cached avatars.
 * Avatars follow the preview-cache rules: cached once a fetch returns a valid image, a failed first fetch is
 * never cached, and a cached avatar survives later failures (marked stale). Requested at 64px.
 */
import type { ExtensionCatalogEntry, OwnerInfo } from '~/types/ui-module';
import { fetchImage, PREVIEW_ROUTE, type PreviewStore } from '~/lib/preview-cache';
import type { FetchLike } from '~/lib/preview-check';
import { ownerHost, ownerKey, profileUrl } from '~/lib/owner-paths';
export { ownerHost, ownerKey, ownerPath, profileUrl, entriesByOwner } from '~/lib/owner-paths';

export const AVATAR_PX = 64;

/** Small avatar URL on the forge. */
export function sizedAvatar(url: string, host: string): string {
  const u = new URL(url);
  if (host === 'github.com' || /githubusercontent\.com$/.test(u.hostname)) u.searchParams.set('s', String(AVATAR_PX));
  else u.searchParams.set('width', String(AVATAR_PX));
  return u.toString();
}

type GitHubUser = { login: string; type?: string; name?: string | null; avatar_url?: string; html_url?: string };
type GitLabNamespace = { full_path: string; kind?: string; name?: string; avatar_url?: string | null; web_url?: string };

export function fromGitHubUser(u: GitHubUser): OwnerInfo {
  return {
    host: 'github.com',
    login: u.login,
    type: u.type === 'Organization' ? 'org' : 'user',
    profileUrl: u.html_url ?? profileUrl('github.com', u.login),
    ...(u.avatar_url ? { avatarUrl: u.avatar_url } : {}),
    ...(u.name ? { displayName: u.name } : {}),
  };
}

export function fromGitLabNamespace(host: string, n: GitLabNamespace): OwnerInfo {
  const avatar = n.avatar_url ? (n.avatar_url.startsWith('/') ? `https://${host}${n.avatar_url}` : n.avatar_url) : undefined;
  return {
    host,
    login: n.full_path,
    type: n.kind === 'group' ? 'org' : 'user',
    profileUrl: n.web_url ?? profileUrl(host, n.full_path),
    ...(avatar ? { avatarUrl: avatar } : {}),
    ...(n.name ? { displayName: n.name } : {}),
  };
}

/** Owner metadata from the forge API; falls back to login + profile URL when the API is unavailable. */
export async function fetchOwner(host: string, login: string, fetchImpl: FetchLike = fetch): Promise<OwnerInfo> {
  const fallback: OwnerInfo = { host, login, type: 'user', profileUrl: profileUrl(host, login) };
  try {
    if (host === 'github.com') {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'Antora-Extensions-Registry' };
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const res = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers });
      return res.ok ? fromGitHubUser((await res.json()) as GitHubUser) : fallback;
    }
    const headers: Record<string, string> = { 'User-Agent': 'Antora-Extensions-Registry' };
    if (process.env.GITLAB_TOKEN) headers['PRIVATE-TOKEN'] = process.env.GITLAB_TOKEN;
    const res = await fetchImpl(`https://${host}/api/v4/namespaces/${encodeURIComponent(login)}`, { headers });
    return res.ok ? fromGitLabNamespace(host, (await res.json()) as GitLabNamespace) : fallback;
  } catch {
    return fallback;
  }
}

/** Owner keys for every entry (used to keep their avatars when purging the cache). */
export function ownerKeys(entries: ExtensionCatalogEntry[]): string[] {
  return [...new Set(entries.map((e) => ownerKey(ownerHost(e), e.repositoryOwner)))];
}

/** Fills `entry.owner` for every entry and caches avatars. Returns the distinct owners. */
export async function syncOwners(
  entries: ExtensionCatalogEntry[],
  store: PreviewStore,
  fetchImpl: FetchLike = fetch,
  lookup: (host: string, login: string) => Promise<OwnerInfo> = (h, l) => fetchOwner(h, l, fetchImpl),
): Promise<OwnerInfo[]> {
  const owners = new Map<string, OwnerInfo>();
  for (const e of entries) {
    const host = ownerHost(e);
    const key = ownerKey(host, e.repositoryOwner);
    let info = owners.get(key);
    if (!info) {
      info = await lookup(host, e.repositoryOwner);
      const prior = (await store.list(key))[0];
      const got = info.avatarUrl ? await fetchImage(sizedAvatar(info.avatarUrl, host), fetchImpl, 1024 * 1024) : null;
      if (got?.ok) {
        if (!prior || prior.hash !== got.hash || prior.stale) {
          await store.put({ catalogId: key, sourceUrl: 'avatar', hash: got.hash, contentType: got.contentType, source: 'curated', stale: false }, got.bytes);
        }
        info = { ...info, avatar: PREVIEW_ROUTE + got.hash };
      } else if (prior) {
        await store.markStale(key, 'avatar');
        info = { ...info, avatar: PREVIEW_ROUTE + prior.hash };
      }
      owners.set(key, info);
    }
    e.owner = info;
  }
  return [...owners.values()];
}

export const OWNERS_DDL =
  `CREATE TABLE IF NOT EXISTS owner (host TEXT NOT NULL, login TEXT NOT NULL, type TEXT NOT NULL, profileUrl TEXT NOT NULL,
     avatarUrl TEXT, avatar TEXT, displayName TEXT, packageCount INTEGER NOT NULL DEFAULT 0, updatedAt INTEGER NOT NULL, PRIMARY KEY (host, login))`;