import { EXTENSION_DISCOVERY_QUERY } from '~/data/github-topics';
import { buildFullExtensionCatalog } from '~/lib/extension-catalog';

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const includeTopics = url.searchParams.get('topics') !== 'false';

  try {
    const catalog = await buildFullExtensionCatalog({ includeTopicDiscovery: includeTopics });

    return new Response(
      JSON.stringify({
        schema: '1.0',
        generatedAt: new Date().toISOString(),
        source: 'manifest',
        topicDiscovery: includeTopics,
        topicQuery: EXTENSION_DISCOVERY_QUERY,
        discoveredRepoCount: catalog.discoveredRepoCount,
        moduleCount: catalog.modules.length,
        recipeCount: catalog.recipes.length,
        indexedRepos: catalog.indexedRepos,
        modules: catalog.modules,
        recipes: catalog.recipes,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      },
    );
  } catch (error) {
    console.error('Extension catalog error:', error);
    return new Response(JSON.stringify({ error: 'Failed to build extension catalog' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
