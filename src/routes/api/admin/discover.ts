import { auth } from '~/server/auth';
import { isAdminUser } from '~/server/admin';
import { discoverExtensionReposFromTopics, discoverThemeReposFromTopics } from '~/lib/github-topics';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Admin-only: runs GitHub topic discovery live and returns what it finds (nothing is written). */
export async function POST({ request }: { request: Request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!(await isAdminUser(session?.user?.id))) return json({ error: 'Forbidden' }, 403);

  try {
    const [extensions, themes] = await Promise.all([
      discoverExtensionReposFromTopics(50),
      discoverThemeReposFromTopics(50),
    ]);
    const shape = (r: { owner: string; repo: string; repoUrl: string; topics: string[] }) => ({
      owner: r.owner,
      repo: r.repo,
      repoUrl: r.repoUrl,
      topics: r.topics,
    });
    return json({ ranAt: new Date().toISOString(), extensions: extensions.map(shape), themes: themes.map(shape) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
