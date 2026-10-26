import { eq, desc } from 'drizzle-orm';
import { sampleThemes } from '~/data/themes';
import { knownThemeRepos, knownThemeRepoUrl } from '~/data/known-theme-repos';

/** Curated order first (Default UI leads), then everything else by stars. */
function featuredRank(repoUrl: string): number {
  const i = knownThemeRepos.findIndex(
    (r) => knownThemeRepoUrl(r).toLowerCase() === repoUrl.toLowerCase(),
  );
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}
import { client, db } from '~/server/db';
import { readFirstListed } from '~/lib/first-listed';
import { themes } from '~/server/db/schema';
import type { Theme } from '~/types/theme';

export async function loadGalleryThemes(options: { snapshot?: boolean } = {}): Promise<Theme[]> {
  if (options.snapshot !== false) {
    try {
      const { parseSnapshot, SNAPSHOT_KEYS } = await import('~/lib/browse-cache');
      const r = await client.execute({ sql: 'SELECT value FROM catalog_meta WHERE key = ?', args: [SNAPSHOT_KEYS.themes] });
      const snap = parseSnapshot<Theme[]>(r.rows[0]?.value);
      if (snap?.length) return snap;
    } catch { /* no snapshot yet */ }
  }
  try {
    const result = await db
      .select()
      .from(themes)
      .where(eq(themes.status, 'approved'))
      .orderBy(desc(themes.stars));

    if (result.length > 0) {
      const first = await readFirstListed(client, 'theme');
      result.sort((a, b) => featuredRank(a.repoUrl) - featuredRank(b.repoUrl) || b.stars - a.stars);
      return result.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        author: t.authorName,
        repoUrl: t.repoUrl,
        demoUrl: t.demoUrl ?? '',
        previewImage: t.previewImage ?? '',
        stars: t.stars,
        tags: JSON.parse(t.tags) as string[],
        lastUpdated: t.updatedAt.toISOString(),
        firstListedAt: first.get(t.id) ?? t.createdAt.toISOString(),
        appearance: t.appearance ?? undefined,
        baseTheme: t.baseTheme ?? undefined,
      }));
    }
  } catch (error) {
    console.error('Error fetching themes from database:', error);
  }

  return sampleThemes;
}
