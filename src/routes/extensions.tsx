import { createAsync } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ExtensionGallery from '~/components/catalog/ExtensionGallery';
import { ANTORA_TOPICS } from '~/data/github-topics';
import { loadExtensionCatalog } from '~/lib/server/catalog';

export default function ExtensionsPage() {
  const catalog = createAsync(() => loadExtensionCatalog());

  return (
    <SiteLayout
      title="UI Extensions"
      description="Browse composable Antora UI modules indexed from repository manifests"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="mb-8">
          <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">UI Extensions</h1>
          <p class="text-slate-400 text-lg max-w-3xl">
            Composable UI modules indexed from{' '}
            <code class="px-1.5 py-0.5 bg-slate-800 rounded text-primary-300">ui-modules/registry.json5</code>
            {' '}manifests. Repos tagged{' '}
            <code class="px-1.5 py-0.5 bg-slate-800 rounded text-primary-300">{ANTORA_TOPICS.EXTENSION}</code>
            {' '}are discovered automatically.
          </p>
        </div>

        <div class="mb-8 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl text-sm text-slate-400 space-y-2">
          <p>
            Catalog API: <a href="/api/extensions/catalog" class="text-primary-400 hover:text-primary-300">/api/extensions/catalog</a>
            {' '}· Topic schema: <a href="/api/extensions/topics" class="text-primary-400 hover:text-primary-300">/api/extensions/topics</a>
            {' '}· Discover: <a href="/api/extensions/discover?repoUrl=https://github.com/antora-supplemental/valentus-theme" class="text-primary-400 hover:text-primary-300">/api/extensions/discover</a>
            {' '}· Submit repo: <code class="text-primary-300">POST /api/extensions/submit</code> (sign-in required)
          </p>
        </div>

        <Suspense
          fallback={
            <div class="text-center py-16 text-slate-400">Loading extension catalog...</div>
          }
        >
          <Show when={catalog()}>
            {(data) => (
              <>
                <Show when={data().catalogError}>
                  <div class="mb-8 p-4 bg-amber-500/10 border border-amber-500/50 rounded-xl text-amber-300 text-sm">
                    {data().catalogError}
                  </div>
                </Show>
                <Show when={data().discoveredRepoCount > 0}>
                  <p class="text-emerald-400/90 text-sm mb-6">
                    {data().discoveredRepoCount} additional{' '}
                    {data().discoveredRepoCount === 1 ? 'repository' : 'repositories'} found via GitHub topics.
                  </p>
                </Show>
                <ExtensionGallery modules={data().modules} recipes={data().recipes} />
              </>
            )}
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
