/**
 * One-off preview audit. "Before" = previews stored in production (served by /api/extensions/catalog);
 * "after" = the catalog rebuilt with the current extraction code. Every URL is checked (200 + image/*).
 * Usage: pnpm exec tsx scripts/audit-previews.ts [registryOrigin]   (GITHUB_TOKEN recommended)
 */
import { buildFullExtensionCatalog } from '../src/lib/extension-catalog';
import { pruneDeadPreviews } from '../src/lib/preview-check';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const origin = process.argv[2] ?? 'https://registry.antora-supplemental.org';

async function audit(label: string, entries: ExtensionCatalogEntry[]) {
  const withPreviews = entries.filter((e) => e.previews?.length).length;
  const r = await pruneDeadPreviews(entries);
  const emptied = r.affected.filter((id) => !entries.find((e) => e.catalogId === id)?.previews).length;
  console.log(`${label}: ${entries.length} packages, ${withPreviews} with previews, ${r.checkedUrls} URLs checked, ` +
    `${r.affected.length} packages with broken previews (${emptied} with none left), ${r.droppedUrls.length} dead URLs`);
  for (const id of r.affected.sort()) console.log(`  - ${id}`);
}

const res = await fetch(`${origin}/api/extensions/catalog`);
const live = (await res.json()) as { modules?: ExtensionCatalogEntry[]; recipes?: ExtensionCatalogEntry[] } | ExtensionCatalogEntry[];
await audit('before (production)', Array.isArray(live) ? live : [...(live.modules ?? []), ...(live.recipes ?? [])]);

const rebuilt = await buildFullExtensionCatalog({ includeTopicDiscovery: true, live: true });
await audit('after (current code)', [...rebuilt.modules, ...rebuilt.recipes]);
