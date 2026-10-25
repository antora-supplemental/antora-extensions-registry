import { A, createAsync, useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ExtensionCard from '~/components/catalog/ExtensionCard';
import ThemeCard from '~/components/catalog/ThemeCard';
import { inputClass } from '~/components/ui/text-field';
import { EXTENSION_KIND_LABELS, searchHref, type SearchType } from '~/lib/search-categories';
import { loadExtensionCatalog, loadThemes } from '~/lib/server/catalog';

function matches(q: string, fields: Array<string | undefined>, tags: string[]): boolean {
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q)) || tags.some((t) => t.toLowerCase().includes(q));
}

const TYPE_FILTERS: Array<{ value: SearchType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'extensions', label: 'Extensions' },
  { value: 'themes', label: 'Themes' },
];

const chipClass = (on: boolean) =>
  on
    ? 'px-3 py-1.5 rounded-full text-sm font-semibold bg-primary-600 text-brand-foreground'
    : 'px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500';

/** Combined extension + theme results, refined by type (and extension kind) from the URL. */
export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = () => (typeof params.q === 'string' ? params.q.trim() : '');
  const type = (): SearchType => (params.type === 'extensions' || params.type === 'themes' ? params.type : 'all');
  const kind = () => (type() === 'extensions' && typeof params.kind === 'string' && params.kind in EXTENSION_KIND_LABELS ? params.kind : undefined);
  const [draft, setDraft] = createSignal(query());
  const catalog = createAsync(() => loadExtensionCatalog());
  const themes = createAsync(() => loadThemes());

  const extensionHits = createMemo(() => {
    const c = catalog();
    if (!c) return [];
    const q = query().toLowerCase();
    const k = kind();
    return [...c.modules, ...c.recipes].filter(
      (e) => (!k || e.type === k) && matches(q, [e.name, e.id, e.description], e.tags),
    );
  });
  const themeHits = createMemo(() => {
    const q = query().toLowerCase();
    return (themes() ?? []).filter((t) => matches(q, [t.name, t.description], t.tags));
  });

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const q = draft().trim();
    navigate(searchHref(q, type(), kind()));
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

        <nav aria-label="Filter results" class="mb-10 -mt-6 flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <For each={TYPE_FILTERS}>
              {(f) => (
                <A href={searchHref(query(), f.value)} aria-current={type() === f.value && !kind() ? 'page' : undefined} class={chipClass(type() === f.value && !kind())}>
                  {f.label}
                </A>
              )}
            </For>
          </div>
          <Show when={type() === 'extensions'}>
            <div class="flex flex-wrap gap-2" aria-label="Extension kind">
              <For each={Object.entries(EXTENSION_KIND_LABELS)}>
                {([k, label]) => (
                  <A href={kind() === k ? searchHref(query(), 'extensions') : searchHref(query(), 'extensions', k)} aria-current={kind() === k ? 'page' : undefined} class={chipClass(kind() === k)}>
                    {label}
                  </A>
                )}
              </For>
            </div>
          </Show>
        </nav>

        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading…</div>}>
          <Show when={type() !== 'themes'}>
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
          </Show>

          <Show when={type() !== 'extensions'}>
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
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
