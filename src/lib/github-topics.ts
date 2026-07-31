import {
  ANTORA_TOPICS,
  EXTENSION_DISCOVERY_QUERY,
  THEME_DISCOVERY_QUERY,
  validateAntoraTopics,
  type PrimaryKind,
  type TopicValidationResult,
} from '~/data/github-topics';
import type { KnownExtensionRepo } from '~/types/ui-module';
import { dedupeReposById } from '~/lib/repo-identity';

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

export interface GitHubSearchRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  updated_at: string;
  topics?: string[];
  owner: { login: string; id?: number };
}

export interface TopicDiscoveredRepo {
  githubRepoId: number;
  owner: string;
  repo: string;
  repoUrl: string;
  topics: string[];
  primaryKind: PrimaryKind;
  topicValidation: TopicValidationResult;
  stars: number;
  description: string | null;
  lastUpdated: string;
}

export async function fetchRepoTopics(owner: string, repo: string): Promise<string[]> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/topics`, {
      headers: {
        ...githubHeaders(),
        Accept: 'application/vnd.github.mercy-preview+json',
      },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { names?: string[] };
    return data.names ?? [];
  } catch {
    return [];
  }
}

export async function searchReposByTopicQuery(
  query: string,
  perPage = 30,
): Promise<GitHubSearchRepo[]> {
  const url = new URL(`${GITHUB_API}/search/repositories`);
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(perPage));

  try {
    const response = await fetch(url, { headers: githubHeaders() });
    if (!response.ok) {
      console.warn(`GitHub topic search failed (${response.status}): ${query}`);
      return [];
    }
    const data = (await response.json()) as { items?: GitHubSearchRepo[] };
    return data.items ?? [];
  } catch (error) {
    console.warn('GitHub topic search error:', error);
    return [];
  }
}

async function enrichDiscoveredRepo(item: GitHubSearchRepo): Promise<TopicDiscoveredRepo | null> {
  const [owner, repo] = item.full_name.split('/');
  const topics =
    item.topics && item.topics.length > 0 ? item.topics : await fetchRepoTopics(owner, repo);

  const topicValidation = validateAntoraTopics(topics, repo);
  if (!topicValidation.valid || !topicValidation.primaryKind) return null;

  return {
    githubRepoId: item.id,
    owner,
    repo,
    repoUrl: item.html_url,
    topics,
    primaryKind: topicValidation.primaryKind,
    topicValidation,
    stars: item.stargazers_count,
    description: item.description,
    lastUpdated: item.updated_at,
  };
}

export async function discoverExtensionReposFromTopics(
  perPage = 30,
): Promise<TopicDiscoveredRepo[]> {
  const items = await searchReposByTopicQuery(EXTENSION_DISCOVERY_QUERY, perPage);
  const results: TopicDiscoveredRepo[] = [];

  for (const item of items) {
    const row = await enrichDiscoveredRepo(item);
    if (row && row.primaryKind === 'extension') results.push(row);
  }

  return results;
}

export async function discoverThemeReposFromTopics(
  perPage = 30,
): Promise<TopicDiscoveredRepo[]> {
  const items = await searchReposByTopicQuery(THEME_DISCOVERY_QUERY, perPage);
  const results: TopicDiscoveredRepo[] = [];

  for (const item of items) {
    const row = await enrichDiscoveredRepo(item);
    if (row && row.primaryKind === 'theme') results.push(row);
  }

  return results;
}

export function toKnownExtensionRepos(discovered: TopicDiscoveredRepo[]): KnownExtensionRepo[] {
  return discovered.map((d) => ({
    owner: d.owner,
    repo: d.repo,
    githubRepoId: d.githubRepoId,
    discoveredVia: 'github-topic' as const,
    githubTopics: d.topics,
  }));
}

export function mergeExtensionRepos(
  curated: KnownExtensionRepo[],
  discovered: KnownExtensionRepo[],
): KnownExtensionRepo[] {
  return dedupeReposById([...curated, ...discovered]);
}
