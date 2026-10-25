import { A, createAsync } from '@solidjs/router';
import { createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import { buttonVariants } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { getSessionData } from '~/app';
import { ANTORA_TOPICS } from '~/data/github-topics';
import { loadAdminData } from '~/lib/server/admin';

const endpoints = [
  { method: 'GET', path: '/api/extensions/catalog', note: 'Full extension catalog (add ?topics=false to skip topic discovery)' },
  { method: 'GET', path: '/api/extensions/topics', note: 'Topic schema and tagging rules' },
  { method: 'GET', path: '/api/extensions/discover?repoUrl=https://github.com/antora-supplemental/valentus-theme', note: 'Read the manifests of one repository' },
  { method: 'POST', path: '/api/extensions/submit', note: 'Submit an extension repository (sign-in required)' },
  { method: 'POST', path: '/api/themes/validate', note: 'Check a theme repository' },
  { method: 'POST', path: '/api/themes/submit', note: 'Submit a theme (sign-in required)' },
  { method: 'POST', path: '/api/admin/discover', note: 'Run GitHub topic discovery now (admin only)' },
];

interface DiscoveryResult {
  ranAt: string;
  extensions: Array<{ owner: string; repo: string; repoUrl: string; topics: string[] }>;
  themes: Array<{ owner: string; repo: string; repoUrl: string; topics: string[] }>;
  error?: string;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'never';

export default function AdminPage() {
  const session = createAsync(() => getSessionData());
  const data = createAsync(() => loadAdminData());
  const [running, setRunning] = createSignal(false);
  const [discovery, setDiscovery] = createSignal<DiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = createSignal<string | null>(null);

  const runDiscovery = async () => {
    setRunning(true);
    setDiscoveryError(null);
    try {
      const res = await fetch('/api/admin/discover', { method: 'POST' });
      const body = (await res.json()) as DiscoveryResult;
      if (!res.ok) setDiscoveryError(body.error ?? `Discovery failed (${res.status})`);
      else setDiscovery(body);
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Discovery failed');
    }
    setRunning(false);
  };

  return (
    <SiteLayout title="Admin">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading…</div>}>
          <Show
            when={data()}
            fallback={
              <div class="py-16 text-center">
                <h1 class="text-2xl font-bold text-white mb-2">Admins only</h1>
                <Show
                  when={session()?.user}
                  fallback={
                    <p class="text-slate-400">
                      <A href="/auth/signin?redirect=/admin" class="text-primary-400 hover:text-primary-300">Sign in</A> with an admin GitHub account to see this page.
                    </p>
                  }
                >
                  <p class="text-slate-400">Your account doesn't have admin access.</p>
                </Show>
              </div>
            }
          >
            {(d) => (
              <div class="space-y-6">
                <h1 class="text-3xl lg:text-4xl font-bold text-white">Admin</h1>

                <Show when={d().loadErrors.length > 0}>
                  <Card class="p-6 border-amber-500/50">
                    <h2 class="text-lg font-semibold text-white mb-3">Load errors</h2>
                    <ul class="space-y-1 text-sm text-amber-300 font-mono break-all">
                      <For each={d().loadErrors}>{(e) => <li>{e}</li>}</For>
                    </ul>
                  </Card>
                </Show>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Review queue ({d().queue.length})</h2>
                  <Show when={d().queue.length > 0} fallback={<p class="text-sm text-slate-400">Nothing waiting for review.</p>}>
                    <ul class="divide-y divide-slate-700/50 text-sm">
                      <For each={d().queue}>
                        {(item) => (
                          <li class="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span class="text-xs uppercase tracking-wide text-slate-500 w-20">{item.kind}</span>
                            <a href={item.repoUrl} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 font-medium">{item.name}</a>
                            <span class="text-slate-400">{item.detail}</span>
                            <span class="text-slate-500 ml-auto">{fmt(item.submittedAt)}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </Card>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Catalog sync</h2>
                  <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div><dt class="text-slate-500">Source</dt><dd class="text-slate-300">{d().catalogSource}</dd></div>
                    <div><dt class="text-slate-500">Last sync</dt><dd class="text-slate-300">{fmt(d().syncedAt)}</dd></div>
                    <div><dt class="text-slate-500">Indexed repositories</dt><dd class="text-slate-300">{d().indexedRepos.length}</dd></div>
                  </dl>
                  <p class="text-sm text-slate-400 mt-4">
                    The sync workflow runs every 6 hours. UI modules are indexed from{' '}
                    <code class="text-primary-300">ui-modules/registry.json5</code> manifests.
                  </p>
                </Card>

                <Card class="p-6">
                  <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 class="text-lg font-semibold text-white">GitHub topic discovery</h2>
                    <button type="button" onClick={runDiscovery} disabled={running()} class={buttonVariants({ size: 'sm' })}>
                      {running() ? 'Running…' : 'Run discovery'}
                    </button>
                  </div>
                  <p class="text-sm text-slate-400 mb-3">
                    Repos tagged <code class="text-primary-300">{ANTORA_TOPICS.EXTENSION}</code> or{' '}
                    <code class="text-primary-300">{ANTORA_TOPICS.THEME}</code> are discovered automatically.{' '}
                    {d().discoveredRepoCount} {d().discoveredRepoCount === 1 ? 'repository was' : 'repositories were'} found this way beyond the curated list.
                  </p>
                  <Show when={d().discoveredRepos.length > 0}>
                    <ul class="flex flex-wrap gap-2 text-sm mb-3">
                      <For each={d().discoveredRepos}>
                        {(r) => (
                          <li><a href={`https://github.com/${r.owner}/${r.repo}`} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300">{r.owner}/{r.repo}</a></li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={discoveryError()}>
                    <p class="text-sm text-red-400">{discoveryError()}</p>
                  </Show>
                  <Show when={discovery()}>
                    {(r) => (
                      <div class="text-sm text-slate-300 space-y-2 border-t border-slate-700/50 pt-3">
                        <p class="text-slate-400">Ran {fmt(r().ranAt)}: {r().extensions.length} extension repos, {r().themes.length} theme repos. Nothing is saved; the next sync picks them up.</p>
                        <ul class="space-y-1">
                          <For each={[...r().extensions.map((x) => ({ ...x, kind: 'extension' })), ...r().themes.map((x) => ({ ...x, kind: 'theme' }))]}>
                            {(x) => (
                              <li>
                                <span class="text-xs uppercase text-slate-500 mr-2">{x.kind}</span>
                                <a href={x.repoUrl} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300">{x.owner}/{x.repo}</a>
                              </li>
                            )}
                          </For>
                        </ul>
                      </div>
                    )}
                  </Show>
                </Card>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Manifest paths ({d().manifests.length})</h2>
                  <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="text-left text-slate-500"><th class="py-1 pr-4 font-medium">ID</th><th class="py-1 font-medium">Manifest</th></tr>
                      </thead>
                      <tbody>
                        <For each={d().manifests}>
                          {(m) => (
                            <tr class="border-t border-slate-700/30">
                              <td class="py-1 pr-4"><A href={`/extensions/${m.catalogId}`} class="font-mono text-primary-400 hover:text-primary-300">{m.catalogId}</A></td>
                              <td class="py-1 font-mono text-slate-300 break-all">{m.manifestPath}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">API endpoints</h2>
                  <ul class="space-y-2 text-sm">
                    <For each={endpoints}>
                      {(ep) => (
                        <li>
                          <span class="font-mono text-xs text-slate-500 mr-2">{ep.method}</span>
                          <Show when={ep.method === 'GET'} fallback={<code class="text-primary-300 break-all">{ep.path}</code>}>
                            <a href={ep.path} class="font-mono text-primary-400 hover:text-primary-300 break-all">{ep.path}</a>
                          </Show>
                          <span class="block text-slate-400">{ep.note}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Card>
              </div>
            )}
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
