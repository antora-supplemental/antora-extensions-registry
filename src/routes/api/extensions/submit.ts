import { eq } from 'drizzle-orm';
import { auth } from '~/server/auth';
import { db } from '~/server/db';
import { extensionRepos } from '~/server/db/schema';
import { parseGitHubUrl } from '~/lib/github';
import { discoverUiModules } from '~/lib/ui-modules';

export async function POST({ request }: { request: Request }) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const repoUrl = body.repoUrl?.trim();

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: 'Repository URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Invalid GitHub URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const discovery = await discoverUiModules(repoUrl);
    if (!discovery.valid) {
      return new Response(
        JSON.stringify({ error: discovery.error || 'No UI module catalog found in repository' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const [existing] = await db
      .select()
      .from(extensionRepos)
      .where(eq(extensionRepos.repoUrl, discovery.repository!))
      .limit(1);

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'This repository is already registered for extension indexing' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const id = crypto.randomUUID();
    await db.insert(extensionRepos).values({
      id,
      repoUrl: discovery.repository!,
      owner: parsed.owner,
      name: parsed.repo,
      catalogSource: discovery.source ?? null,
      moduleCount: discovery.modules?.length ?? 0,
      recipeCount: discovery.recipes?.length ?? 0,
      status: 'pending',
      submittedBy: session.user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Registered ${discovery.modules?.length ?? 0} modules and ${discovery.recipes?.length ?? 0} recipes for review.`,
        extensionRepoId: id,
        modules: discovery.modules?.map((module) => ({ id: module.id, name: module.name })),
        recipes: discovery.recipes?.map((recipe) => ({ id: recipe.id, name: recipe.name })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Extension repo submission error:', error);
    return new Response(JSON.stringify({ error: 'Failed to register extension repository' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
