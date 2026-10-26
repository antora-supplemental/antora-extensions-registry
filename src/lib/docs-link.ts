/** Where an entry's documentation lives, in precedence order. */
export type DocsSource = 'declared' | 'homepage' | 'repo-about' | 'docs-site';

export interface DocsFields {
  repository?: string;
  /** antoraRegistry.docs */
  docs?: string;
  /** package.json homepage */
  homepage?: string;
  /** GitHub/GitLab repository About URL */
  repoHomepage?: string;
  /** Known Antora site built from the repo's docs/ */
  docsSite?: string;
}

const norm = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '').replace(/\.git$/, '').replace(/\/+$/, '');

function usable(u: unknown, repository?: string): string | undefined {
  if (typeof u !== 'string' || !/^https?:\/\//i.test(u.trim())) return undefined;
  if (repository) {
    const a = norm(u), r = norm(repository);
    // The repo itself, or a page inside it (README, tree/main/...), is not separate docs.
    if (a === r || a.startsWith(r + '/')) return undefined;
  }
  return u.trim();
}

/** antoraRegistry.docs, then package.json homepage unless it is the repo, then the repo About URL, then a known docs site. */
export function pickDocsLink(e: DocsFields): { url: string; source: DocsSource } | undefined {
  const order: [unknown, DocsSource][] = [[e.docs, 'declared'], [e.homepage, 'homepage'], [e.repoHomepage, 'repo-about'], [e.docsSite, 'docs-site']];
  for (const [u, source] of order) {
    const url = usable(u, source === 'declared' ? undefined : e.repository);
    if (url) return { url, source };
  }
  return undefined;
}
