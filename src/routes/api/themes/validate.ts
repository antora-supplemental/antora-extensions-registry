import { validateTheme } from '~/lib/github';

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const repoUrl = body.repoUrl?.trim();

    if (!repoUrl) {
      return new Response(JSON.stringify({ valid: false, error: 'repoUrl is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await validateTheme(repoUrl);
    return new Response(JSON.stringify(result), {
      status: result.valid ? 200 : 422,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Validation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
