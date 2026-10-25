/**
 * Prescribed GitHub topics for Antora extension/theme discovery.
 *
 * Capability topics (antora-theme, appearance tags) classify gallery listings.
 * Product dependency topics (exact GitHub repo name, e.g. valentus-theme) mark
 * theme repos and playbook dependents for rediscovery — see contributing.adoc.
 *
 * @see docs/modules/ROOT/pages/contributing.adoc
 */

/** Primary kind — pick exactly one per repository. */
export const ANTORA_TOPICS = {
  EXTENSION: 'antora-extension',
  THEME: 'antora-theme',
} as const;

/**
 * Theme appearance topics. A theme declares exactly one appearance:
 * light only, dark only, both (tag light and dark), or other (neither).
 */
export const ANTORA_APPEARANCE_TOPICS = {
  LIGHT_THEME: 'antora-light-theme',
  DARK_THEME: 'antora-dark-theme',
  OTHER_THEME: 'antora-other-theme',
  /** Extensions only: adds dark mode to an existing theme. */
  DARK_MODE: 'antora-dark-mode',
} as const;

/** Optional repository-root manifest a theme can use instead of (or with) topics. */
export const THEME_MANIFEST_PATH = 'antora-theme.json';

export const PRIMARY_TOPIC_VALUES = Object.values(ANTORA_TOPICS);
export const APPEARANCE_TOPIC_VALUES = Object.values(ANTORA_APPEARANCE_TOPICS);

export type PrimaryTopic = (typeof ANTORA_TOPICS)[keyof typeof ANTORA_TOPICS];
export type AppearanceTopic = (typeof ANTORA_APPEARANCE_TOPICS)[keyof typeof ANTORA_APPEARANCE_TOPICS];

export type ThemeAppearance = 'light' | 'dark' | 'both' | 'other';
export const THEME_APPEARANCES: ThemeAppearance[] = ['light', 'dark', 'both', 'other'];

export type PrimaryKind = 'extension' | 'theme';

export interface AntoraTopicDefinition {
  topic: string;
  role: 'primary' | 'appearance';
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
      'Extends Antora: build-time pipeline extensions, CI checkers, generators, utilities, or UI-side modules. Indexer scans for ui-modules/registry.json5.',
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
    label: 'Light',
    description: 'Theme has a light appearance. Add antora-dark-theme too if it also ships a dark mode.',
  },
  {
    topic: ANTORA_APPEARANCE_TOPICS.DARK_THEME,
    role: 'appearance',
    label: 'Dark',
    description: 'Theme has a dark appearance. On its own it means a dark-only theme.',
  },
  {
    topic: ANTORA_APPEARANCE_TOPICS.OTHER_THEME,
    role: 'appearance',
    label: 'Other',
    description: 'Theme is neither light nor dark (e.g. high contrast, sepia). Never combine with the light or dark topic.',
  },
  {
    topic: ANTORA_APPEARANCE_TOPICS.DARK_MODE,
    role: 'appearance',
    label: 'Dark mode add-on',
    description: 'Extension that adds dark mode to an existing theme. Use with antora-extension, not antora-theme.',
  },
];

export const EXTENSION_DISCOVERY_QUERY = `topic:${ANTORA_TOPICS.EXTENSION}`;
export const THEME_DISCOVERY_QUERY = `topic:${ANTORA_TOPICS.THEME}`;

export interface TopicValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  primaryKind?: PrimaryKind;
  /** Theme appearance declared by topics, or null when none is declared. */
  appearance: ThemeAppearance | null;
}

/** Appearance declared by topics. Returns 'conflict' when other is combined with light/dark. */
export function themeAppearanceFromTopics(topics: string[]): ThemeAppearance | 'conflict' | null {
  const t = new Set(topics.map((x) => x.toLowerCase()));
  const light = t.has(ANTORA_APPEARANCE_TOPICS.LIGHT_THEME);
  const dark = t.has(ANTORA_APPEARANCE_TOPICS.DARK_THEME);
  const other = t.has(ANTORA_APPEARANCE_TOPICS.OTHER_THEME);
  if (other && (light || dark)) return 'conflict';
  if (other) return 'other';
  if (light && dark) return 'both';
  if (light) return 'light';
  if (dark) return 'dark';
  return null;
}

export function validateAntoraTopics(topics: string[]): TopicValidationResult {
  const normalized = topics.map((t) => t.toLowerCase());
  const errors: string[] = [];
  const warnings: string[] = [];

  const matchedPrimary = PRIMARY_TOPIC_VALUES.filter((p) => normalized.includes(p));
  if (matchedPrimary.length === 0) {
    errors.push(`Missing primary topic: add "${ANTORA_TOPICS.EXTENSION}" or "${ANTORA_TOPICS.THEME}"`);
  } else if (matchedPrimary.length > 1) {
    errors.push(`Multiple primary topics (${matchedPrimary.join(', ')}): use exactly one`);
  }

  const prescribed = new Set(ANTORA_TOPIC_REGISTRY.map((d) => d.topic));
  for (const topic of normalized) {
    if (topic.startsWith('antora') && !prescribed.has(topic)) {
      warnings.push(`Non-prescribed antora topic "${topic}"`);
    }
  }

  const appearance = themeAppearanceFromTopics(normalized);
  if (appearance === 'conflict') {
    errors.push(`${ANTORA_APPEARANCE_TOPICS.OTHER_THEME} can't be combined with ${ANTORA_APPEARANCE_TOPICS.LIGHT_THEME} or ${ANTORA_APPEARANCE_TOPICS.DARK_THEME}`);
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
    appearance: appearance === 'conflict' ? null : appearance,
  };
}

export function hasDarkModeAddonTopic(topics: string[]): boolean {
  return topics.some((t) => t.toLowerCase() === ANTORA_APPEARANCE_TOPICS.DARK_MODE);
}

/** Display tags derived from topics (color-mode tags render as icons). */
export function appearanceTags(topics: string[]): string[] {
  const t = topics.map((x) => x.toLowerCase());
  const tags: string[] = [];
  if (t.includes(ANTORA_TOPICS.EXTENSION)) tags.push('extension');
  if (t.includes(ANTORA_TOPICS.THEME)) tags.push('theme');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.DARK_MODE)) tags.push('dark-mode-overlay');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.DARK_THEME)) tags.push('dark-theme');
  if (t.includes(ANTORA_APPEARANCE_TOPICS.LIGHT_THEME)) tags.push('light-theme');
  return tags;
}
