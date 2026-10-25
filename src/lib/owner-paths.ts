/** Client-safe owner helpers (no server imports). */
import type { ExtensionCatalogEntry } from '~/types/ui-module';

export function ownerHost(e: Pick<ExtensionCatalogEntry, 'repositoryHost'>): string {
  return (e.repositoryHost ?? 'github.com').toLowerCase();
}

/** Stable key, also the preview-cache "catalogId" for the avatar (purged with the owner). */
export function ownerKey(host: string, login: string): string {
  return `owner:${host.toLowerCase()}/${login.toLowerCase()}`;
}

/** Registry page for an owner: /owners/<host>/<login> (GitLab group paths keep their slashes). */
export function ownerPath(host: string, login: string): string {
  return `/owners/${host.toLowerCase()}/${login}`;
}

export function profileUrl(host: string, login: string): string {
  return `https://${host}/${login}`;
}

/** Entries by one owner (case-insensitive login, host-aware). */
export function entriesByOwner(all: ExtensionCatalogEntry[], host: string, login: string): ExtensionCatalogEntry[] {
  return all.filter((e) => ownerHost(e) === host.toLowerCase() && e.repositoryOwner.toLowerCase() === login.toLowerCase());
}