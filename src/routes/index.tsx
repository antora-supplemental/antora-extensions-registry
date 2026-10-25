import { A, createAsync, useNavigate } from '@solidjs/router';
import { buttonVariants } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ThemeCard from '~/components/catalog/ThemeCard';
import { loadThemes } from '~/lib/server/catalog';

type OmniKind = 'all' | 'extensions' | 'themes';

export default function Home() {
  const themes = createAsync(() => loadThemes());
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
    // all: typed queries land on extension results (themes have their own chip); empty goes to the theme gallery
    navigate(q ? `/extensions?q=${encodeURIComponent(q)}` : '/themes');
  };

  return (
    <SiteLayout title="Antora Supplemental Registry">
      <section class="relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div class="text-center max-w-3xl mx-auto">
            <p class="text-primary-400 text-sm font-semibold tracking-widest uppercase mb-4">
              Unofficial Registry
            </p>
            <h1 class="font-bold text-white mb-8 leading-tight">
              <span class="block text-6xl sm:text-7xl lg:text-8xl tracking-tight">Antora</span>{' '}
              <span class="block mt-2 whitespace-nowrap text-[2rem] sm:text-5xl lg:text-6xl">Extensions &amp; Themes</span>
            </h1>

            <form class="max-w-2xl mx-auto mb-6" onSubmit={submitOmni}>
              <label class="sr-only" for="omni-search">Search the registry</label>
              <div class="relative group">
                {/* Subtle solid-accent glow, stronger on focus. */}
                <div aria-hidden="true" class="pointer-events-none absolute -inset-1 rounded-2xl bg-brand blur-md opacity-20 dark:opacity-15 group-focus-within:opacity-45 dark:group-focus-within:opacity-35 transition duration-700" />
                <div class="relative flex flex-col sm:flex-row gap-2 p-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 shadow-2xl">
                  <input
                    id="omni-search"
                    type="search"
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                    placeholder="Search extensions and themes…"
                    class="search-fade-end flex-1 min-w-0 bg-transparent px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    class={cn(buttonVariants({ size: 'lg' }), 'shrink-0 font-semibold')}
                  >
                    Search
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap justify-center gap-2 mt-3" role="group" aria-label="Search category">
                <For each={(['all', 'extensions', 'themes'] as OmniKind[])}>
                  {(chip) => (
                    <button
                      type="button"
                      aria-pressed={kind() === chip}
                      class={
                        kind() === chip
                          ? 'px-3 py-1 rounded-full text-xs font-semibold bg-primary-600 text-brand-foreground'
                          : 'px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'
                      }
                      onClick={() => setKind(chip)}
                    >
                      {chip === 'all' ? 'All' : chip[0]!.toUpperCase() + chip.slice(1)}
                    </button>
                  )}
                </For>
              </div>
            </form>

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <A
                href="/extensions"
                class={cn(buttonVariants({ size: 'xl' }), 'shadow-lg shadow-primary-600/25')}
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
            <p class="text-slate-400 text-sm">
              Build-time, CI and utility Antora extensions, plus UI-side modules indexed from <code class="text-primary-300">ui-modules/registry.json5</code> manifests.
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
