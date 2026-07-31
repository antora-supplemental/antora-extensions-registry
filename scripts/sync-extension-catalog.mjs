#!/usr/bin/env node
/**
 * Fetches ui-modules manifests from known repos and writes a static catalog snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'src', 'data', 'generated', 'extension-catalog.json');

const knownExtensionRepos = [
  {
    owner: 'antora-supplemental',
    repo: 'valentus-theme',
    branch: 'main',
    localRegistryIndex: '../valentus-theme/ui-modules/registry-index.json',
  },
];

const UI_MODULES_ROOT = 'ui-modules';
const REGISTRY_INDEX = `${UI_MODULES_ROOT}/registry-index.json`;
const REGISTRY = `${UI_MODULES_ROOT}/registry.json5`;

async function fetchRaw(owner, repo, filePath, branch = 'main') {
  for (const candidate of [branch, 'main', 'master']) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${candidate}/${filePath}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Antora-Extensions-Sync' } });
    if (res.ok) return res.text();
  }
  return null;
}

function readLocalIndex(ref) {
  if (!ref.localRegistryIndex) return null;
  const indexPath = path.resolve(ROOT, ref.localRegistryIndex);
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

async function discoverRepo(ref) {
  const { owner, repo, branch = 'main' } = ref;

  const local = readLocalIndex(ref);
  if (local) {
    return { source: 'registry-index.json (local)', ...local };
  }

  const indexText = await fetchRaw(owner, repo, REGISTRY_INDEX, branch);
  if (indexText) {
    const index = JSON.parse(indexText);
    return { source: 'registry-index.json', ...index };
  }

  const registryText = await fetchRaw(owner, repo, REGISTRY, branch);
  if (!registryText) return null;

  const registry = JSON5.parse(registryText);
  const modules = [];
  const recipes = [];

  for (const entry of registry.modules) {
    const manifestPath = `${UI_MODULES_ROOT}/${entry.path}/${entry.manifest || 'ui-module.json5'}`;
    const manifestText = await fetchRaw(owner, repo, manifestPath, branch);
    if (!manifestText) continue;
    const manifest = JSON5.parse(manifestText);
    modules.push({
      id: entry.id,
      name: manifest.name,
      version: manifest.version,
      type: 'ui-module',
      description: manifest.description || '',
      repository: manifest.repository || registry.repository,
      manifestPath: `${entry.path}/${entry.manifest || 'ui-module.json5'}`,
      modulePath: entry.path,
      requires: manifest.requires || [],
      recommends: manifest.recommends || [],
      conflicts: manifest.conflicts || [],
      partials: manifest.ui?.partials,
      slots: manifest.slots,
    });
  }

  for (const recipeEntry of registry.recipes || []) {
    const recipePath = `${UI_MODULES_ROOT}/${recipeEntry.path}`;
    const recipeText = await fetchRaw(owner, repo, recipePath, branch);
    if (!recipeText) continue;
    const recipe = JSON5.parse(recipeText);
    recipes.push({
      id: recipeEntry.id,
      name: recipe.name,
      version: recipe.version,
      type: 'ui-recipe',
      description: recipe.description || '',
      modules: recipe.modules,
      manifestPath: recipeEntry.path,
    });
  }

  return {
    schema: registry.schema || '1.0',
    repository: registry.repository || `https://github.com/${owner}/${repo}`,
    source: REGISTRY,
    modules,
    recipes,
  };
}

async function main() {
  const modules = [];
  const recipes = [];

  for (const ref of knownExtensionRepos) {
    const catalog = await discoverRepo(ref);
    if (!catalog) {
      console.warn(`No catalog in ${ref.owner}/${ref.repo}`);
      continue;
    }
    const slug = `${ref.owner}/${ref.repo}`.toLowerCase();
    for (const mod of catalog.modules) {
      modules.push({
        catalogId: `${slug}/${mod.id}`,
        repositoryOwner: ref.owner,
        repositoryName: ref.repo,
        ...mod,
      });
    }
    for (const recipe of catalog.recipes) {
      recipes.push({
        catalogId: `${slug}/${recipe.id}`,
        repositoryOwner: ref.owner,
        repositoryName: ref.repo,
        repository: catalog.repository,
        ...recipe,
      });
    }
    console.log(`Indexed ${catalog.modules.length} modules, ${catalog.recipes.length} recipes from ${ref.owner}/${ref.repo}`);
  }

  const output = {
    schema: '1.0',
    generatedAt: new Date().toISOString(),
    source: 'manifest',
    modules,
    recipes,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
