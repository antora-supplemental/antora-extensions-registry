import { validateAntoraTopics } from '~/data/github-topics';
import { fetchRepoTopics } from '~/lib/github-topics';
import { parseGitHubUrl } from '~/lib/github';
import { discoverUiModules } from '~/lib/ui-modules';

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const repoUrl = url.searchParams.get('repoUrl')?.trim();

  if (!repoUrl) {
    return new Response(JSON.stringify({ error: 'repoUrl query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseGitHubUrl(repoUrl);
  const topics = parsed ? await fetchRepoTopics(parsed.owner, parsed.repo) : [];
  const topicValidation = validateAntoraTopics(topics, parsed?.repo);

  const result = await discoverUiModules(repoUrl);

  if (!result.valid) {
    return new Response(JSON.stringify(result), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      ...result,
      githubTopics: topics,
      topicValidation,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
