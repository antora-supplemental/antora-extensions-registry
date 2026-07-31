import { eq } from 'drizzle-orm';
import { auth } from '~/server/auth';
import { db } from '~/server/db';
import { themes } from '~/server/db/schema';

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  owner: { login: string };
  homepage: string | null;
}

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
    const { repoUrl, name, description, demoUrl, previewImage, tags } = body;

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: 'Repository URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [existingTheme] = await db
      .select()
      .from(themes)
      .where(eq(themes.repoUrl, repoUrl))
      .limit(1);

    if (existingTheme) {
      return new Response(JSON.stringify({ error: 'This theme has already been submitted' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const githubMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (!githubMatch) {
      return new Response(JSON.stringify({ error: 'Invalid GitHub URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [, owner, repo] = githubMatch;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}`;

    const repoResponse = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Antora-Extensions-Registry',
      },
    });

    if (!repoResponse.ok) {
      return new Response(JSON.stringify({ error: 'Could not fetch repository information' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repoData: GitHubRepo = await repoResponse.json();
    const themeId = crypto.randomUUID();
    const cleanRepo = repo.replace(/\.git$/, '');
    const finalDemoUrl = demoUrl || repoData.homepage || `https://${owner}.github.io/${cleanRepo}/`;
    const finalPreviewImage = previewImage || `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/preview.png`;

    await db.insert(themes).values({
      id: themeId,
      name: name || repoData.name,
      description: description || repoData.description || 'An Antora documentation theme',
      authorId: session.user.id ?? null,
      authorName: session.user.name ?? repoData.owner.login,
      repoUrl: repoData.html_url,
      demoUrl: finalDemoUrl,
      previewImage: finalPreviewImage,
      stars: repoData.stargazers_count,
      tags: JSON.stringify(tags || ['antora', 'documentation']),
      status: 'pending',
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Theme submitted successfully! It will appear in the gallery after review.',
        themeId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Theme submission error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit theme' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
