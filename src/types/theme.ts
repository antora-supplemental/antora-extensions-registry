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
  githubTopics?: string[];
  githubRepoId?: number;
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
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  theme?: Theme;
}
