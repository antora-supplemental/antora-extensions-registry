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
    description: 'No appearance filter',
  },
  {
    value: 'default',
    label: 'Light + dark themes',
    description: 'Full themes with both antora-light-theme and antora-dark-theme (default)',
  },
  {
    value: 'light-dark',
    label: 'Dual appearance',
    description: 'Same as default — themes tagged with both light and dark',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'antora-light-theme',
  },
  {
    value: 'dark',
    label: 'Dark themes',
    description: 'Full antora-dark-theme (not slipstream overlays)',
  },
  {
    value: 'dark-mode-only',
    label: 'Dark mode overlays',
    description: 'antora-dark-mode — installable into existing themes',
  },
  {
    value: 'wildcard',
    label: 'Wildcard',
    description: 'antora-wildcard-theme — themes that do not fit light/dark',
  },
];

export { matchesAppearanceFilter, type AppearanceFilter };
