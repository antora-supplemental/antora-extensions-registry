#!/usr/bin/env node
/**
 * Apply githubTopics from antora-registry-topics.json5 to GitHub repos.
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
  const match = repository?.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function applyTopics(owner, repo, names) {
  const body = JSON.stringify({ names });
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
      applyTopics(parsed.owner, parsed.repo, topics);
    } catch (err) {
      console.error(`✗ ${parsed.owner}/${parsed.repo}: ${err.stderr || err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
