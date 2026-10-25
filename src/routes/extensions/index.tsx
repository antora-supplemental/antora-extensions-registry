import { A, createAsync, useSearchParams } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ExtensionGallery from '~/components/catalog/ExtensionGallery';
import { buttonVariants } from '~/components/ui/button';
import { loadExtensionCatalog } from '~/lib/server/catalog';

export default function ExtensionsPage() {
  const catalog = createAsync(() => loadExtensionCatalog());
  const [params] = useSearchParams();
  const initialQuery = () => (typeof params.q === 'string' ? params.q : '');

  return (
    <SiteLayout
      title="Extensions"
      description="Find Antora extensions for builds, CI, generators and site UI."
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">Extensions</h1>
            <p class="text-slate-400 text-lg max-w-3xl">
              Extensions for Antora builds, CI checks, generators and site UI.
            </p>
          </div>
          <div class="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <A href="/extensions/submit" class={buttonVariants({ size: 'lg' })}>
              Add your extension
            </A>
            <A href="/add" class="text-sm text-primary-400 hover:text-primary-300">How to add to the registry</A>
          </div>
        </div>

        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading extensions…</div>}>
          <Show when={catalog()}>
            {(data) => (
              <>
                <Show when={data().catalogError}>
                  <div class="mb-8 p-4 bg-amber-500/10 border border-amber-500/50 rounded-xl text-amber-300 text-sm">
                    {data().catalogError}
                  </div>
                </Show>
                <ExtensionGallery modules={data().modules} recipes={data().recipes} initialQuery={initialQuery()} />
              </>
            )}
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
