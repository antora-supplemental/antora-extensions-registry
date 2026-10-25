import { A, createAsync, useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ExtensionCard from '~/components/catalog/ExtensionCard';
import ThemeCard from '~/components/catalog/ThemeCard';
import { inputClass } from '~/components/ui/text-field';
import { loadExtensionCatalog, loadThemes } from '~/lib/server/catalog';

function matches(q: string, fields: Array<string | undefined>, tags: string[]): boolean {
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q)) || tags.some((t) => t.toLowerCase().includes(q));
}

/** Combined extension + theme results for the home page's "All" search. */
export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = () => (typeof params.q === 'string' ? params.q.trim() : '');
  const [draft, setDraft] = createSignal(query());
  const catalog = createAsync(() => loadExtensionCatalog());
  const themes = createAsync(() => loadThemes());

  const extensionHits = createMemo(() => {
    const c = catalog();
    if (!c) return [];
    const q = query().toLowerCase();
    return [...c.modules, ...c.recipes].filter((e) => matches(q, [e.name, e.description], e.tags));
  });
  const themeHits = createMemo(() => {
    const q = query().toLowerCase();
    return (themes() ?? []).filter((t) => matches(q, [t.name, t.description], t.tags));
  });

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const q = draft().trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <SiteLayout title={query() ? `Results for "${query()}"` : 'Search'}>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 class="text-3xl lg:text-4xl font-bold text-white mb-6">
          {query() ? <>Results for “{query()}”</> : 'Search extensions and themes'}
        </h1>
        <form onSubmit={onSubmit} role="search" class="mb-10 max-w-xl">
          <input
            type="search"
            value={draft()}
            onInput={(e) => setDraft(e.currentTarget.value)}
            placeholder="Search extensions and themes…"
            aria-label="Search extensions and themes"
            class={inputClass}
          />
        </form>

        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading…</div>}>
          <section class="mb-12">
            <div class="flex items-baseline justify-between mb-4">
              <h2 class="text-2xl font-bold text-white">Extensions</h2>
              <span class="text-sm text-slate-400">
                {extensionHits().length} {extensionHits().length === 1 ? 'extension' : 'extensions'}
              </span>
            </div>
            <Show
              when={extensionHits().length > 0}
              fallback={<p class="text-slate-400">No extensions match. <A href="/extensions" class="text-primary-400 hover:text-primary-300">Browse all extensions</A></p>}
            >
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={extensionHits()}>{(entry) => <ExtensionCard entry={entry} />}</For>
              </div>
            </Show>
          </section>

          <section>
            <div class="flex items-baseline justify-between mb-4">
              <h2 class="text-2xl font-bold text-white">Themes</h2>
              <span class="text-sm text-slate-400">
                {themeHits().length} {themeHits().length === 1 ? 'theme' : 'themes'}
              </span>
            </div>
            <Show
              when={themeHits().length > 0}
              fallback={<p class="text-slate-400">No themes match. <A href="/themes" class="text-primary-400 hover:text-primary-300">Browse all themes</A></p>}
            >
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={themeHits()}>{(theme) => <ThemeCard theme={theme} />}</For>
              </div>
            </Show>
          </section>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
