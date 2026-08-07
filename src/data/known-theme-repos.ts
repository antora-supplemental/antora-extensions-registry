import type { Theme } from '~/types/theme';
import {
  ANTORA_APPEARANCE_TOPICS,
  ANTORA_TOPICS,
  appearanceTags,
} from './github-topics';

export interface KnownThemeRepo {
  owner: string;
  repo: string;
  name: string;
  description: string;
  githubTopics: string[];
  demoUrl?: string;
}

export const knownThemeRepos: KnownThemeRepo[] = [
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
    owner: 'antora',
    repo: 'antora-ui-default',
    name: 'Default UI',
    description: 'The official Antora default UI bundle.',
    githubTopics: [ANTORA_TOPICS.THEME, ANTORA_APPEARANCE_TOPICS.LIGHT_THEME],
    demoUrl: 'https://docs.antora.org',
  },
];

export function themesFromKnownRepos(): Theme[] {
  return knownThemeRepos.map((ref) => ({
    id: `${ref.owner}-${ref.repo}`.toLowerCase(),
    name: ref.name,
    description: ref.description,
    author: ref.owner,
    repoUrl: `https://github.com/${ref.owner}/${ref.repo}`,
    demoUrl: ref.demoUrl ?? `https://${ref.owner}.github.io/${ref.repo}/`,
    previewImage: `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/main/preview.png`,
    stars: 0,
    tags: [...new Set([...appearanceTags(ref.githubTopics), 'documentation'])],
    lastUpdated: new Date().toISOString(),
    githubTopics: ref.githubTopics,
  }));
}
