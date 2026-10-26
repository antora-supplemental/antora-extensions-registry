import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverGitLabByTopic, gitlabForkFields, gitlabRawBase, parseGitLabUrl, hostQualified } from '../src/lib/gitlab';
import { gitInstallSpec, upstreamFork } from '../src/lib/ui-modules';
import { forkGroupKey } from '../src/lib/fork-groups';
import { registerRawBase, resolveRepoUrl } from '../src/lib/catalog-enrich';
import { fromGitHubUser, fromGitLabNamespace, ownerKey, sizedAvatar, syncOwners, ownerPath } from '../src/lib/owners';
import { memoryPreviewStore } from '../src/lib/preview-cache';
import { displayTitle } from '../src/lib/package-title';
import type { ExtensionCatalogEntry } from '../src/types/ui-module';

const json = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

test('GitLab topic discovery paginates with x-next-page', async () => {
  const seen: string[] = [];
  const f = async (u: string) => {
    seen.push(u);
    const page = new URL(u).searchParams.get('page');
    return page === '2'
      ? json([{ id: 2, path_with_namespace: 'b/two', topics: ['antora-extension'] }], { 'x-next-page': '' })
      : json([{ id: 1, path_with_namespace: 'antora/antora-lunr-extension', topics: ['antora-extension'] }, ...Array.from({ length: 99 }, (_, i) => ({ id: 10 + i, path_with_namespace: `x/p${i}`, topics: ['antora-extension'] }))], { 'x-next-page': '2' });
  };
  const hits = await discoverGitLabByTopic('antora-extension', 'gitlab.com', 3, f);
  assert.equal(seen.length, 2);
  assert.ok(seen[0].includes('/api/v4/projects?') && seen[0].includes('topic=antora-extension'));
  assert.equal(hits.length, 101);
  assert.equal(`${hits[0].host}/${hits[0].owner}/${hits[0].repo}`, 'gitlab.com/antora/antora-lunr-extension');
});

test('GitLab fork fields and URLs', () => {
  const f = gitlabForkFields('gitlab.com', { id: 3, path_with_namespace: 'me/lunr', star_count: 2, forked_from_project: { id: 1, path_with_namespace: 'antora/antora-lunr-extension' } } as never);
  assert.equal(f.stars, 2);
  assert.ok(JSON.stringify(f).includes('antora/antora-lunr-extension'));
  assert.equal(gitlabRawBase('gitlab.com', 'antora', 'x'), 'https://gitlab.com/antora/x/-/raw/');
  assert.deepEqual(parseGitLabUrl('https://gitlab.example.org/group/sub/proj'), { host: 'gitlab.example.org', owner: 'group/sub', repo: 'proj' });
  assert.equal(hostQualified('gitlab.com', 'a', 'b'), 'gitlab.com/a/b');
});

test('git install spec: GitLab uses git+https, GitHub uses github:', () => {
  assert.equal(gitInstallSpec({ repositoryOwner: 'antora', repositoryName: 'antora-lunr-extension', repositoryHost: 'gitlab.com' } as never), 'git+https://gitlab.com/antora/antora-lunr-extension.git');
  assert.match(gitInstallSpec({ repositoryOwner: 'o', repositoryName: 'r' } as never), /^github:o\/r/);
});

test('cross-host grouping: a GitHub repo declaring a GitLab upstream groups with it', () => {
  const fork = upstreamFork({ upstream: 'https://gitlab.com/antora/antora-lunr-extension' } as never);
  assert.ok(fork);
  const up = { repositoryHost: 'gitlab.com', repositoryOwner: 'antora', repositoryName: 'antora-lunr-extension', id: 'lunr', manifestPath: 'package.json' } as never;
  const gh = { repositoryOwner: 'ryan', repositoryName: 'antora-lunr-extension', id: 'lunr', manifestPath: 'package.json', forkOf: fork } as never;
  assert.equal(forkGroupKey(gh), forkGroupKey(up));
  assert.ok(JSON.stringify(fork).includes('gitlab.com/antora/antora-lunr-extension'));
});

test('GitLab blob links and relative images resolve to /-/raw/', () => {
  registerRawBase('antora', 'antora-lunr-extension', 'https://gitlab.com/antora/antora-lunr-extension/-/raw/');
  assert.equal(resolveRepoUrl('antora', 'antora-lunr-extension', 'main', 'docs/shot.png'), 'https://gitlab.com/antora/antora-lunr-extension/-/raw/main/docs/shot.png');
  assert.equal(resolveRepoUrl('antora', 'antora-lunr-extension', 'main', 'https://gitlab.com/antora/antora-lunr-extension/-/blob/main/a.png'), 'https://gitlab.com/antora/antora-lunr-extension/-/raw/main/a.png');
});

test('owner metadata mapping and paths', () => {
  assert.deepEqual(fromGitHubUser({ login: 'Octo', type: 'Organization', name: 'Octo Inc', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', html_url: 'https://github.com/Octo' }), { host: 'github.com', login: 'Octo', type: 'org', profileUrl: 'https://github.com/Octo', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4', displayName: 'Octo Inc' });
  assert.equal(fromGitLabNamespace('gitlab.com', { full_path: 'antora', kind: 'group', avatar_url: '/uploads/a.png' }).avatarUrl, 'https://gitlab.com/uploads/a.png');
  assert.equal(sizedAvatar('https://avatars.githubusercontent.com/u/1?v=4', 'github.com'), 'https://avatars.githubusercontent.com/u/1?v=4&s=64');
  assert.equal(sizedAvatar('https://gitlab.com/uploads/a.png', 'gitlab.com'), 'https://gitlab.com/uploads/a.png?width=64');
  assert.equal(ownerPath('GitLab.com', 'antora'), '/owners/gitlab.com/antora');
  assert.equal(displayTitle({ name: '@antora-supplemental/article-zones', repositoryOwner: 'antora-supplemental' }), 'Article Zones');
  assert.equal(displayTitle({ name: '@antora/lunr-extension', repositoryOwner: 'someone' }), 'Lunr Extension');
});

test('avatars: cached on success, failed first fetch never cached, cached survives a later failure', async () => {
  const store = memoryPreviewStore();
  const entries = [{ catalogId: 'o/r/p', repositoryOwner: 'o' }, { catalogId: 'o/r2/p', repositoryOwner: 'o' }] as unknown as ExtensionCatalogEntry[];
  const lookup = async () => ({ host: 'github.com', login: 'o', type: 'user' as const, profileUrl: 'https://github.com/o', avatarUrl: 'https://avatars.githubusercontent.com/u/9' });
  const bad = async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } });
  await syncOwners(entries, store, bad, lookup);
  assert.equal(store.blobs.size, 0);
  assert.equal(entries[0].owner?.avatar, undefined);
  const good = async () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]), { status: 200, headers: { 'content-type': 'image/png' } });
  const owners = await syncOwners(entries, store, good, lookup);
  assert.equal(owners.length, 1);
  assert.equal(store.rows.filter((r) => r.catalogId === ownerKey('github.com', 'o')).length, 1);
  assert.match(entries[1].owner!.avatar!, /^\/previews\/[0-9a-f]{64}$/);
  await syncOwners(entries, store, bad, lookup);
  assert.match(entries[0].owner!.avatar!, /^\/previews\//);
});