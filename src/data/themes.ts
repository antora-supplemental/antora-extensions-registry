import type { Theme } from '~/types/theme';
import { themesFromKnownRepos } from './known-theme-repos';

export const sampleThemes: Theme[] = themesFromKnownRepos();

export function loadThemes(): Theme[] {
  if (typeof window === 'undefined') return sampleThemes;

  try {
    const stored = localStorage.getItem('antora-themes');
    if (stored) {
      const userThemes = JSON.parse(stored) as Theme[];
      const ids = new Set(userThemes.map((t) => t.id));
      return [...userThemes, ...sampleThemes.filter((t) => !ids.has(t.id))];
    }
  } catch {
    // Ignore localStorage errors
  }

  return sampleThemes;
}

export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem('antora-themes');
    const themes = stored ? (JSON.parse(stored) as Theme[]) : [];

    const existing = themes.findIndex((t) => t.id === theme.id);
    if (existing !== -1) {
      themes[existing] = theme;
    } else {
      themes.unshift(theme);
    }

    localStorage.setItem('antora-themes', JSON.stringify(themes));
  } catch {
    // Ignore localStorage errors
  }
}
