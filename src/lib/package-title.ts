import type { ExtensionCatalogEntry } from '~/types/ui-module';

/** Words kept upper-case (or in their canonical casing) when humanizing a package name. */
const ACRONYMS: Record<string, string> = {
  ui: 'UI', css: 'CSS', toc: 'TOC', html: 'HTML', js: 'JS', ts: 'TS', ux: 'UX', url: 'URL', urls: 'URLs', api: 'API',
  pdf: 'PDF', svg: 'SVG', ai: 'AI', seo: 'SEO', lunr: 'Lunr', asciidoctor: 'Asciidoctor', antora: 'Antora', npm: 'npm', diataxis: 'Diátaxis',
};

/** True when a name looks like a raw package identifier (lower-case, hyphens/scope), not a written title. */
export function isRawName(name: string): boolean {
  return /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name.trim());
}

/** `@scope/antora-dark-mode` -> "Antora Dark Mode"; keeps acronyms such as UI, CSS, TOC. */
export function humanizePackageName(name: string): string {
  const bare = name.trim().replace(/^@[^/]+\//, '');
  return bare
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** First heading of a README (`# Title` or AsciiDoc `= Title`), without inline markup; undefined when absent. */
export function readmeHeading(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  for (const line of text.split(/\r?\n/).slice(0, 40)) {
    const m = line.match(/^(?:#|=)\s+(.+?)\s*#*\s*$/);
    if (m) {
      const t = m[1].replace(/<[^>]+>/g, '').replace(/[`*_]/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
      return t || undefined;
    }
  }
  return undefined;
}

/**
 * Display title: antoraRegistry.title, package.json displayName, README first heading (resolved at sync into `title`),
 * else the name when it is already a written title, else a humanized package name.
 */
export function displayTitle(e: Pick<ExtensionCatalogEntry, 'name' | 'repositoryOwner'> & { title?: string }): string {
  if (e.title?.trim()) return e.title.trim();
  return isRawName(e.name) ? humanizePackageName(e.name) : e.name;
}

/** The installable package name (what npm and install commands need). */
export function rawPackageName(e: Pick<ExtensionCatalogEntry, 'name'> & { packageName?: string }): string {
  return e.packageName ?? e.name;
}

/** Picks the sync-time title from declared sources, in order; README headings equal to the raw name are ignored. */
export function pickTitle(opts: { registryTitle?: unknown; displayName?: unknown; readme?: string | null; name?: string }): string | undefined {
  for (const v of [opts.registryTitle, opts.displayName]) if (typeof v === 'string' && v.trim()) return v.trim();
  const h = readmeHeading(opts.readme);
  if (h && !isRawName(h) && h.toLowerCase() !== (opts.name ?? '').toLowerCase()) return h;
  return undefined;
}
