import { A, createAsync, useNavigate } from '@solidjs/router';
import { createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ThemeCard from '~/components/catalog/ThemeCard';
import { loadGalleryThemes } from '~/lib/themes/catalog';

type OmniKind = 'all' | 'extensions' | 'themes' | 'registry';

export default function Home() {
  const themes = createAsync(() => loadGalleryThemes());
  const navigate = useNavigate();
  const [query, setQuery] = createSignal('');
  const [kind, setKind] = createSignal<OmniKind>('all');

  const submitOmni = (event: Event) => {
    event.preventDefault();
    const q = query().trim();
    const k = kind();
    if (k === 'themes') {
      navigate(q ? `/themes?q=${encodeURIComponent(q)}` : '/themes');
      return;
    }
    if (k === 'extensions') {
      navigate(q ? `/extensions?q=${encodeURIComponent(q)}` : '/extensions');
      return;
    }
    if (k === 'registry') {
      navigate(q ? `/registry?q=${encodeURIComponent(q)}` : '/registry');
      return;
    }
    // all → prefer registry search when typing; otherwise themes gallery
    navigate(q ? `/registry?q=${encodeURIComponent(q)}` : '/themes');
  };

  return (
    <SiteLayout title="Antora Supplemental Registry">
      <section class="relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-primary-600/10 via-transparent to-transparent" />
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div class="text-center max-w-3xl mx-auto">
            <p class="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-4">
              registry.antora-supplemental.org
            </p>
            <h1 class="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Discover Antora{' '}
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                extensions, themes &amp; more
              </span>
            </h1>
            <p class="text-slate-400 text-lg lg:text-xl mb-8">
              One catalog for the Antora ecosystem — playbook extensions, UI themes, UI modules, and install guidance.
              Themes are not extensions; both live here under clear categories.
            </p>

            <form class="max-w-2xl mx-auto mb-6" onSubmit={submitOmni}>
              <label class="sr-only" for="omni-search">Search the registry</label>
              <div class="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <input
                  id="omni-search"
                  type="search"
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  placeholder="Search extensions, themes, packages…"
                  class="flex-1 min-w-0 bg-transparent px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  class="shrink-0 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Search
                </button>
              </div>
              <div class="flex flex-wrap justify-center gap-2 mt-3" role="group" aria-label="Search category">
                <For each={(['all', 'extensions', 'themes', 'registry'] as OmniKind[])}>
                  {(chip) => (
                    <button
                      type="button"
                      class={
                        kind() === chip
                          ? 'px-3 py-1 rounded-full text-xs font-semibold bg-primary-600 text-white'
                          : 'px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'
                      }
                      onClick={() => setKind(chip)}
                    >
                      {chip === 'all' ? 'All' : chip === 'registry' ? 'Packages' : chip[0]!.toUpperCase() + chip.slice(1)}
                    </button>
                  )}
                </For>
              </div>
            </form>

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <A
                href="/extensions"
                class="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-primary-600/25"
              >
                UI Extensions
              </A>
              <A
                href="/themes"
                class="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
              >
                Theme Gallery
              </A>
              <A
                href="/registry"
                class="inline-flex items-center justify-center gap-2 px-8 py-4 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors"
              >
                Package search
              </A>
            </div>
          </div>
        </div>
      </section>

      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <A href="/extensions" class="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-primary-500/50 transition-colors group">
            <h2 class="text-xl font-semibold text-white mb-2 group-hover:text-primary-400">Extensions</h2>
            <p class="text-slate-400 text-sm">
              Index <code class="text-primary-300">ui-modules/registry.json5</code> manifests.
              GitHub topic discovery for <code class="text-primary-300">antora-extension</code> repos.
            </p>
          </A>
          <A href="/themes" class="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-primary-500/50 transition-colors group">
            <h2 class="text-xl font-semibold text-white mb-2 group-hover:text-primary-400">Themes</h2>
            <p class="text-slate-400 text-sm">
              Gallery of full Antora UI themes (ui.bundle) with previews, demos, and appearance filters.
              Not Antora extensions — a first-class category here.
            </p>
          </A>
          <A href="/registry" class="p-6 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-primary-500/50 transition-colors group">
            <h2 class="text-xl font-semibold text-white mb-2 group-hover:text-primary-400">Packages</h2>
            <p class="text-slate-400 text-sm">
              Search extensions and bundles with dependency analysis and install guidance.
            </p>
          </A>
        </div>
      </section>

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
