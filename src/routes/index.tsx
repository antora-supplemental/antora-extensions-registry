import { A, createAsync } from '@solidjs/router';
import { buttonVariants } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { For, Show, Suspense } from 'solid-js';
import SearchCombobox from '~/components/SearchCombobox';
import SiteLayout from '~/components/SiteLayout';
import ThemeCard from '~/components/catalog/ThemeCard';
import { loadExtensionCatalog, loadThemes } from '~/lib/server/catalog';
import FeaturedExtension from '~/components/catalog/FeaturedExtension';

export default function Home() {
  // deferStream: hold the SSR stream until the data resolves so the cards render in place in the first HTML
  // (no out-of-order <template> swap after </body>, no loading placeholder, no layout shift on hydration).
  const themes = createAsync(() => loadThemes(), { deferStream: true });
  const catalog = createAsync(() => loadExtensionCatalog(), { deferStream: true });
  const featured = () => {
    const c = catalog();
    if (!c) return [];
    const all = [...c.modules, ...c.recipes];
    return c.featured.map((id) => all.find((e) => e.catalogId === id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  };
  const allEntries = () => (catalog() ? [...catalog()!.modules, ...catalog()!.recipes] : []);

  return (
    <SiteLayout>
      <section class="relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div class="text-center max-w-3xl mx-auto">
            <p class="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-4">
              Unofficial Registry
            </p>
            <h1 class="font-bold text-white mb-8 leading-tight">
              <span class="block text-6xl sm:text-7xl lg:text-8xl tracking-tight">Antora</span>{' '}
              <span class="block mt-2 whitespace-nowrap text-[2rem] sm:text-5xl lg:text-6xl">Extensions &amp; Themes</span>
            </h1>

            <SearchCombobox />

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <A
                href="/extensions"
                class={buttonVariants({ variant: 'secondary', size: 'xl' })}
              >
                Extensions
              </A>
              <A
                href="/themes"
                class={buttonVariants({ variant: 'secondary', size: 'xl' })}
              >
                Theme Gallery
              </A>
            </div>
          </div>
        </div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <A href="/extensions" class="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-primary-500/50 transition-colors group">
            <h2 class="text-xl font-semibold text-white mb-2 group-hover:text-primary-400">Extensions</h2>
            <p class="text-slate-400 text-sm">Build-time, CI, utility and UI extensions for Antora.</p>
          </A>
          <A href="/themes" class="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-primary-500/50 transition-colors group">
            <h2 class="text-xl font-semibold text-white mb-2 group-hover:text-primary-400">Themes</h2>
            <p class="text-slate-400 text-sm">Complete UI themes for Antora sites, with previews and live demos.</p>
          </A>
        </div>
        <p class="mt-6 text-center text-sm text-slate-400">
          Made an extension or theme?{' '}
          <A href="/add" class="text-primary-400 hover:text-primary-300 font-medium">Add it to the registry</A>
        </p>
      </section>

      <Suspense>
        <Show when={featured().length > 0}>
          <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12" aria-labelledby="featured-heading">
            <h2 id="featured-heading" class="text-2xl font-bold text-white mb-6">Featured</h2>
            <div class="grid gap-6">
              <For each={featured()}>{(e) => <FeaturedExtension entry={e} all={allEntries()} />}</For>
            </div>
          </section>
        </Show>
      </Suspense>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-2xl font-bold text-white">Featured Themes</h2>
          <A href="/themes" class="text-primary-400 hover:text-primary-300 text-sm font-medium">
            View all themes →
          </A>
        </div>
        <Suspense fallback={<div class="text-slate-400 text-center py-12">Loading themes…</div>}>
          <Show
            when={themes()?.length}
            fallback={<p class="text-slate-400 text-center py-12">No themes in the gallery yet.</p>}
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <For each={themes()!.slice(0, 6)}>
                {(theme) => <ThemeCard theme={theme} />}
              </For>
            </div>
          </Show>
        </Suspense>
      </section>
    </SiteLayout>
  );
}
