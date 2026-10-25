import { A, createAsync, useParams } from '@solidjs/router';
import { Meta, Title } from '@solidjs/meta';
import { createMemo, createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import DependencyTree from '~/components/catalog/DependencyTree';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { buildDependencyTree, dependents } from '~/lib/extension-deps';
import { loadExtensionCatalog } from '~/lib/server/catalog';
import { formatInstallSnippet } from '~/lib/ui-modules';

export default function ExtensionDetailPage() {
  const params = useParams();
  const catalog = createAsync(() => loadExtensionCatalog());
  const all = createMemo(() => {
    const c = catalog();
    return c ? [...c.modules, ...c.recipes] : [];
  });
  const entry = createMemo(() => all().find((e) => e.catalogId === params.catalogId));
  const [copied, setCopied] = createSignal(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <SiteLayout title="Extensions">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <A href="/extensions" class="text-sm text-primary-400 hover:text-primary-300">&larr; All extensions</A>
        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading extension…</div>}>
          <Show when={catalog()}>
            <Show
              when={entry()}
              fallback={
                <div class="py-16 text-center">
                  <h1 class="text-2xl font-bold text-white mb-2">Extension not found</h1>
                  <p class="text-slate-400">We couldn't find an extension called <code class="font-mono">{params.catalogId}</code>.</p>
                </div>
              }
            >
              {(e) => (
                <>
                  <Title>{`${e().name} - Antora Registry`}</Title>
                  <Meta name="description" content={e().description} />
                  <header class="mt-6 mb-8">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="primary">{e().type}</Badge>
                      <span class="font-mono text-sm text-slate-500">v{e().version}</span>
                    </div>
                    <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">{e().name}</h1>
                    <p class="text-slate-300 text-lg max-w-3xl">{e().description}</p>
                    <div class="mt-4 flex flex-wrap gap-2">
                      <a href={e().repository} target="_blank" rel="noopener noreferrer" class={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                        Repository
                      </a>
                    </div>
                  </header>

                  <div class="grid gap-6 lg:grid-cols-3">
                    <Card class="p-6 lg:col-span-2">
                      <h2 class="text-lg font-semibold text-white mb-4">Dependency tree</h2>
                      <DependencyTree tree={buildDependencyTree(e(), all())} />
                      <Show when={(e().requires?.length ?? 0) + (e().recommends?.length ?? 0) === 0}>
                        <p class="text-sm text-slate-400 mt-2">No dependencies.</p>
                      </Show>
                      <Show when={dependents(e(), all()).length > 0}>
                        <h3 class="text-sm font-semibold text-white mt-6 mb-2">Used by</h3>
                        <ul class="space-y-1">
                          <For each={dependents(e(), all())}>
                            {(d) => (
                              <li class="flex items-center gap-2 text-sm">
                                <Badge variant={d.relation === 'requires' ? 'warning' : 'muted'}>{d.relation}</Badge>
                                <A href={`/extensions/${d.entry.catalogId}`} class="text-primary-400 hover:text-primary-300">{d.entry.name}</A>
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                    </Card>

                    <Card class="p-6">
                      <h2 class="text-lg font-semibold text-white mb-4">Details</h2>
                      <dl class="space-y-2 text-sm">
                        <div><dt class="text-slate-500">Author</dt><dd class="text-slate-300">{e().author}</dd></div>
                        <div><dt class="text-slate-500">Updated</dt><dd class="text-slate-300">{new Date(e().lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd></div>
                        <div><dt class="text-slate-500">Stars</dt><dd class="text-slate-300">{e().stars}</dd></div>
                        <Show when={(e().conflicts?.length ?? 0) > 0}>
                          <div><dt class="text-slate-500">Conflicts</dt><dd class="text-slate-300">{e().conflicts.join(', ')}</dd></div>
                        </Show>
                        <Show when={(e().partials?.provide?.length ?? 0) > 0}>
                          <div><dt class="text-slate-500">Partials</dt><dd class="text-slate-300">{e().partials!.provide!.join(', ')}</dd></div>
                        </Show>
                      </dl>
                      <Show when={e().tags.length > 0}>
                        <div class="mt-4 flex flex-wrap gap-1">
                          <For each={e().tags}>{(t) => <Badge>{t}</Badge>}</For>
                        </div>
                      </Show>
                    </Card>
                  </div>

                  <Card class="p-6 mt-6">
                    <div class="flex items-center justify-between mb-3">
                      <h2 class="text-lg font-semibold text-white">Install</h2>
                      <button type="button" onClick={() => copy(formatInstallSnippet(e()))} class={buttonVariants({ variant: 'soft', size: 'sm' })}>
                        {copied() ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre class="p-3 bg-slate-900/80 border border-slate-700/50 rounded-lg text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre">{formatInstallSnippet(e())}</pre>
                  </Card>
                </>
              )}
            </Show>
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
