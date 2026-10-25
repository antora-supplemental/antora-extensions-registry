import {
  matchesAppearanceFilter,
  type AppearanceFilter,
} from '~/data/github-topics';

export const APPEARANCE_FILTER_OPTIONS: Array<{
  value: AppearanceFilter;
  label: string;
  description: string;
}> = [
  {
    value: 'all',
    label: 'All',
    description: 'Every color mode',
  },
  {
    value: 'default',
    label: 'Light + dark themes',
    description: 'Themes with both a light and a dark mode',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Themes with a light mode',
  },
  {
    value: 'dark',
    label: 'Dark-only themes',
    description: 'Themes that are dark only',
  },
  {
    value: 'dark-mode-only',
    label: 'Dark mode add-ons',
    description: 'Adds dark mode to an existing theme',
  },
  {
    value: 'wildcard',
    label: 'Other color schemes',
    description: 'Themes that are neither light nor dark',
  },
];

export { matchesAppearanceFilter, type AppearanceFilter };
