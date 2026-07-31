import { createAsync } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import { A } from '@solidjs/router';
import SiteLayout from '~/components/SiteLayout';
import ThemeGallery from '~/components/catalog/ThemeGallery';
import { loadThemes } from '~/lib/server/catalog';

export default function ThemesPage() {
  const themes = createAsync(() => loadThemes());

  return (
    <SiteLayout title="Themes" description="Browse Antora documentation themes">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">Theme Gallery</h1>
            <p class="text-slate-400 text-lg max-w-2xl">
              Explore Antora documentation themes. Filter by appearance, search by name,
              or submit your own theme for review.
            </p>
          </div>
          <A
            href="/themes/submit"
            class="inline-flex items-center justify-center px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-xl transition-colors shrink-0"
          >
            Submit a Theme
          </A>
        </div>

        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading themes...</div>}>
          <Show when={themes()}>{(list) => <ThemeGallery themes={list()} />}</Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
