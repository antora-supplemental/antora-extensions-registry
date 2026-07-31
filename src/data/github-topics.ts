/**
 * Prescribed GitHub topics for Antora extension/theme discovery.
 *
 * @see docs/modules/ROOT/pages/contributing.adoc
 */

/** Primary kind — pick exactly one per repository. */
export const ANTORA_TOPICS = {
  EXTENSION: 'antora-extension',
  THEME: 'antora-theme',
} as const;

/** Appearance / capability topics (optional, combinable). */
export const ANTORA_APPEARANCE_TOPICS = {
  LIGHT_THEME: 'antora-light-theme',
  DARK_THEME: 'antora-dark-theme',
  DARK_MODE: 'antora-dark-mode',
} as const;

/** Category topics — optional browse slices (not repo names). */
export const ANTORA_CATEGORY_TOPICS = {
  WILDCARD: 'antora-wildcard-theme',
} as const;

export const PRIMARY_TOPIC_VALUES = Object.values(ANTORA_TOPICS);
export const APPEARANCE_TOPIC_VALUES = Object.values(ANTORA_APPEARANCE_TOPICS);
export const CATEGORY_TOPIC_VALUES = Object.values(ANTORA_CATEGORY_TOPICS);

export type PrimaryTopic = (typeof ANTORA_TOPICS)[keyof typeof ANTORA_TOPICS];
export type AppearanceTopic = (typeof ANTORA_APPEARANCE_TOPICS)[keyof typeof ANTORA_APPEARANCE_TOPICS];

export type PrimaryKind = 'extension' | 'theme';

export type AppearanceFilter =
  | 'all'
  | 'default'
  | 'light-dark'
  | 'light'
  | 'dark'
  | 'dark-mode-only'
  | 'wildcard';

export interface AppearanceProfile {
  hasLight: boolean;
  hasDark: boolean;
  hasDarkModeOverlay: boolean;
  hasWildcard: boolean;
  isExtension: boolean;
  isTheme: boolean;
  defaultThemeVisible: boolean;
}

export interface AntoraTopicDefinition {
  topic: string;
  role: 'primary' | 'appearance' | 'category';
  primaryKind?: PrimaryKind;
  label: string;
  description: string;
}

export const ANTORA_TOPIC_REGISTRY: AntoraTopicDefinition[] = [
  {
    topic: ANTORA_TOPICS.EXTENSION,
    role: 'primary',
    primaryKind: 'extension',
    label: 'Antora extension',
    description:
      'Extends Antora (UI modules, generator packages, chrome). Indexer scans for ui-modules/registry.json5.',
  },
  {
    topic: ANTORA_TOPICS.THEME,
    role: 'primary',
    primaryKind: 'theme',
    label: 'Antora theme',
    description: 'Full publishable UI theme (bundle, preview, demo). Listed in themes gallery.',
  },
  {
    topic: ANTORA_APPEARANCE_TOPICS.LIGHT_THEME,
    role: 'appearance',
    label: 'Light theme',
    description: 'Full theme supports light appearance.',
  },
  {
    topic: ANTORA_APPEARANCE_TOPICS.DARK_THEME,
    role: 'appearance',
    label: 'Dark theme',
    description: 'Full dark theme — not a slipstream overlay.',
  },
  {
    topic: ANTORA_APPEARANCE_TOPICS.DARK_MODE,
    role: 'appearance',
    label: 'Dark mode overlay',
    description:
      'Installable dark mode layer for existing themes (e.g. antora-dark-mode). Hidden from default theme browse.',
  },
  {
    topic: ANTORA_CATEGORY_TOPICS.WILDCARD,
    role: 'category',
    label: 'Wildcard',
    description:
      'Full theme that does not map cleanly to light or dark — use instead of antora-light-theme / antora-dark-theme. Pair with antora-theme.',
  },
];

export const EXTENSION_DISCOVERY_QUERY = `topic:${ANTORA_TOPICS.EXTENSION}`;
export const THEME_DISCOVERY_QUERY = `topic:${ANTORA_TOPICS.THEME}`;

export interface TopicValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  primaryKind?: PrimaryKind;
  appearance: AppearanceProfile;
}

