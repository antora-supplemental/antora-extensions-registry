import { createSignal, createMemo, For, Show } from 'solid-js';
import { byFirstListedDesc, isNewListing } from '~/lib/new-items';
import { inputClass } from '~/components/ui/text-field';
import { cn } from '~/lib/utils';
import type { Theme } from '~/types/theme';
import {
  matchesThemeAppearance,
  THEME_APPEARANCE_FILTER_OPTIONS,
  type ThemeAppearanceFilter,
} from '~/lib/appearance-filter';
import ThemeCard from './ThemeCard';

interface ThemeGalleryProps {
  themes: Theme[];
}

export default function ThemeGallery(props: ThemeGalleryProps) {
  const initialQ =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') ?? '' : '';
  const [searchQuery, setSearchQuery] = createSignal(initialQ);
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);
  const [sortBy, setSortBy] = createSignal<'stars' | 'updated' | 'newest' | 'name'>('stars');
  const [newOnly, setNewOnly] = createSignal(false);
  const [appearanceFilter, setAppearanceFilter] = createSignal<ThemeAppearanceFilter>('all');

  const allTags = createMemo(() => {
    const tags = new Set<string>();
    props.themes.forEach((theme) => theme.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  });

  const filteredThemes = createMemo(() => {
    let themes = [...props.themes];

    const query = searchQuery().toLowerCase();
    if (query) {
      themes = themes.filter(
        (theme) =>
          theme.name.toLowerCase().includes(query) ||
          theme.description.toLowerCase().includes(query) ||
          theme.author.toLowerCase().includes(query),
      );
    }

    const appearance = appearanceFilter();
    themes = themes.filter((theme) => matchesThemeAppearance(theme.appearance, appearance));

    const tag = selectedTag();
    if (tag) {
      themes = themes.filter((theme) => theme.tags.includes(tag));
    }

    if (newOnly()) themes = themes.filter((t) => isNewListing(t.firstListedAt));
    const sort = sortBy();
    themes.sort((a, b) => {
      if (sort === 'stars') return b.stars - a.stars;
      if (sort === 'newest') return byFirstListedDesc(a, b);
      if (sort === 'updated') return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      return a.name.localeCompare(b.name);
    });

    return themes;
  });

  return (
    <div>
      <div class="flex flex-col lg:flex-row gap-4 mb-8">
        <div class="relative flex-1 rounded-xl bg-card/50 border border-border/50 transition-all focus-within:ring-2 focus-within:ring-primary-500/50 focus-within:border-primary-500/50">
          <svg class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Search themes..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            aria-label="Search themes"
            class={cn(inputClass, 'search-fade-left pl-14 pr-4 bg-transparent border-0 focus:ring-0')}
          />
        </div>

        <select
          value={sortBy()}
          onChange={(e) => setSortBy(e.currentTarget.value as 'stars' | 'updated' | 'newest' | 'name')}
          aria-label="Sort themes"
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 cursor-pointer"
        >
          <option value="stars">Most Stars</option>
          <option value="updated">Recently Updated</option>
          <option value="newest">Newest first</option>
          <option value="name">Name</option>
        </select>

        <select
          value={appearanceFilter()}
          onChange={(e) => setAppearanceFilter(e.currentTarget.value as ThemeAppearanceFilter)}
          class="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer"
          title="Filter by appearance"
          aria-label="Filter by appearance"
        >
          <For each={THEME_APPEARANCE_FILTER_OPTIONS}>
            {(opt) => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>

        <label class="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={newOnly()} onChange={(e) => setNewOnly(e.currentTarget.checked)} class="accent-primary-600" />
          <span class="new-badge rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none">New</span>
          <span class="text-sm">only</span>
        </label>
      </div>

      <div class="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setSelectedTag(null)}
          class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedTag() === null
              ? 'bg-primary-600 text-brand-foreground'
              : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          All
        </button>
        <For each={allTags()}>
          {(tag) => (
            <button
              onClick={() => setSelectedTag(tag === selectedTag() ? null : tag)}
              class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedTag() === tag
                  ? 'bg-primary-600 text-brand-foreground'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {tag}
            </button>
          )}
        </For>
      </div>

      <p class="text-slate-400 text-sm mb-6">
        Showing {filteredThemes().length} of {props.themes.length} themes
      </p>

      <Show
        when={filteredThemes().length > 0}
        fallback={
          <div class="text-center py-16">
            <h3 class="text-xl font-semibold text-white mb-2">No themes found</h3>
            <p class="text-slate-400">Try adjusting your search or filters</p>
          </div>
        }
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={filteredThemes()}>{(theme) => <ThemeCard theme={theme} />}</For>
        </div>
      </Show>
    </div>
  );
}
