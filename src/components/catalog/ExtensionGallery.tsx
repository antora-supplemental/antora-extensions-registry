import { createSignal, createMemo, For, Show } from 'solid-js';
import { byFirstListedDesc, isNewListing } from '~/lib/new-items';
import { inputClass } from '~/components/ui/text-field';
import type { ExtensionCatalogEntry } from '~/types/ui-module';
import { hasDarkModeAddonTopic } from '~/data/github-topics';
import ExtensionCard from './ExtensionCard';
import { collapseForks } from '~/lib/fork-groups';

interface ExtensionGalleryProps {
  initialQuery?: string;
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
}

type ViewMode = 'all' | 'single' | 'bundles';

type ExtensionAppearanceFilter = 'all' | 'dark-mode-addon';

const EXTENSION_APPEARANCE_OPTIONS: Array<{ value: ExtensionAppearanceFilter; label: string }> = [
  { value: 'all', label: 'All extensions' },
  { value: 'dark-mode-addon', label: 'Dark mode add-ons' },
];

export default function ExtensionGallery(props: ExtensionGalleryProps) {
  const [searchQuery, setSearchQuery] = createSignal(props.initialQuery ?? '');
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>('all');
  const [newOnly, setNewOnly] = createSignal(false);
  const [sortBy, setSortBy] = createSignal<'name' | 'newest'>('name');
  const [appearanceFilter, setAppearanceFilter] = createSignal<ExtensionAppearanceFilter>('all');

  const allEntries = createMemo(() => [...props.modules, ...props.recipes]);

  const allTags = createMemo(() => {
    const tags = new Set<string>();
    allEntries().forEach((entry) => entry.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  });

  const filteredEntries = createMemo(() => {
    let entries = [...allEntries()];

    const mode = viewMode();
    if (mode === 'single') entries = entries.filter((e) => e.type !== 'ui-recipe');
    if (mode === 'bundles') entries = entries.filter((e) => e.type === 'ui-recipe');

    const appearance = appearanceFilter();
    if (appearance === 'dark-mode-addon') {
      entries = entries.filter((e) => hasDarkModeAddonTopic(e.githubTopics ?? []));
    }

    const query = searchQuery().toLowerCase();
    if (query) {
      entries = entries.filter(
        (entry) =>
          entry.name.toLowerCase().includes(query) ||
          entry.description.toLowerCase().includes(query) ||
          entry.id.toLowerCase().includes(query) ||
          entry.catalogId.toLowerCase().includes(query),
      );
    }

    const tag = selectedTag();
    if (tag) entries = entries.filter((entry) => entry.tags.includes(tag));

    if (newOnly()) entries = entries.filter((e) => isNewListing(e.firstListedAt));
    entries.sort((a, b) => (sortBy() === 'newest' ? byFirstListedDesc(a, b) : 0) || a.name.localeCompare(b.name));
    return entries;
  });

  return (
    <div>
      <div class="flex flex-col lg:flex-row gap-4 mb-6">
        <div class="relative flex-1">
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class={inputClass}
          />
        </div>

        <select
          value={viewMode()}
          aria-label="Filter by kind"
          onChange={(e) => setViewMode(e.currentTarget.value as ViewMode)}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
        >
          <option value="all">All</option>
          <option value="single">Single extensions</option>
          <option value="bundles">Bundles</option>
        </select>

        <select
          value={appearanceFilter()}
          onChange={(e) => setAppearanceFilter(e.currentTarget.value as ExtensionAppearanceFilter)}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
          title="Filter by color mode"
          aria-label="Filter by color mode"
        >
          <For each={EXTENSION_APPEARANCE_OPTIONS}>
            {(opt) => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>

        <select
          value={sortBy()}
          aria-label="Sort extensions"
          onChange={(e) => setSortBy(e.currentTarget.value as 'name' | 'newest')}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
        >
          <option value="name">Name</option>
          <option value="newest">Newest first</option>
        </select>

        <label class="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={newOnly()} onChange={(e) => setNewOnly(e.currentTarget.checked)} class="accent-primary-600" />
          <span class="new-badge rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none">New</span>
          <span class="text-sm">only</span>
        </label>
      </div>

      <div class="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedTag(null)}
          class={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            selectedTag() === null ? 'bg-primary-600 text-brand-foreground' : 'bg-slate-800/50 text-slate-300'
          }`}
        >
          All tags
        </button>
        <For each={allTags()}>
          {(tag) => (
            <button
              onClick={() => setSelectedTag(tag === selectedTag() ? null : tag)}
              class={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                selectedTag() === tag ? 'bg-primary-600 text-brand-foreground' : 'bg-slate-800/50 text-slate-300'
              }`}
            >
              {tag}
            </button>
          )}
        </For>
      </div>

      <p class="text-slate-400 text-sm mb-6">
        {filteredEntries().length} {filteredEntries().length === 1 ? 'extension' : 'extensions'}
      </p>

      <Show
        when={filteredEntries().length > 0}
        fallback={
          <div class="text-center py-16">
            <h3 class="text-xl font-semibold text-white mb-2">No extensions found</h3>
            <p class="text-slate-400">Try adjusting your search or filters</p>
          </div>
        }
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={collapseForks(filteredEntries(), allEntries())}>{(g) => <ExtensionCard entry={g.entry} forkCount={g.forkCount} />}</For>
        </div>
      </Show>
    </div>
  );
}