export function classifyAppearance(topics: string[]): AppearanceProfile {
  const t = new Set(topics.map((x) => x.toLowerCase()));
  const isExtension = t.has(ANTORA_TOPICS.EXTENSION);
  const isTheme = t.has(ANTORA_TOPICS.THEME);
  const hasLight = t.has(ANTORA_APPEARANCE_TOPICS.LIGHT_THEME);
  const hasDark = t.has(ANTORA_APPEARANCE_TOPICS.DARK_THEME);
  const hasDarkModeOverlay = t.has(ANTORA_APPEARANCE_TOPICS.DARK_MODE);
  const hasWildcard = t.has(ANTORA_CATEGORY_TOPICS.WILDCARD);

  return {
    hasLight,
    hasDark,
    hasDarkModeOverlay,
    hasWildcard,
    isExtension,
    isTheme,
    defaultThemeVisible: isTheme && hasLight && hasDark && !hasWildcard,
  };
}

export function validateAntoraTopics(topics: string[], repoName?: string): TopicValidationResult {
  const normalized = topics.map((t) => t.toLowerCase());
  const errors: string[] = [];
  const warnings: string[] = [];

  const matchedPrimary = PRIMARY_TOPIC_VALUES.filter((p) => normalized.includes(p));
  if (matchedPrimary.length === 0) {
    errors.push(
      `Missing primary topic — add "${ANTORA_TOPICS.EXTENSION}" or "${ANTORA_TOPICS.THEME}"`,
    );
  } else if (matchedPrimary.length > 1) {
    errors.push(`Multiple primary topics (${matchedPrimary.join(', ')}) — use exactly one`);
  }

  const prescribed = new Set(ANTORA_TOPIC_REGISTRY.map((d) => d.topic));
  for (const topic of normalized) {
    if (topic.startsWith('antora') && !prescribed.has(topic)) {
      warnings.push(`Non-prescribed antora topic "${topic}"`);
    }
    if (repoName && topic === repoName.toLowerCase()) {
      warnings.push(
        `Topic "${topic}" matches the repo name — use capability topics instead of product/repo names`,
      );
    }
  }

  if (
    normalized.includes(ANTORA_APPEARANCE_TOPICS.DARK_MODE) &&
    normalized.includes(ANTORA_APPEARANCE_TOPICS.DARK_THEME)
  ) {
    warnings.push(
      'Repo has both antora-dark-mode (overlay) and antora-dark-theme (full theme) — ensure that is intentional',
    );
  }

  const appearance = classifyAppearance(normalized);

  if (appearance.hasWildcard && (appearance.hasLight || appearance.hasDark)) {
    errors.push(
      'antora-wildcard-theme is for themes outside the light/dark model — remove it or drop antora-light-theme / antora-dark-theme',
    );
  }
  let primaryKind: PrimaryKind | undefined;
  if (matchedPrimary.length === 1) {
    primaryKind = matchedPrimary[0] === ANTORA_TOPICS.THEME ? 'theme' : 'extension';
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    primaryKind,
    appearance,
  };
}

export function isDarkModeOverlayOnly(topics: string[]): boolean {
  const a = classifyAppearance(topics);
  return a.hasDarkModeOverlay && !a.hasDark && !a.hasLight;
}

export function matchesAppearanceFilter(topics: string[], filter: AppearanceFilter): boolean {
  const a = classifyAppearance(topics);

  switch (filter) {
    case 'all':
      return true;
    case 'default':
      return a.defaultThemeVisible;
    case 'light-dark':
      return a.isTheme && a.hasLight && a.hasDark;
    case 'light':
      return a.hasLight;
    case 'dark':
      return a.hasDark;
    case 'dark-mode-only':
      return a.hasDarkModeOverlay;
    case 'wildcard':
      return a.hasWildcard && a.isTheme;
    default:
      return true;
  }
}

export function appearanceTags(topics: string[]): string[] {
  const t = topics.map((x) => x.toLowerCase());
  const tags: string[] = [];
  if (t.includes(ANTORA_TOPICS.EXTENSION)) tags.push('extension');
  if (t.includes(ANTORA_TOPICS.THEME)) tags.push('theme');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.DARK_MODE)) tags.push('dark-mode-overlay');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.DARK_THEME)) tags.push('dark-theme');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.LIGHT_THEME)) tags.push('light-theme');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.LIGHT_THEME) && t.includes(ANTORA_APPEARANCE_TOPICS.DARK_THEME)) {
    tags.push('light+dark');
  }
  if (t.includes(ANTORA_CATEGORY_TOPICS.WILDCARD)) tags.push('wildcard');
  return tags;
}
