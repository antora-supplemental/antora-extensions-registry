import { useNavigate } from '@solidjs/router';
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { buttonVariants } from '~/components/ui/button';
import { loadSearchIndex, type SearchIndexItem } from '~/lib/server/catalog';
import { EXTENSION_KIND_LABELS, SEARCH_CATEGORIES, searchHref } from '~/lib/search-categories';
import { cn } from '~/lib/utils';

const MAX_SUGGESTIONS = 8;

/** Prefix beats substring beats in-order (fuzzy) character match; null when nothing matches. */
function score(q: string, item: SearchIndexItem): number | null {
  const name = item.name.toLowerCase();
  const id = item.id.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.split(/[\s\-_/]+/).some((w) => w.startsWith(q))) return 1;
  if (id.split(/[\s\-_/]+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q) || id.includes(q)) return 3;
  let i = 0;
  for (const ch of name) if (ch === q[i]) i++;
  return i === q.length ? 4 + (name.length - q.length) / 100 : null;
}

type Option = { key: string; label: string; meta: string; href: string; isNew?: boolean };

export default function SearchCombobox() {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal('');
  const [debounced, setDebounced] = createSignal('');
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  const [index, setIndex] = createSignal<SearchIndexItem[]>([]);
  let indexRequested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let root!: HTMLFormElement;
  onCleanup(() => clearTimeout(timer));

  const ensureIndex = () => {
    if (indexRequested) return;
    indexRequested = true;
    loadSearchIndex()
      .then(setIndex)
      .catch(() => (indexRequested = false));
  };

  const options = createMemo<Option[]>(() => {
    const q = debounced().trim().toLowerCase();
    if (!q) {
      return SEARCH_CATEGORIES.map((c) => ({ key: c.href, label: c.label, meta: 'Category', href: c.href }));
    }
    return index()
      .map((item) => ({ item, s: score(q, item) }))
      .filter((r): r is { item: SearchIndexItem; s: number } => r.s !== null)
      .sort((a, b) => a.s - b.s || a.item.name.localeCompare(b.item.name))
      .slice(0, MAX_SUGGESTIONS)
      .map(({ item }) => ({
        key: `${item.kind}:${item.id}`,
        label: item.name,
        meta: (item.disambiguator ? `${item.disambiguator} · ` : '') + (item.kind === 'theme' ? 'Theme' : (EXTENSION_KIND_LABELS[item.type]?.replace(/s$/, '') ?? 'Extension')),
        href: item.href,
        isNew: item.isNew,
      }));
  });

  const expanded = () => open() && options().length > 0;
  const optionId = (i: number) => `omni-option-${i}`;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const go = (href: string) => {
    close();
    navigate(href);
  };

  const onInput = (value: string) => {
    setQuery(value);
    setActive(-1);
    setOpen(true);
    clearTimeout(timer);
    // Empty input swaps straight back to categories; typing waits for a short pause.
    if (!value.trim()) setDebounced('');
    else timer = setTimeout(() => setDebounced(value), 120);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = options().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open()) setOpen(true);
        else if (n) setActive((a) => (a + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open()) setOpen(true);
        else if (n) setActive((a) => (a <= 0 ? n - 1 : a - 1));
        break;
      case 'Enter': {
        const opt = expanded() && active() >= 0 ? options()[active()] : undefined;
        if (opt) {
          e.preventDefault();
          go(opt.href);
        }
        break; // otherwise the form submits to /search?q=
      }
      case 'Escape':
        if (open()) {
          e.preventDefault();
          close();
        } else if (query()) {
          onInput('');
        }
        break;
      case 'Tab':
        close();
        break;
    }
  };

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const q = query().trim();
    go(q ? searchHref(q) : '/search');
  };

  return (
    <form
      ref={root}
      role="search"
      class="max-w-2xl mx-auto mb-6 text-left"
      onSubmit={onSubmit}
      onFocusOut={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !root.contains(next)) close();
      }}
    >
      <label class="sr-only" for="omni-search">Search the registry</label>
      <div class="relative group">
        {/* Subtle solid-accent glow, stronger on focus. */}
        <div aria-hidden="true" class="pointer-events-none absolute -inset-1 rounded-2xl bg-brand blur-md opacity-20 dark:opacity-15 group-focus-within:opacity-45 dark:group-focus-within:opacity-35 transition duration-700" />
        <div class="relative flex flex-col sm:flex-row gap-2 p-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 shadow-2xl">
          <input
            id="omni-search"
            type="search"
            role="combobox"
            autocomplete="off"
            spellcheck={false}
            aria-autocomplete="list"
            aria-controls="omni-listbox"
            aria-expanded={expanded()}
            aria-activedescendant={expanded() && active() >= 0 ? optionId(active()) : undefined}
            value={query()}
            onInput={(e) => onInput(e.currentTarget.value)}
            onFocus={() => {
              ensureIndex();
              setOpen(true);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search extensions and themes…"
            class="search-fade-end flex-1 min-w-0 bg-transparent px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button type="submit" class={cn(buttonVariants({ size: 'lg' }), 'shrink-0 font-semibold')}>
            Search
          </button>
        </div>
        {/* Absolutely positioned so opening it never shifts the page. */}
        <ul
          id="omni-listbox"
          role="listbox"
          aria-label={debounced().trim() ? 'Suggestions' : 'Categories'}
          hidden={!expanded()}
          class="search-pop absolute left-0 right-0 top-full mt-2 z-30 max-h-80 overflow-y-auto rounded-xl border py-1 shadow-2xl"
        >
          <For each={options()}>
            {(opt, i) => (
              <li
                id={optionId(i())}
                role="option"
                aria-selected={active() === i()}
                class="search-pop-option flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer"
                onMouseDown={(e) => e.preventDefault() /* keep focus in the input */}
                onMouseMove={() => setActive(i())}
                onClick={() => go(opt.href)}
              >
                <span class="flex min-w-0 items-center gap-2">
                  <span class="truncate font-medium">{opt.label}</span>
                  <Show when={opt.isNew}>
                    <span class="new-badge shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none">New</span>
                  </Show>
                </span>
                <span class="search-pop-meta shrink-0 text-xs font-semibold uppercase tracking-wide">{opt.meta}</span>
              </li>
            )}
          </For>
        </ul>
        <Show when={open() && debounced().trim() && options().length === 0}>
          <div class="search-pop absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border px-4 py-3 text-sm shadow-2xl" role="status">
            <span class="search-pop-meta">No name matches. Press Enter to search all text.</span>
          </div>
        </Show>
      </div>
    </form>
  );
}
