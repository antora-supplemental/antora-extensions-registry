import type { ThemeAppearance } from '~/data/github-topics';

export interface Theme {
  id: string;
  name: string;
  description: string;
  author: string;
  repoUrl: string;
  demoUrl: string;
  previewImage: string;
  stars: number;
  tags: string[];
  lastUpdated: string;
  /** ISO date this theme was first listed in the registry (never changes). */
  firstListedAt?: string;
  githubTopics?: string[];
  githubRepoId?: number;
  /** Declared appearance (topic or antora-theme.json); undefined when undeclared. */
  appearance?: ThemeAppearance | null;
  /** owner/repo of the theme this one re-colors (declared in antora-theme.json). */
  baseTheme?: string | null;
}

export interface ThemeSubmission {
  repoUrl: string;
  demoUrl?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
  updated_at: string;
  homepage: string | null;
  private?: boolean;
  fork?: boolean;
  default_branch?: string;
  topics?: string[];
  license?: { spdx_id: string | null; name: string } | null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  theme?: Theme;
}
