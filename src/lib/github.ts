import type { GitHubRepo, Theme, ValidationResult } from '~/types/theme';
import { discoverUiModules } from '~/lib/ui-modules';

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.replace(/\.git$/, '').match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }
  return null;
}

export async function fetchRepoInfo(owner: string, repo: string): Promise<GitHubRepo | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Antora-Extensions-Registry',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function checkPreviewExists(owner: string, repo: string, branch = 'main'): Promise<boolean> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/preview.png`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/preview.png`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function getGitHubPagesUrl(owner: string, repo: string): string {
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

export function getPreviewImageUrl(owner: string, repo: string, branch = 'main'): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/preview.png`;
}

export interface ThemeValidationResult extends ValidationResult {
  hasUiModuleCatalog?: boolean;
  moduleCount?: number;
  recipeCount?: number;
}

export async function validateTheme(repoUrl: string): Promise<ThemeValidationResult> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { valid: false, error: 'Invalid GitHub URL format' };
  }

  const { owner, repo } = parsed;

  const repoInfo = await fetchRepoInfo(owner, repo);
  if (!repoInfo) {
    return { valid: false, error: 'Repository not found or not accessible' };
  }

  const catalog = await discoverUiModules(repoUrl);
  const hasUiModuleCatalog = catalog.valid;

  const hasPreview = await checkPreviewExists(owner, repo);
  if (!hasPreview && !hasUiModuleCatalog) {
    return {
      valid: false,
      error:
        'No preview.png in repository root and no ui-modules/registry.json5 catalog found. Add a preview screenshot or publish a UI module manifest.',
    };
  }

  const theme: Theme = {
    id: `${owner}-${repo}`.toLowerCase(),
    name: repo.replace(/-/g, ' ').replace(/antora|theme|ui/gi, '').trim() || repo,
    description: repoInfo.description || 'An Antora documentation theme',
    author: repoInfo.owner.login,
    repoUrl: repoInfo.html_url,
    demoUrl: repoInfo.homepage || getGitHubPagesUrl(owner, repo),
    previewImage: getPreviewImageUrl(owner, repo),
    stars: repoInfo.stargazers_count,
    tags: extractTags(repoInfo.name, repoInfo.description),
    lastUpdated: repoInfo.updated_at,
  };

  return {
    valid: true,
    theme,
    hasUiModuleCatalog,
    moduleCount: catalog.modules?.length ?? 0,
    recipeCount: catalog.recipes?.length ?? 0,
  };
}

function extractTags(name: string, description: string | null): string[] {
  const tags: string[] = [];
  const text = `${name} ${description || ''}`.toLowerCase();

  const tagKeywords: Record<string, string[]> = {
    dark: ['dark', 'night', 'black'],
    light: ['light', 'bright', 'white'],
    minimal: ['minimal', 'simple', 'clean'],
    modern: ['modern', 'contemporary'],
    material: ['material', 'google'],
    documentation: ['docs', 'documentation'],
    responsive: ['responsive', 'mobile'],
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some((k) => text.includes(k))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ['documentation'];
}
