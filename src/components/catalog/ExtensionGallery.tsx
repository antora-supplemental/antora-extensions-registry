import { createSignal, createMemo, For, Show } from 'solid-js';
import { inputClass } from '~/components/ui/text-field';
import type { ExtensionCatalogEntry } from '~/types/ui-module';
import { matchesAppearanceFilter, type AppearanceFilter } from '~/data/github-topics';
import { APPEARANCE_FILTER_OPTIONS } from '~/lib/appearance-filter';
import ExtensionCard from './ExtensionCard';

interface ExtensionGalleryProps {
  initialQuery?: string;
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
}

type ViewMode = 'all' | 'single' | 'bundles';

const EXTENSION_APPEARANCE_OPTIONS = [
  { value: 'all' as AppearanceFilter, label: 'All color modes' },
  ...APPEARANCE_FILTER_OPTIONS.filter((o) => o.value !== 'all' && o.value !== 'default'),
];

export default function ExtensionGallery(props: ExtensionGalleryProps) {
  const [searchQuery, setSearchQuery] = createSignal(props.initialQuery ?? '');
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>('all');
  const [appearanceFilter, setAppearanceFilter] = createSignal<AppearanceFilter>('all');

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
    if (appearance !== 'all') {
      entries = entries.filter((e) => matchesAppearanceFilter(e.githubTopics ?? [], appearance));
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

    entries.sort((a, b) => a.name.localeCompare(b.name));
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
          onChange={(e) => setAppearanceFilter(e.currentTarget.value as AppearanceFilter)}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
          title="Filter by color mode"
          aria-label="Filter by color mode"
        >
          <For each={EXTENSION_APPEARANCE_OPTIONS}>
            {(opt) => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>
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
          <For each={filteredEntries()}>{(entry) => <ExtensionCard entry={entry} />}</For>
        </div>
      </Show>
    </div>
  );
}
