#!/usr/bin/env node
/**
 * Apply githubTopics from antora-registry-topics.json5 to GitHub repos.
 * Also merge-adds productTopic onto knownDependents (consumer playbook repos).
 * Requires: gh CLI authenticated with repo admin on target repos.
 *
 * Usage:
 *   node scripts/apply-registry-topics.mjs [path/to/antora-registry-topics.json5 ...]
 *   node scripts/apply-registry-topics.mjs --discover
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '../..');

function discoverTopicFiles() {
  const roots = [MONOREPO_ROOT, path.resolve(MONOREPO_ROOT, '..')];
  const found = new Set();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(root, entry.name, 'antora-registry-topics.json5');
      if (fs.existsSync(candidate)) found.add(candidate);
    }
  }
  return [...found];
}

function parseRepoFromUrl(repository) {
  const match = repository?.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function fetchTopics(owner, repo) {
  try {
    const out = execSync(
      `gh api repos/${owner}/${repo}/topics -H "Accept: application/vnd.github.mercy-preview+json"`,
      { encoding: 'utf8' },
    );
    const parsed = JSON.parse(out);
    return Array.isArray(parsed.names) ? parsed.names : [];
  } catch {
    return [];
  }
}

function putTopics(owner, repo, names) {
  const body = JSON.stringify({ names: [...new Set(names.map((n) => n.toLowerCase()))] });
  const tmp = path.join(process.cwd(), `.topics-${owner}-${repo}.json`);
  fs.writeFileSync(tmp, body, 'utf8');
  try {
    const out = execSync(
      `gh api -X PUT repos/${owner}/${repo}/topics -H "Accept: application/vnd.github.mercy-preview+json" --input "${tmp}"`,
      { encoding: 'utf8' },
    );
    const parsed = JSON.parse(out);
    console.log(`✓ ${owner}/${repo}: ${(parsed.names || names).join(', ')}`);
  } finally {
    fs.unlinkSync(tmp);
  }
}

/** Replace topics on the theme/extension repo itself (authoritative list from githubTopics). */
function applyTopicsReplace(owner, repo, names) {
  putTopics(owner, repo, names);
}

/** Merge-add topics onto a dependent without dropping unrelated topics. */
function applyTopicsMerge(owner, repo, addNames) {
  const existing = fetchTopics(owner, repo);
  putTopics(owner, repo, [...existing, ...addNames]);
}

function main() {
  const args = process.argv.slice(2);
  const files =
    args[0] === '--discover' || args.length === 0
      ? discoverTopicFiles()
      : args.map((file) => path.resolve(file));

  if (!files.length) {
    console.error('No antora-registry-topics.json5 files found.');
    process.exit(1);
  }

  for (const file of files) {
    const spec = JSON5.parse(fs.readFileSync(file, 'utf8'));
    const topics = spec.githubTopics;
    if (!Array.isArray(topics) || !topics.length) {
      console.warn(`Skip ${file}: no githubTopics`);
      continue;
    }
    const parsed = parseRepoFromUrl(spec.repository);
    if (!parsed) {
      console.warn(`Skip ${file}: invalid repository URL`);
      continue;
    }
    try {
      applyTopicsReplace(parsed.owner, parsed.repo, topics);
    } catch (err) {
      console.error(`✗ ${parsed.owner}/${parsed.repo}: ${err.stderr || err.message}`);
      process.exitCode = 1;
    }

    const productTopic =
      (typeof spec.productTopic === 'string' && spec.productTopic) ||
      parsed.repo;
    const dependents = Array.isArray(spec.knownDependents) ? spec.knownDependents : [];
    for (const depUrl of dependents) {
      const dep = parseRepoFromUrl(depUrl);
      if (!dep) {
        console.warn(`Skip dependent ${depUrl}: invalid URL`);
        continue;
      }
      try {
        applyTopicsMerge(dep.owner, dep.repo, [productTopic]);
      } catch (err) {
        console.error(`✗ dependent ${dep.owner}/${dep.repo}: ${err.stderr || err.message}`);
        process.exitCode = 1;
      }
    }
  }
}

main();
