/**
 * Writes src/data/catalog-snapshot.json so the deployed function does not depend on
 * unauthenticated GitHub API calls at request time. Set GITHUB_TOKEN to avoid rate limits.
 */
import fs from 'node:fs';
import { buildFullExtensionCatalog } from '../src/lib/extension-catalog';

const catalog = await buildFullExtensionCatalog({ includeTopicDiscovery: true, live: true });
const out = { generatedAt: new Date().toISOString(), ...catalog };
fs.writeFileSync('src/data/catalog-snapshot.json', JSON.stringify(out, null, 2) + '\n');
console.log(`[registry] catalog snapshot: ${catalog.modules.length} modules, ${catalog.recipes.length} recipes, ${catalog.indexedRepos.length} repos`);
if (catalog.modules.length + catalog.recipes.length === 0) process.exit(1);
