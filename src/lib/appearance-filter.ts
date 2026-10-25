import type { ThemeAppearance } from '~/data/github-topics';

export type ThemeAppearanceFilter = 'all' | ThemeAppearance;

export const THEME_APPEARANCE_FILTER_OPTIONS: Array<{ value: ThemeAppearanceFilter; label: string }> = [
  { value: 'all', label: 'All appearances' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'both', label: 'Light + dark' },
  { value: 'other', label: 'Other' },
];

export const THEME_APPEARANCE_LABELS: Record<ThemeAppearance, string> = {
  light: 'Light',
  dark: 'Dark',
  both: 'Light + dark',
  other: 'Other',
};

export function matchesThemeAppearance(appearance: ThemeAppearance | null | undefined, filter: ThemeAppearanceFilter): boolean {
  return filter === 'all' || appearance === filter;
}
