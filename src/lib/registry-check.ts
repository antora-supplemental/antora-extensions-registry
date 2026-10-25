/**
 * Registry criteria check for one GitHub repository. Pure (no database):
 * used by the expedited check on /add, admin discovery and the daily sync.
 */
import { fetchRepoInfo, parseGitHubUrl } from '~/lib/github';
import { buildExtensionCatalog } from '~/lib/ui-modules';
import {
  ANTORA_APPEARANCE_TOPICS,
  ANTORA_TOPICS,
  THEME_APPEARANCES,
  THEME_MANIFEST_PATH,
  appearanceTags,
  validateAntoraTopics,
  themeAppearanceFromTopics,
  type ThemeAppearance,
} from '~/data/github-topics';
import type { Theme } from '~/types/theme';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

export interface CriterionResult {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface RepoCheckResult {
  repoUrl: string;
  owner?: string;
  repo?: string;
  kind: 'theme' | 'extension' | null;
  passed: boolean;
  criteria: CriterionResult[];
  theme?: Theme;
  extension?: { entries: ExtensionCatalogEntry[]; moduleCount: number; recipeCount: number; source: string };
}

export interface ThemeManifest {
  appearance?: ThemeAppearance;
  baseTheme?: string;
  demoUrl?: string;
}

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Antora-Extensions-Registry',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function hasReadme(owner: string, repo: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: ghHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

async function rawExists(owner: string, repo: string, branch: string, file: string): Promise<boolean> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function readThemeManifest(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ manifest: ThemeManifest | null; error?: string }> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${THEME_MANIFEST_PATH}`);
    if (!res.ok) return { manifest: null };
    const parsed = JSON.parse(await res.text()) as ThemeManifest;
    return { manifest: parsed && typeof parsed === 'object' ? parsed : {} };
  } catch (error) {
    return { manifest: null, error: `${THEME_MANIFEST_PATH} is not valid JSON (${error instanceof Error ? error.message : String(error)})` };
  }
}

/** Normalize https://github.com/o/r(.git), github.com/o/r, or o/r. */
export function normalizeRepoUrl(input: string): { owner: string; repo: string; repoUrl: string } | null {
  const trimmed = input.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  if (!/^(https?:\/\/)?(www\.)?github\.com\//i.test(trimmed) && !/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return null;
  const parsed = parseGitHubUrl(trimmed);
  if (!parsed) return null;
  const repo = parsed.repo.split(/[/?#]/)[0];
  if (!parsed.owner || !repo) return null;
  return { owner: parsed.owner, repo, repoUrl: `https://github.com/${parsed.owner}/${repo}` };
}

