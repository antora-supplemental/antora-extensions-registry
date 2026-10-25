import {
  ANTORA_APPEARANCE_TOPICS,
  ANTORA_TOPIC_REGISTRY,
  ANTORA_TOPICS,
  EXTENSION_DISCOVERY_QUERY,
  THEME_DISCOVERY_QUERY,
} from '~/data/github-topics';
import { REPO_CLAIM_GUIDANCE } from '~/lib/repo-identity';
import { discoverExtensionReposFromTopics } from '~/lib/github-topics';

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const preview = url.searchParams.get('preview') === 'true';

  const body: Record<string, unknown> = {
    schema: '1.0',
    syntax: {
      rules: [
        'Use exactly one primary topic: antora-extension OR antora-theme',
        'Do not use repo/product names as topics',
        'Themes declare one appearance: antora-light-theme (light only), antora-dark-theme (dark only), both of those (light + dark), or antora-other-theme (neither)',
        'antora-other-theme is never combined with antora-light-theme or antora-dark-theme',
        'Themes may instead set "appearance" (light|dark|both|other) in antora-theme.json at the repository root; a pure color re-theme may set "baseTheme": "owner/repo" there',
        'antora-dark-mode is for extensions that add dark mode to an existing theme',
        'No vague antora base topic — it matches consumers, not extenders',
      ],
      examples: {
        antoraDarkMode: [
          ANTORA_TOPICS.EXTENSION,
          ANTORA_APPEARANCE_TOPICS.DARK_MODE,
        ],
        valentusTheme: [
          ANTORA_TOPICS.THEME,
          ANTORA_APPEARANCE_TOPICS.LIGHT_THEME,
          ANTORA_APPEARANCE_TOPICS.DARK_THEME,
        ],
        architextureTheme: [
          ANTORA_TOPICS.THEME,
          ANTORA_APPEARANCE_TOPICS.LIGHT_THEME,
        ],
        otherTheme: [
          ANTORA_TOPICS.THEME,
          ANTORA_APPEARANCE_TOPICS.OTHER_THEME,
        ],
      },
    },
    registry: ANTORA_TOPIC_REGISTRY,
    discoveryQueries: {
      extension: EXTENSION_DISCOVERY_QUERY,
      theme: THEME_DISCOVERY_QUERY,
    },
    repoIdentity: {
      github: 'Store numeric repo.id — survives renames on GitHub',
      deleteRecreate: REPO_CLAIM_GUIDANCE.message,
    },
  };

  if (preview) {
    body.previewExtensionRepos = await discoverExtensionReposFromTopics(10);
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
