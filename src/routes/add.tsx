import { A, createAsync, useSearchParams } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import { expediteRepoCheck, type ExpediteResult } from '~/lib/server/registry';
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

const manifestExample = `{
  "appearance": "dark",
  "baseTheme": "antora-supplemental/valentus-theme",
  "demoUrl": "https://example.github.io/my-theme/"
}`;

const code = 'px-1.5 py-0.5 bg-code text-code-foreground rounded text-[0.9em]';

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
            Made an Antora extension or theme? Here's how to get it listed. Repositories that meet the criteria below can be checked and listed right away; everything else is reviewed by an admin.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <A href={signedIn() ? formHref('extensions') : signInHref('extensions')} class={buttonVariants()}>Add your extension</A>
            <A href={signedIn() ? formHref('themes') : signInHref('themes')} class={buttonVariants({ variant: 'secondary' })}>Add your theme</A>
          </div>
        </header>

        <Show when={from() && !signedIn()}>
          <div id="sign-in" class="p-4 rounded-xl border border-primary-500/50 bg-slate-800/40 text-slate-300 text-sm">
            You need to sign in before you can add {from() === 'themes' ? 'a theme' : 'an extension'}.{' '}
            <A href={signInHref(from()!)} class="text-primary-400 hover:text-primary-300 font-medium">Sign in</A>.
          </div>
        </Show>

        <section id="check" class="scroll-mt-24">
          <h2 class="text-2xl font-bold text-white mb-3">Check a repository now</h2>
          <p class="text-slate-400 mb-4">
            Discovery runs once a day. To skip the wait, paste a GitHub repository URL. If it meets every criterion it's listed immediately;
            otherwise you'll see what to fix.
          </p>
          <Show
            when={signedIn()}
            fallback={
              <p class="text-slate-300 text-sm">
                <A href="/auth/signin?redirect=/add%23check" class="text-primary-400 hover:text-primary-300 font-medium">Sign in</A> to check a repository.
              </p>
            }
          >
            <ExpediteForm />
          </Show>
        </section>

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
            <li>Check it with the form above to list it right away, or submit it with the extension or theme form for review.</li>
            <li>Submissions from trusted publishers (such as the antora-supplemental organization and its members) are listed without waiting for review.</li>
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
              Declare its appearance with topics: <code class={code}>{ANTORA_APPEARANCE_TOPICS.LIGHT_THEME}</code> for light only,{' '}
              <code class={code}>{ANTORA_APPEARANCE_TOPICS.DARK_THEME}</code> for dark only, both for a theme with light and dark modes,
              or <code class={code}>{ANTORA_APPEARANCE_TOPICS.OTHER_THEME}</code> for anything else (high contrast, sepia and so on).
              The gallery filters Light, Dark, Light + dark and Other use these.
            </li>
            <li>
              Or declare it in an <code class={code}>antora-theme.json</code> file at the repository root. The file wins over topics, and they
              must not disagree. <code class={code}>appearance</code> is <code class={code}>light</code>, <code class={code}>dark</code>,{' '}
              <code class={code}>both</code> or <code class={code}>other</code>.
            </li>
            <li>
              If your theme only swaps the color variables of another theme, name that theme as <code class={code}>baseTheme</code> (owner/repo)
              in the manifest. The card shows it as a color re-theme. A fork alone doesn't count.
            </li>
          </ul>
          <pre class="bg-code text-code-foreground border border-code-border rounded-xl p-4 overflow-x-auto text-sm mb-6"><code>{manifestExample}</code></pre>
          <h3 class="text-lg font-semibold text-white mb-2">Screenshot workflow</h3>
          <p class="text-slate-400 text-sm mb-3">
            Add this GitHub Action to your theme repository to regenerate <code class={code}>preview.png</code> from your live demo:
          </p>
          <pre class="bg-code text-code-foreground border border-code-border rounded-xl p-4 overflow-x-auto text-sm mb-6"><code>{screenshotWorkflow}</code></pre>
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
              Tag the repository <code class={code}>{ANTORA_TOPICS.EXTENSION}</code>. Tagged repositories are found once a day; use the check above to list yours sooner.
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
            <li>Submissions that aren't checked automatically wait for an admin. Approved entries appear in the registry.</li>
            <li>Updates: push to your repository. The registry re-reads listed repositories once a day.</li>
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

function ExpediteForm() {
  const [url, setUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [result, setResult] = createSignal<ExpediteResult | null>(null);
  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setResult(await expediteRepoCheck(url()));
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'The check failed.' });
    }
    setBusy(false);
  };
  return (
    <div class="space-y-4">
      <form onSubmit={submit} class="flex flex-col sm:flex-row gap-2">
        <label for="check-url" class="sr-only">GitHub repository URL</label>
        <input
          id="check-url"
          type="url"
          required
          placeholder="https://github.com/owner/repo"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          class="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm"
        />
        <button type="submit" disabled={busy()} class={buttonVariants()}>{busy() ? 'Checking…' : 'Check repository'}</button>
      </form>
      <Show when={result()}>
        {(r) => (
          <div role="status" class="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40 text-sm space-y-3">
            <Show when={r().ok} fallback={<p class="text-red-400">{r().error}</p>}>
              <p class={r().imported ? 'text-emerald-400 font-medium' : r().passed ? 'text-slate-200' : 'text-amber-300 font-medium'}>{r().message}</p>
              <ul class="space-y-1">
                <For each={r().criteria}>
                  {(c) => (
                    <li class="flex gap-2">
                      <span aria-hidden="true" class={c.ok ? 'text-emerald-400' : 'text-red-400'}>{c.ok ? '✓' : '✗'}</span>
                      <span class="sr-only">{c.ok ? 'Passed:' : 'Failed:'}</span>
                      <span class="text-slate-300">
                        {c.label}
                        <Show when={c.detail}><span class="block text-xs text-slate-400">{c.detail}</span></Show>
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show when={r().remaining !== undefined}>
              <p class="text-xs text-slate-400">{r().remaining} {r().remaining === 1 ? 'check' : 'checks'} left this hour.</p>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
