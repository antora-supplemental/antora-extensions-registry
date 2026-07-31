import { createSignal, createMemo, For, Show } from 'solid-js';
import type { ExtensionCatalogEntry } from '~/types/ui-module';
import {
  isDarkModeOverlayOnly,
  matchesAppearanceFilter,
  type AppearanceFilter,
} from '~/data/github-topics';
import { APPEARANCE_FILTER_OPTIONS } from '~/lib/appearance-filter';
import ExtensionCard from './ExtensionCard';

interface ExtensionGalleryProps {
  modules: ExtensionCatalogEntry[];
  recipes: ExtensionCatalogEntry[];
}

type ViewMode = 'all' | 'modules' | 'recipes';

const EXTENSION_APPEARANCE_OPTIONS = [
  { value: 'all' as AppearanceFilter, label: 'All extensions', description: 'Includes dark mode overlays' },
  ...APPEARANCE_FILTER_OPTIONS.filter((o) => o.value !== 'default' && o.value !== 'light-dark'),
];

export default function ExtensionGallery(props: ExtensionGalleryProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
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
    if (mode === 'modules') entries = entries.filter((e) => e.type === 'ui-module');
    if (mode === 'recipes') entries = entries.filter((e) => e.type === 'ui-recipe');

    const appearance = appearanceFilter();
    if (appearance === 'all') {
      entries = entries.filter((e) => {
        const topics = e.githubTopics ?? [];
        return !isDarkModeOverlayOnly(topics);
      });
    } else {
      entries = entries.filter((e) =>
        matchesAppearanceFilter(e.githubTopics ?? [], appearance),
      );
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
            placeholder="Search modules and recipes..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>

        <select
          value={viewMode()}
          onChange={(e) => setViewMode(e.currentTarget.value as ViewMode)}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
        >
          <option value="all">All entries</option>
          <option value="modules">Modules only</option>
          <option value="recipes">Recipes only</option>
        </select>

        <select
          value={appearanceFilter()}
          onChange={(e) => setAppearanceFilter(e.currentTarget.value as AppearanceFilter)}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
          title="Appearance / capability filter"
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
            selectedTag() === null ? 'bg-primary-600 text-white' : 'bg-slate-800/50 text-slate-300'
          }`}
        >
          All tags
        </button>
        <For each={allTags()}>
          {(tag) => (
            <button
              onClick={() => setSelectedTag(tag === selectedTag() ? null : tag)}
              class={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                selectedTag() === tag ? 'bg-primary-600 text-white' : 'bg-slate-800/50 text-slate-300'
              }`}
            >
              {tag}
            </button>
          )}
        </For>
      </div>

      <p class="text-slate-400 text-sm mb-6">
        Showing {filteredEntries().length} entries. Default view hides dark-mode-only overlays — use
        &quot;Dark mode overlays&quot; to find slipstream extensions like antora-dark-mode.
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
