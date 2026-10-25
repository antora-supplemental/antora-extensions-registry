import { auth } from '~/server/auth';
import { isAdminUser } from '~/server/admin';
import { discoverExtensionReposFromTopics, discoverThemeReposFromTopics } from '~/lib/github-topics';
import { repoStatus } from '~/lib/registry-write';
import { client } from '~/server/db';
import { checkAndImport } from '~/server/registry';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** New repositories checked per run, to stay inside the function time limit. Run again for more. */
const MAX_NEW_PER_RUN = 8;

/**
 * Admin-only: runs GitHub topic discovery, then checks each repository the
 * registry doesn't know yet and imports the ones that meet the criteria.
 */
export async function POST({ request }: { request: Request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!(await isAdminUser(session?.user?.id))) return json({ error: 'Forbidden' }, 403);

  try {
    const [extensions, themes] = await Promise.all([
      discoverExtensionReposFromTopics(50),
      discoverThemeReposFromTopics(50),
    ]);
    const found = [
      ...extensions.map((r) => ({ ...r, kind: 'extension' as const })),
      ...themes.map((r) => ({ ...r, kind: 'theme' as const })),
    ];
    const statuses = await Promise.all(found.map((r) => repoStatus(client, r.repoUrl)));
    const fresh = found.filter((_, i) => !statuses[i]);
    const toCheck = fresh.slice(0, MAX_NEW_PER_RUN);
    const outcomes = await Promise.all(toCheck.map((r) => checkAndImport(r.repoUrl, null).catch((e) => e as Error)));

    const results = found.map((r, i) => {
      const base = { kind: r.kind, owner: r.owner, repo: r.repo, repoUrl: r.repoUrl };
      const known = statuses[i];
      if (known) return { ...base, outcome: known.status === 'rejected' ? 'rejected earlier' : `already ${known.status}`, failures: [] as string[] };
      const j = toCheck.indexOf(r);
      if (j < 0) return { ...base, outcome: 'not checked yet (run again)', failures: [] as string[] };
      const o = outcomes[j];
      if (o instanceof Error) return { ...base, outcome: 'check failed', failures: [o.message] };
      return {
        ...base,
        outcome: o.imported ? 'imported' : 'not imported',
        approvedVia: o.approvedVia,
        failures: o.check.criteria.filter((c) => !c.ok).map((c) => (c.detail ? `${c.label}: ${c.detail}` : c.label)),
      };
    });
    return json({
      ranAt: new Date().toISOString(),
      imported: results.filter((r) => r.outcome === 'imported').length,
      results,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
