import {
  ANTORA_APPEARANCE_TOPICS,
  ANTORA_CATEGORY_TOPICS,
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
        'Appearance topics are optional: antora-light-theme, antora-dark-theme, antora-dark-mode',
        'antora-wildcard-theme = full theme outside light/dark — never combine with light/dark appearance topics',
        'antora-dark-mode = slipstream overlay; antora-dark-theme = full dark theme',
        'No vague antora base topic — it matches consumers, not extenders',
      ],
      examples: {
        antoraDarkMode: [
          ANTORA_TOPICS.EXTENSION,
          ANTORA_APPEARANCE_TOPICS.DARK_THEME,
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
        wildcardTheme: [
          ANTORA_TOPICS.THEME,
          ANTORA_CATEGORY_TOPICS.WILDCARD,
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
