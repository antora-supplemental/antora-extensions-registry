import type { ExtensionCatalogEntry } from '~/types/ui-module';

/**
 * Title without the owner: `@scope/name` drops the scope when it is the repository owner (shown in the byline);
 * other npm scopes are kept because they are part of the package name.
 */
export function displayTitle(e: Pick<ExtensionCatalogEntry, 'name' | 'repositoryOwner'>): string {
  const m = e.name.match(/^@([^/]+)\/(.+)$/);
  if (m && m[1].toLowerCase() === e.repositoryOwner.toLowerCase()) return m[2];
  return e.name;
}