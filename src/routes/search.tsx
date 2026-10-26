import { displayTitle } from '~/lib/package-title';
import { A, createAsync, useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ExtensionCard from '~/components/catalog/ExtensionCard';
import ThemeCard from '~/components/catalog/ThemeCard';
import { inputClass } from '~/components/ui/text-field';
import { EXTENSION_KIND_LABELS, searchHref, type SearchType } from '~/lib/search-categories';
import { loadExtensionCatalog, loadThemes } from '~/lib/server/catalog';
import { byFirstListedDesc, isNewListing, NEW_WINDOW_DAYS } from '~/lib/new-items';
import { entryLayerBoxes, isBundle, LAYERS, UNCLASSIFIED, type LayerBoxId } from '~/lib/layers';
import { LayerColumn, LayerList, type LayerGroup } from '~/components/catalog/LayerNav';
import { isListed, variantMatch } from '~/lib/catalog-groups';

const LAYER_BOXES: Array<{ id: LayerBoxId; label: string }> = [...LAYERS.map((l) => ({ id: l.id as LayerBoxId, label: l.label })), { id: UNCLASSIFIED, label: 'Unclassified' }];
const resultId = (catalogId: string) => `result-${catalogId}`;

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
  const newOnly = () => params.new === '1';
  /** Layers switched off in the Layers filter (`hide=engine,paint`). */
  const hidden = createMemo(() => new Set((typeof params.hide === 'string' ? params.hide : '').split(',').filter((h) => LAYER_BOXES.some((b) => b.id === h))));
  /** Build a search URL that keeps the `new` and `hide` state unless overridden. */
  const href = (opts: { type?: SearchType; kind?: string; new?: boolean; hide?: Set<string> } = {}) => {
    const u = new URL(searchHref(query(), opts.type ?? type(), 'kind' in opts ? opts.kind : kind()), 'http://x');
    if (opts.new ?? newOnly()) u.searchParams.set('new', '1');
    const h = [...(opts.hide ?? hidden())];
    if (h.length) u.searchParams.set('hide', h.join(','));
    return u.pathname + u.search;
  };
  const newHref = () => href({ new: !newOnly() });
  const toggleLayerHref = (id: string) => {
    const next = new Set(hidden());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return href({ hide: next });
  };
  const [draft, setDraft] = createSignal(query());
  const catalog = createAsync(() => loadExtensionCatalog());
  const themes = createAsync(() => loadThemes());

  const extensionHits = createMemo(() => {
    const c = catalog();
    if (!c) return [];
    const q = query().toLowerCase();
    const k = kind();
    // Canonical entries only; a hit on a variant's title or keywords returns its canonical entry (with a note).
    const hits = [...c.modules, ...c.recipes].filter(
      (e) => isListed(e) && (!k || (k === 'bundle' ? isBundle(e) : e.type === k)) && (matches(q, [displayTitle(e), e.name, e.id, e.description, e.titleDisambiguator ?? ''], e.tags) || Boolean(variantMatch(e, q))) && (!newOnly() || isNewListing(e.firstListedAt)),
    );
    return newOnly() ? hits.sort(byFirstListedDesc) : hits;
  });
  /** Per-layer counts before the Layers filter, for the filter chips. */
  const layerCounts = createMemo(() => {
    const counts = new Map<string, number>();
    for (const e of extensionHits()) for (const b of entryLayerBoxes(e)) counts.set(b, (counts.get(b) ?? 0) + 1);
    return counts;
  });
  /** Results after the Layers filter: kept when any of the entry's layers is still on. */
  const visibleHits = createMemo(() => extensionHits().filter((e) => entryLayerBoxes(e).some((b) => !hidden().has(b))));
  const layerGroups = createMemo<LayerGroup[]>(() =>
    LAYER_BOXES.filter((b) => !hidden().has(b.id))
      .map((b) => ({ id: b.id, label: b.label, items: visibleHits().filter((e) => entryLayerBoxes(e).includes(b.id)).map((e) => ({ catalogId: e.catalogId, name: e.name })) }))
      .filter((g) => g.items.length > 0),
  );
  const [highlighted, setHighlighted] = createSignal<string | null>(null);
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;
  /** Scroll a result into view and flash it. */
  const pick = (catalogId: string) => {
    const el = document.getElementById(resultId(catalogId));
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    el.querySelector<HTMLElement>('a[href^="/extensions/"]')?.focus({ preventScroll: true });
    setHighlighted(catalogId);
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => setHighlighted(null), 2400);
  };
  const themeHits = createMemo(() => {
    const q = query().toLowerCase();
    const hits = (themes() ?? []).filter((t) => matches(q, [t.name, t.description], t.tags) && (!newOnly() || isNewListing(t.firstListedAt)));
    return newOnly() ? hits.sort(byFirstListedDesc) : hits;
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
                <A href={href({ type: f.value, kind: undefined })} aria-current={type() === f.value && !kind() ? 'page' : undefined} class={chipClass(type() === f.value && !kind())}>
                  {f.label}
                </A>
              )}
            </For>
            <A
              href={newHref()}
              aria-current={newOnly() ? 'true' : undefined}
              title={`Added in the last ${NEW_WINDOW_DAYS} days`}
              class={chipClass(newOnly())}
            >
              New
            </A>
          </div>
          <Show when={type() === 'extensions'}>
            <div class="flex flex-wrap gap-2" aria-label="Extension kind">
              <For each={Object.entries(EXTENSION_KIND_LABELS)}>
                {([k, label]) => (
                  <A href={href({ type: 'extensions', kind: kind() === k ? undefined : k })} aria-current={kind() === k ? 'page' : undefined} class={chipClass(kind() === k)}>
                    {label}
                  </A>
                )}
              </For>
            </div>
          </Show>
          <Show when={type() !== 'themes'}>
            <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Layers">
              <span class="text-sm font-semibold text-slate-400 mr-1">Layers</span>
              <For each={LAYER_BOXES}>
                {(b) => (
                  <A href={toggleLayerHref(b.id)} aria-current={hidden().has(b.id) ? undefined : 'true'} title={hidden().has(b.id) ? `Show ${b.label}` : `Hide ${b.label}`} class={chipClass(!hidden().has(b.id))}>
                    {b.label} <span class="opacity-80">{layerCounts().get(b.id) ?? 0}</span>
                    <span class="sr-only">{hidden().has(b.id) ? ' (hidden, select to show)' : ' (shown, select to hide)'}</span>
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
                {visibleHits().length} {visibleHits().length === 1 ? 'extension' : 'extensions'}
              </span>
            </div>
            <Show
              when={visibleHits().length > 0}
              fallback={<p class="text-slate-400">No extensions match. <A href="/extensions" class="text-primary-400 hover:text-primary-300">Browse all extensions</A></p>}
            >
              <LayerList groups={layerGroups()} onPick={pick} />
              <div class="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
                <LayerColumn groups={layerGroups()} onPick={pick} />
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <For each={visibleHits()}>
                    {(entry) => (
                      <div
                        id={resultId(entry.catalogId)}
                        class={`scroll-mt-24 rounded-xl transition-shadow ${highlighted() === entry.catalogId ? 'ring-2 ring-primary-600' : ''}`}
                      >
                        <ExtensionCard entry={entry} />
                        <Show when={variantMatch(entry, query().toLowerCase())}>
                          {(v) => (
                            <p class="mt-1 px-1 text-xs text-slate-400" data-variant-match>
                              Matches variant <A href={`/extensions/${v().catalogId}`} class="text-primary-400 hover:text-primary-300 underline">{v().title}</A>
                            </p>
                          )}
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
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
