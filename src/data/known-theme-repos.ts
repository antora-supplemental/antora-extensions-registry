import type { Theme } from '~/types/theme';
import {
  ANTORA_APPEARANCE_TOPICS,
  ANTORA_TOPICS,
  appearanceTags,
  themeAppearanceFromTopics,
} from './github-topics';

export interface KnownThemeRepo {
  owner: string;
  repo: string;
  name: string;
  description: string;
  githubTopics: string[];
  demoUrl?: string;
  /** Forge host when not GitHub, e.g. 'gitlab.com'. */
  host?: string;
  /** Preview path under public/ when /previews/<repo>.png would collide. */
  previewImage?: string;
  /** owner/repo of the theme this one is a variant (enhanced fork) of; that theme's page links here. */
  variantOf?: string;
  /** Link text on the base theme's page, e.g. "Also available with light/dark mode". */
  variantLabel?: string;
}

/** Repository URL of a curated theme (GitHub unless host says otherwise). */
export function knownThemeRepoUrl(ref: Pick<KnownThemeRepo, 'owner' | 'repo' | 'host'>): string {
  return `https://${ref.host ?? 'github.com'}/${ref.owner}/${ref.repo}`;
}

/** Curated variants of a theme (by its owner/repo): generic "Also available with …" links for its detail page. */
export function themeVariantsOf(path: string): Array<{ path: string; label: string; href: string }> {
  return knownThemeRepos
    .filter((r) => r.variantOf && r.variantOf.toLowerCase() === path.toLowerCase())
    .map((r) => ({ path: `${r.owner}/${r.repo}`, label: r.variantLabel ?? `Also available as ${r.name}`, href: `/themes/${r.owner}/${r.repo}` }));
}

// Order is the homepage "Featured Themes" order; the Default UI slot leads (the light/dark fork of the stock UI).
export const knownThemeRepos: KnownThemeRepo[] = [
  {
    host: 'gitlab.com',
    owner: 'AMDphreak',
    repo: 'antora-ui-default',
    name: 'Default UI with light/dark mode',
    description: 'The Antora Default UI plus a light/dark mode toggle (fork of antora/antora-ui-default).',
    githubTopics: [ANTORA_TOPICS.THEME, ANTORA_APPEARANCE_TOPICS.LIGHT_THEME, ANTORA_APPEARANCE_TOPICS.DARK_THEME],
    demoUrl: 'https://gitlab.com/AMDphreak/antora-ui-default/-/tree/feat/root-theme-transition',
    previewImage: '/previews/amdphreak-antora-ui-default.png',
    variantOf: 'antora/antora-ui-default',
    variantLabel: 'Also available with light/dark mode',
  },
  {
    owner: 'antora-supplemental',
    repo: 'valentus-theme',
    name: 'Valentus',
    description:
      'Composed Antora theme (light + dark) — the full chrome stack from antora-supplemental.',
    githubTopics: [
      ANTORA_TOPICS.THEME,
      ANTORA_APPEARANCE_TOPICS.LIGHT_THEME,
      ANTORA_APPEARANCE_TOPICS.DARK_THEME,
      'valentus-theme',
    ],
    demoUrl: 'https://antora-supplemental.github.io/valentus-theme/',
  },
  {
    owner: 'antora-supplemental',
    repo: 'architexture-theme',
    name: 'Architexture',
    description: 'Bespoke minimalist architectural theme — Stone and Graphite design system.',
    githubTopics: [ANTORA_TOPICS.THEME, ANTORA_APPEARANCE_TOPICS.LIGHT_THEME],
    demoUrl: 'https://antora-supplemental.github.io/architexture-theme/',
  },
  {
    owner: 'antora-supplemental',
    repo: 'skittles-theme',
    name: 'Skittles',
    description: 'Candy-bright Antora paint: eleven color schemes (five flavors in light and dark, plus Grape Soda) over the Valentus chrome.',
    githubTopics: [
      ANTORA_TOPICS.THEME,
      ANTORA_APPEARANCE_TOPICS.LIGHT_THEME,
      ANTORA_APPEARANCE_TOPICS.DARK_THEME,
      'antora-paint',
    ],
    demoUrl: 'https://antora-supplemental.org/skittles-theme/',
  },
  {
    owner: 'antora',
    repo: 'antora-ui-default',
    name: 'Default UI',
    description: 'The official Antora default UI bundle.',
    githubTopics: [ANTORA_TOPICS.THEME, ANTORA_APPEARANCE_TOPICS.LIGHT_THEME],
    demoUrl: 'https://docs.antora.org',
  },
];

function themeAppearanceOf(topics: string[]) {
  const a = themeAppearanceFromTopics(topics);
  return a === 'conflict' ? null : a;
}

export function themesFromKnownRepos(): Theme[] {
  return knownThemeRepos.map((ref) => ({
    id: `${ref.owner}-${ref.repo}`.toLowerCase(),
    name: ref.name,
    description: ref.description,
    author: ref.owner,
    repoUrl: knownThemeRepoUrl(ref),
    demoUrl: ref.demoUrl ?? `https://${ref.owner}.github.io/${ref.repo}/`,
    // Screenshots of each demoUrl, committed under public/previews (theme repos ship no preview.png).
    previewImage: ref.previewImage ?? `/previews/${ref.repo}.png`,
    stars: 0,
    tags: [...new Set([...appearanceTags(ref.githubTopics), 'documentation'])],
    lastUpdated: new Date().toISOString(),
    githubTopics: ref.githubTopics,
    appearance: themeAppearanceOf(ref.githubTopics),
    baseTheme: null,
  }));
}
