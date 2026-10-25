import { A, createAsync, useSearchParams } from '@solidjs/router';
import { Show } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import { buttonVariants } from '~/components/ui/button';
import { getSessionData } from '~/app';
import { ANTORA_APPEARANCE_TOPICS, ANTORA_TOPICS } from '~/data/github-topics';

const CONTRIBUTING_DOCS = 'https://docs.antora-supplemental.org/registry/contributing/';

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

const code = 'px-1.5 py-0.5 bg-slate-800 rounded text-primary-300 text-[0.9em]';

export default function AddPage() {
  const session = createAsync(() => getSessionData());
  const [params] = useSearchParams();
  const from = () => (params.from === 'themes' || params.from === 'extensions' ? params.from : null);
  const formHref = (kind: 'themes' | 'extensions') => `/${kind}/submit`;
  const signInHref = (kind: 'themes' | 'extensions') => `/auth/signin?redirect=${encodeURIComponent(formHref(kind))}`;
  const signedIn = () => Boolean(session()?.user);

  return (
    <SiteLayout
      title="Add to the registry"
      description="How to add an Antora extension or theme to the Antora Registry."
    >
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <header>
          <h1 class="text-3xl lg:text-4xl font-bold text-white mb-4">Add to the registry</h1>
          <p class="text-slate-400 text-lg">
            Made an Antora extension or theme? Here's how to get it listed. We review every submission before it's listed.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <A href={signedIn() ? formHref('extensions') : signInHref('extensions')} class={buttonVariants()}>Add your extension</A>
            <A href={signedIn() ? formHref('themes') : signInHref('themes')} class={buttonVariants({ variant: 'secondary' })}>Add your theme</A>
          </div>
        </header>

        <Show when={from() && !signedIn()}>
          <div id="sign-in" class="p-4 rounded-xl border border-primary-500/50 bg-slate-800/40 text-slate-300 text-sm">
            You need to sign in before you can add {from() === 'themes' ? 'a theme' : 'an extension'}.{' '}
            <A href={signInHref(from()!)} class="text-primary-400 hover:text-primary-300 font-medium">Sign in</A>
            {' '}and we'll bring you straight back to the form.
          </div>
        </Show>

        <section>
          <h2 class="text-2xl font-bold text-white mb-3">What qualifies</h2>
          <ul class="list-disc pl-5 space-y-1 text-slate-300">
            <li>An Antora extension (build-time, CI, generator, utility or site UI) or a complete Antora UI theme.</li>
            <li>A public GitHub repository that others can install from.</li>
            <li>Working code with a README that explains what it does and how to install it.</li>
            <li>An open-source license.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-2xl font-bold text-white mb-3">Steps for everyone</h2>
          <ol class="list-decimal pl-5 space-y-2 text-slate-300">
            <li>
              Add the GitHub topic <code class={code}>{ANTORA_TOPICS.EXTENSION}</code> or{' '}
              <code class={code}>{ANTORA_TOPICS.THEME}</code> to your repository (pick one).
            </li>
            <li>Write a README with a short description, install steps and a usage example.</li>
            <li>Add a LICENSE file.</li>
            <li>
              <Show when={!signedIn()} fallback={<>You're signed in.</>}>
                <A href="/auth/signin?redirect=/add" class="text-primary-400 hover:text-primary-300">Sign in</A>.
              </Show>
            </li>
            <li>Submit the repository URL with the extension or theme form.</li>
            <li>We review it. Once approved, it shows up in the registry.</li>
          </ol>
        </section>

        <section id="themes" class="scroll-mt-24">
          <h2 class="text-2xl font-bold text-white mb-3">Themes</h2>
          <ul class="list-disc pl-5 space-y-2 text-slate-300 mb-6">
            <li>
              Commit a <code class={code}>preview.png</code> (1280×720) to the root of the default branch. It's the image on your gallery card.
            </li>
            <li>Publish a live demo, for example on GitHub Pages, and set it as the repository website.</li>
            <li>
              Optionally tag the color modes it supports: <code class={code}>{ANTORA_APPEARANCE_TOPICS.LIGHT_THEME}</code>,{' '}
              <code class={code}>{ANTORA_APPEARANCE_TOPICS.DARK_THEME}</code>.
            </li>
          </ul>
          <h3 class="text-lg font-semibold text-white mb-2">Screenshot workflow</h3>
          <p class="text-slate-400 text-sm mb-3">
            Add this GitHub Action to your theme repository to regenerate <code class={code}>preview.png</code> from your live demo:
          </p>
          <pre class="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm text-slate-300 border border-slate-700/50 mb-6"><code>{screenshotWorkflow}</code></pre>
          <h3 class="text-lg font-semibold text-white mb-2">Starting points</h3>
          <ul class="list-disc pl-5 space-y-1 text-slate-300 mb-4">
            <li>Valentus: a complete theme with dark mode, good as a reference.</li>
            <li>Deploy template: an Antora playbook with a GitHub Actions workflow that publishes to Pages.</li>
          </ul>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="https://github.com/antora-supplemental/valentus-theme" target="_blank" rel="noopener noreferrer" class={buttonVariants({ variant: 'secondary' })}>
              View valentus-theme
            </a>
            <a href="https://github.com/antora-supplemental/antora-github-deploy-template" target="_blank" rel="noopener noreferrer" class={buttonVariants({ variant: 'secondary' })}>
              Use the deploy template
            </a>
          </div>
        </section>

        <section id="extensions" class="scroll-mt-24">
          <h2 class="text-2xl font-bold text-white mb-3">Extensions</h2>
          <ul class="list-disc pl-5 space-y-2 text-slate-300">
            <li>
              Tag the repository <code class={code}>{ANTORA_TOPICS.EXTENSION}</code>. Tagged repositories are found automatically, but submitting gets yours reviewed sooner.
            </li>
            <li>
              If it adds dark mode to an existing theme, also tag it <code class={code}>{ANTORA_APPEARANCE_TOPICS.DARK_MODE}</code> so it's listed under Dark mode add-ons.
            </li>
            <li>
              Optional: add a <code class={code}>ui-modules/registry.json5</code> manifest to list several extensions or bundles from one repository, with their dependencies.
              See the <a href={CONTRIBUTING_DOCS} target="_blank" rel="noopener" class="text-primary-400 hover:text-primary-300">contributing docs</a>.
            </li>
          </ul>
        </section>

        <section>
          <h2 class="text-2xl font-bold text-white mb-3">After you submit</h2>
          <ul class="list-disc pl-5 space-y-2 text-slate-300">
            <li>We review every submission before it's listed. Approved entries appear in the registry.</li>
            <li>Updates: push to your repository. The registry re-reads listed repositories every few hours.</li>
            <li>
              Removal: delete the topic and{' '}
              <a href="https://github.com/antora-supplemental/antora-extensions-registry/issues" target="_blank" rel="noopener" class="text-primary-400 hover:text-primary-300">open an issue</a>
              {' '}asking us to remove the listing.
            </li>
          </ul>
        </section>
      </div>
    </SiteLayout>
  );
}
