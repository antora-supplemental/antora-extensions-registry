import type { Theme } from '~/types/theme';

/** owner/repo of a gallery theme, from its repository URL (GitHub or GitLab). */
export function themeRepoPath(theme: Pick<Theme, 'repoUrl'>): string | null {
  try {
    const parts = new URL(theme.repoUrl).pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  } catch {
    return null;
  }
}

/** Detail page of a gallery theme: /themes/<owner>/<repo> (it forwards to the package page when the repo is also in the extension catalog). */
export function themeDetailHref(theme: Pick<Theme, 'repoUrl' | 'name'>): string {
  const p = themeRepoPath(theme);
  return p ? `/themes/${p}` : `/search?q=${encodeURIComponent(theme.name)}&type=themes`;
}
