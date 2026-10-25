import { A, createAsync, Navigate } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import SubmitThemeForm from '~/components/catalog/SubmitThemeForm';
import { getSessionData } from '~/app';

export default function SubmitThemePage() {
  const session = createAsync(() => getSessionData());

  return (
    <SiteLayout title="Add your theme">
      <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading…</div>}>
        <Show when={session() !== undefined}>
          <Show when={session()?.user} fallback={<Navigate href="/add?from=themes#sign-in" />}>
            {(user) => (
              <section class="py-16 lg:py-24">
                <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div class="text-center mb-12">
                    <A href="/themes" class="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-6 transition-colors">
                      &larr; Themes
                    </A>
                    <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">Add your theme</h1>
                    <p class="text-slate-400 max-w-xl mx-auto">
                      Add your theme to the registry. We review every submission before it's listed.
                    </p>
                    <p class="text-slate-500 text-sm mt-2">
                      Signed in as <span class="text-primary-400">{user().name}</span> ·{' '}
                      <A href="/add#themes" class="text-primary-400 hover:text-primary-300">Read the guide</A>
                    </p>
                  </div>
                  <SubmitThemeForm userName={user().name ?? undefined} />
                </div>
              </section>
            )}
          </Show>
        </Show>
      </Suspense>
    </SiteLayout>
  );
}