export async function checkRepository(input: string): Promise<RepoCheckResult> {
  const criteria: CriterionResult[] = [];
  const norm = normalizeRepoUrl(input);
  if (!norm) {
    return {
      repoUrl: input,
      kind: null,
      passed: false,
      criteria: [{ id: 'url', label: 'A GitHub repository URL', ok: false, detail: 'Use https://github.com/owner/repo' }],
    };
  }

  const info = await fetchRepoInfo(norm.owner, norm.repo);
  criteria.push({
    id: 'public',
    label: 'Public GitHub repository',
    ok: Boolean(info && !info.private),
    detail: info ? undefined : 'Repository not found, or it is private',
  });
  if (!info) return { repoUrl: norm.repoUrl, owner: norm.owner, repo: norm.repo, kind: null, passed: false, criteria };

  const owner = info.owner.login;
  const repo = info.name;
  const repoUrl = info.html_url;
  const branch = info.default_branch ?? 'main';
  const topics = (info.topics ?? []).map((t) => t.toLowerCase());
  const topicCheck = validateAntoraTopics(topics);
  criteria.push({
    id: 'topic',
    label: `GitHub topic ${ANTORA_TOPICS.EXTENSION} or ${ANTORA_TOPICS.THEME} (exactly one)`,
    ok: topicCheck.valid,
    detail: topicCheck.errors.join('; ') || undefined,
  });

  criteria.push({ id: 'readme', label: 'README', ok: await hasReadme(owner, repo), detail: undefined });
  criteria.push({
    id: 'license',
    label: 'Open-source license GitHub can detect',
    ok: Boolean(info.license),
    detail: info.license ? undefined : 'Add a LICENSE file at the repository root',
  });

  const kind = topicCheck.primaryKind ?? null;
  const base = { repoUrl, owner, repo, kind, criteria };

  if (kind === 'theme') {
    const { manifest, error: manifestError } = await readThemeManifest(owner, repo, branch);
    if (manifestError) criteria.push({ id: 'manifest', label: `${THEME_MANIFEST_PATH} (optional) is valid`, ok: false, detail: manifestError });

    const topicAppearance = themeAppearanceFromTopics(topics);
    const manifestAppearance = manifest?.appearance;
    let appearance: ThemeAppearance | null = null;
    let appearanceDetail: string | undefined;
    if (manifestAppearance !== undefined && !THEME_APPEARANCES.includes(manifestAppearance)) {
      appearanceDetail = `${THEME_MANIFEST_PATH} "appearance" must be one of ${THEME_APPEARANCES.join(', ')}`;
    } else if (topicAppearance === 'conflict') {
      appearanceDetail = `${ANTORA_APPEARANCE_TOPICS.OTHER_THEME} can't be combined with the light or dark topic`;
    } else if (manifestAppearance && topicAppearance && manifestAppearance !== topicAppearance) {
      appearanceDetail = `Topics say "${topicAppearance}" but ${THEME_MANIFEST_PATH} says "${manifestAppearance}"`;
    } else {
      appearance = manifestAppearance ?? topicAppearance ?? null;
      if (!appearance) {
        appearanceDetail = `Add ${ANTORA_APPEARANCE_TOPICS.LIGHT_THEME}, ${ANTORA_APPEARANCE_TOPICS.DARK_THEME} (or both), or ${ANTORA_APPEARANCE_TOPICS.OTHER_THEME}; or set "appearance" in ${THEME_MANIFEST_PATH}`;
      }
    }
    criteria.push({ id: 'appearance', label: 'Appearance declared (light, dark, both or other)', ok: Boolean(appearance), detail: appearanceDetail });

    const hasPreview = await rawExists(owner, repo, branch, 'preview.png');
    criteria.push({
      id: 'preview',
      label: 'preview.png at the repository root',
      ok: hasPreview,
      detail: hasPreview ? undefined : `Not found on the ${branch} branch`,
    });

    const demoUrl = manifest?.demoUrl || info.homepage || '';
    criteria.push({
      id: 'demo',
      label: 'Live demo set as the repository website',
      ok: /^https?:\/\//.test(demoUrl),
      detail: demoUrl ? undefined : `Set the repository website, or "demoUrl" in ${THEME_MANIFEST_PATH}`,
    });

    let baseTheme: string | null = null;
    if (manifest?.baseTheme !== undefined) {
      const ref = normalizeRepoUrl(String(manifest.baseTheme));
      const baseInfo = ref ? await fetchRepoInfo(ref.owner, ref.repo) : null;
      criteria.push({
        id: 'baseTheme',
        label: `Base theme in ${THEME_MANIFEST_PATH} exists`,
        ok: Boolean(baseInfo),
        detail: baseInfo ? undefined : `"baseTheme" must be an existing public repo as owner/repo (got "${manifest.baseTheme}")`,
      });
      if (baseInfo) baseTheme = baseInfo.full_name;
    }

    const passed = criteria.every((c) => c.ok);
    const theme: Theme = {
      id: `${owner}/${repo}`.toLowerCase(),
      name: repo.replace(/[-_]/g, ' '),
      description: info.description || 'An Antora UI theme',
      author: owner,
      repoUrl,
      demoUrl,
      previewImage: hasPreview ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/preview.png` : '',
      stars: info.stargazers_count,
      tags: [...new Set([...appearanceTags(topics).filter((t) => t !== 'theme')])],
      lastUpdated: info.updated_at,
      githubTopics: topics,
      githubRepoId: info.id,
      appearance,
      baseTheme,
    };
    return { ...base, passed, theme };
  }

  if (kind === 'extension') {
    const catalog = await buildExtensionCatalog([
      { owner, repo, githubTopics: topics, githubRepoId: info.id, discoveredVia: 'submission' },
    ]);
    const entries = [...catalog.modules, ...catalog.recipes];
    criteria.push({
      id: 'manifest',
      label: 'Installable manifest (ui-modules/registry.json5, registry-index.json or package.json)',
      ok: entries.length > 0,
      detail: entries.length ? undefined : 'None of these could be read from the default branch',
    });
    const passed = criteria.every((c) => c.ok);
    return {
      ...base,
      passed,
      extension: {
        entries,
        moduleCount: catalog.modules.length,
        recipeCount: catalog.recipes.length,
        source: entries[0]?.manifestPath?.endsWith('package.json') ? 'package.json' : 'ui-modules',
      },
    };
  }

  return { ...base, passed: false };
}
