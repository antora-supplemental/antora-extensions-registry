import { eq, desc } from 'drizzle-orm';
import { sampleThemes } from '~/data/themes';
import { knownThemeRepos } from '~/data/known-theme-repos';

/** Curated order first (Default UI leads), then everything else by stars. */
function featuredRank(repoUrl: string): number {
  const i = knownThemeRepos.findIndex(
    (r) => `https://github.com/${r.owner}/${r.repo}`.toLowerCase() === repoUrl.toLowerCase(),
  );
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}
import { db } from '~/server/db';
import { themes } from '~/server/db/schema';
import type { Theme } from '~/types/theme';

export async function loadGalleryThemes(): Promise<Theme[]> {
  try {
    const result = await db
      .select()
      .from(themes)
      .where(eq(themes.status, 'approved'))
      .orderBy(desc(themes.stars));

    if (result.length > 0) {
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
      }));
    }
  } catch (error) {
    console.error('Error fetching themes from database:', error);
  }

  return sampleThemes;
}
