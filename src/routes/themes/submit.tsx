import { createAsync } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import { A, Navigate } from '@solidjs/router';
import SiteLayout from '~/components/SiteLayout';
import SubmitThemeForm from '~/components/catalog/SubmitThemeForm';
import { getSessionData } from '~/app';

const screenshotWorkflow = `- name: Generate Preview Screenshot
  uses: simonw/shot-scraper-action@v1
  with:
    url: https://\${{ github.repository_owner }}.github.io/\${{ github.event.repository.name }}/
    output: preview.png
    width: 1280
    height: 720

- name: Commit Screenshot
  run: |
    git config user.name "Preview Bot"
    git config user.email "actions@github.com"
    git add preview.png
    git commit -m "Update preview screenshot" || exit 0
    git push`;

export default function SubmitThemePage() {
  const session = createAsync(() => getSessionData());

  return (
    <SiteLayout title="Submit Theme">
      <Suspense fallback={<div class="text-center py-16 text-slate-400">Checking sign-in...</div>}>
        <Show when={session() !== undefined}>
          <Show
            when={session()?.user}
            fallback={<Navigate href="/auth/signin" />}
          >
            {(user) => (
              <section class="py-16 lg:py-24">
                <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div class="text-center mb-12">
                    <A href="/themes" class="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-6 transition-colors">
                      Back to Gallery
                    </A>
                    <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">Submit Your Theme</h1>
                    <p class="text-slate-400 max-w-xl mx-auto">
                      Share your Antora UI theme with the community. We validate your repository before listing.
                    </p>
                    <p class="text-slate-500 text-sm mt-2">
                      Submitting as <span class="text-primary-400">{user().name}</span>
                    </p>
                  </div>

                  <SubmitThemeForm userName={user().name ?? undefined} />

                  <div class="mt-16 pt-16 border-t border-slate-700/50">
                    <h2 class="text-2xl font-bold text-white mb-6 text-center">Start from a solid base</h2>
                    <p class="text-slate-400 text-center mb-8 max-w-xl mx-auto">
                      Use a finished theme as your reference implementation, or bootstrap a docs site with our
                      GitHub deploy template (playbook + Actions → Pages).
                    </p>

                    <div class="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                      <h3 class="text-lg font-semibold text-white mb-4">Recommended starting points</h3>
                      <ul class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-6">
                        <li class="flex items-center gap-2 text-slate-300">Valentus — full chrome + dark mode</li>
                        <li class="flex items-center gap-2 text-slate-300">Deploy template — playbook + Pages CI</li>
                        <li class="flex items-center gap-2 text-slate-300">preview.png for gallery cards</li>
                        <li class="flex items-center gap-2 text-slate-300">shot-scraper Action for screenshots</li>
                      </ul>
                      <div class="flex flex-col sm:flex-row gap-3">
                        <a
                          href="https://github.com/antora-supplemental/valentus-theme"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary-600/25"
                        >
                          View valentus-theme
                        </a>
                        <a
                          href="https://github.com/antora-supplemental/antora-github-deploy-template"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                        >
                          Use deploy template
                        </a>
                      </div>
                    </div>
                  </div>

                  <div class="mt-12">
                    <h3 class="text-lg font-semibold text-white mb-4">Screenshot Generation Workflow</h3>
                    <p class="text-slate-400 text-sm mb-4">
                      Add this GitHub Action to your theme repository for automatic preview screenshots:
                    </p>
                    <pre class="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm text-slate-300 border border-slate-700/50"><code>{screenshotWorkflow}</code></pre>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </Show>
      </Suspense>
    </SiteLayout>
  );
}
