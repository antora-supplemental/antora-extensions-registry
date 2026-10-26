import { A, createAsync, useParams } from '@solidjs/router';
import { Meta, Title } from '@solidjs/meta';
import { createMemo, createSignal, For, Show, Suspense } from 'solid-js';
import { PackageCompat } from '~/components/catalog/PackageCompat';
import { AntoraBadges, ReleasesTable, SchemeSwatches } from '~/components/catalog/AntoraCompat';
import SiteLayout from '~/components/SiteLayout';
import NewBadge from '~/components/catalog/NewBadge';
import ReportButton from '~/components/catalog/ReportButton';
import DependencyTree from '~/components/catalog/DependencyTree';
import LayerBadges from '~/components/catalog/LayerBadges';
import BundleContents from '~/components/catalog/BundleContents';
import ForkVersions from '~/components/catalog/ForkVersions';
import PackageTitle from '~/components/catalog/PackageTitle';
import { displayTitle, rawPackageName } from '~/lib/package-title';
import { forkVariants } from '~/lib/fork-groups';
import PreviewGallery from '~/components/catalog/PreviewGallery';
import FullDescription, { inline } from '~/components/catalog/FullDescription';
import { INSTALL_GUIDE_URL, installGuidance } from '~/lib/install-guidance';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { buildDependencyTree, dependentLabel, dependents } from '~/lib/extension-deps';
import { loadExtensionCatalog } from '~/lib/server/catalog';
import { formatInstallSnippet } from '~/lib/ui-modules';
import { layerLabel } from '~/lib/layers';

export default function ExtensionDetailPage() {
  const params = useParams();
  const catalog = createAsync(() => loadExtensionCatalog());
  const all = createMemo(() => {
    const c = catalog();
    return c ? [...c.modules, ...c.recipes] : [];
  });
  const entry = createMemo(() => all().find((e) => e.catalogId === params.catalogId));
  const [copied, setCopied] = createSignal(false);
  /** Other packages from the same repository (monorepos list each package separately). */
  const siblings = createMemo(() => {
    const e = entry();
    if (!e) return [];
    const key = `${e.repositoryHost ?? ''}/${e.repositoryOwner}/${e.repositoryName}`.toLowerCase();
    return all()
      .filter((x) => x.catalogId !== e.catalogId && `${x.repositoryHost ?? ''}/${x.repositoryOwner}/${x.repositoryName}`.toLowerCase() === key)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <SiteLayout title="Extensions">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <A href="/extensions" class="text-sm text-primary-400 hover:text-primary-300">&larr; All extensions</A>
        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading extension…</div>}>
          <Show when={catalog()}>
            <Show
              when={entry()}
              fallback={
                <div class="py-16 text-center">
                  <h1 class="text-2xl font-bold text-white mb-2">Extension not found</h1>
                  <p class="text-slate-400">We couldn't find an extension called <code class="font-mono">{params.catalogId}</code>.</p>
                </div>
              }
            >
              {(e) => (
                <>
                  <Title>{`${displayTitle(e())} - Antora Registry`}</Title>
                  <Meta name="description" content={e().description} />
                  <header class="mt-6 mb-8">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="primary">{e().type}</Badge>
                      <Show when={e().bundle}><Badge variant="primary">Bundle · {e().bundle!.members.length}</Badge></Show>
                      <span class="font-mono text-sm text-slate-500">v{e().version}</span>
                      <NewBadge firstListedAt={e().firstListedAt} />
                    </div>
                    <div class="mb-4"><PackageTitle entry={e()} as="h1" link={false} titleClass="text-3xl lg:text-4xl font-bold text-white break-words" /><p class="mt-1 font-mono text-sm text-slate-500 break-all" title="Package name">{rawPackageName(e())}<Show when={e().npmName}><span class="ml-2 font-sans text-xs">· also on <a href={`https://www.npmjs.com/package/${e().npmName}`} target="_blank" rel="noopener noreferrer" class="underline hover:text-slate-300">npm</a></span></Show></p>
                    <Show when={e().titleInUseBy && !e().replacedBy}>
                      <p class="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-300" role="note">Title already in use by <A href={`/extensions/${e().titleInUseBy}`} class="underline">an earlier package</A>. Authors: set a unique <code>antoraRegistry.title</code> in package.json.</p>
                    </Show></div>
                    <Show when={e().replacedBy}>
                      {(r) => (
                        <p class="mt-3 mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="note" data-replaced-by>
                          Replaced by <A href={`/extensions/${r().catalogId}`} class="font-semibold underline">{r().title}</A>. This entry is kept for existing installs and is hidden from search.
                        </p>
                      )}
                    </Show>
                    <Show when={e().partOf}>
                      {(p) => (
                        <p class="mt-3 mb-3 rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 py-2 text-sm text-slate-200" role="note" data-part-of>
                          Part of <A href={`/extensions/${p().catalogId}`} class="font-semibold text-primary-400 hover:text-primary-300 underline">{p().title}</A>
                        </p>
                      )}
                    </Show>
                    <p class="text-slate-300 text-lg max-w-3xl">{e().description}</p>
                    <LayerBadges entry={e()} class="mt-3" />
                    <div class="mt-3 flex flex-wrap items-center gap-2"><AntoraBadges entry={e()} /></div>
                    <ForkVersions current={e()} variants={forkVariants(e(), all())} />
                    <div class="mt-4 flex flex-wrap gap-2">
                      <a href={e().repository} target="_blank" rel="noopener noreferrer" class={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                        Repository
                      </a>
                      <ReportButton itemKind="extension" itemId={e().catalogId} itemName={e().name} class="self-center ml-2" />
                    </div>
                  </header>

                  <Show when={e().variants?.length}>
                    <section class="mb-8 rounded-xl border border-slate-700/60 bg-slate-800/30 p-5" aria-labelledby="ways-heading" data-ways-to-use>
                      <h2 id="ways-heading" class="text-xl font-semibold text-white mb-3">Ways to use it</h2>
                      <ul class="space-y-2">
                        <For each={e().variants}>
                          {(v) => (
                            <li class="text-sm text-slate-300">
                              <A href={`/extensions/${v.catalogId}`} class="font-semibold text-primary-400 hover:text-primary-300">{v.title}</A>
                              <span class="ml-2 text-xs text-slate-500">{v.type}</span>
                              <span class="block text-slate-400">{v.description}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </section>
                  </Show>

                  <Show when={e().longDescription}>
                    <FullDescription text={e().longDescription!} repository={e().repository} />
                  </Show>

                  <Show when={(e().previews?.length ?? 0) > 0}>
                    <section class="mb-6" aria-label="Preview images">
                      <PreviewGallery previews={e().previews!} name={e().name} />
                    </section>
                  </Show>

                  <PackageCompat links={e().compat} />

                  <Show when={siblings().length > 0}>
                    <Card class="p-6 mb-6">
                      <h2 class="text-lg font-semibold text-white mb-1">More from this repo</h2>
                      <p class="text-sm text-slate-400 mb-4">
                        Other packages in <code class="font-mono">{e().repositoryOwner}/{e().repositoryName}</code>. Each has its own version, releases and compatibility.
                      </p>
                      <ul class="grid gap-2 sm:grid-cols-2">
                        <For each={siblings()}>
                          {(s) => (
                            <li class="text-sm">
                              <A href={`/extensions/${s.catalogId}`} class="text-primary-400 hover:text-primary-300 font-medium" title={rawPackageName(s)}>{displayTitle(s)}</A>
                              <span class="text-slate-500 font-mono text-xs ml-2">v{s.version}</span>
                              <Show when={s.layers?.length}><span class="text-slate-500 text-xs ml-2">{s.layers!.map(layerLabel).join(', ')}</span></Show>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Card>
                  </Show>

                  <Show when={e().colorSchemes?.length}>
                    <Card class="p-6 mb-6">
                      <h2 class="text-lg font-semibold text-white mb-1">Color schemes</h2>
                      <p class="text-sm text-slate-400 mb-4">Declared by the paint's <code class="font-mono">@color-schemes</code> comment. Swatches: canvas, accent, link, text.</p>
                      <SchemeSwatches schemes={e().colorSchemes} showLabels />
                    </Card>
                  </Show>

                  <Show when={e().releases?.length}>
                    <Card class="p-6 mb-6">
                      <h2 class="text-lg font-semibold text-white mb-1">Releases by Antora version</h2>
                      <p class="text-sm text-slate-400 mb-4">
                        Compatibility per release, from the tag's <code class="font-mono">+antora.N</code> build metadata, then <code class="font-mono">engines.antora</code>, then <code class="font-mono">@antora/*</code> peer dependencies, then the repository's <code class="font-mono">antoraRegistry.antora</code>.
                      </p>
                      <ReleasesTable releases={e().releases!} />
                    </Card>
                  </Show>

                  <Show when={e().bundle}>
                    <Card class="p-6 mb-6">
                      <h2 class="text-lg font-semibold text-white mb-1">Bundle contents</h2>
                      <p class="text-sm text-slate-400 mb-4">
                        {e().bundle!.members.length} packages.{' '}
                        {e().bundle!.source === 'declared' ? 'Declared by the repository.' : e().bundle!.source === 'admin' ? 'Set by a registry admin.' : `Detected: ${e().bundle!.reason ?? 'depends on several indexed extensions'}.`}{' '}
                        Registry entries link to their pages; names marked "not in registry" link out to npm or GitHub.
                      </p>
                      <BundleContents entry={e()} all={all()} />
                    </Card>
                  </Show>

                  <div class="grid gap-6 lg:grid-cols-3">
                    <Card class="p-6 lg:col-span-2">
                      <h2 class="text-lg font-semibold text-white mb-4">Dependency tree</h2>
                      <DependencyTree tree={buildDependencyTree(e(), all())} />
                      <Show when={(e().requires?.length ?? 0) + (e().recommends?.length ?? 0) + (e().bundle?.members.length ?? 0) === 0}>
                        <p class="text-sm text-slate-400 mt-2">No dependencies.</p>
                      </Show>
                      <Show when={dependents(e(), all()).length > 0}>
                        <h3 class="text-sm font-semibold text-white mt-6 mb-1">Used by</h3>
                        <p class="text-xs text-slate-400 mb-2">Packages that depend on or bundle this one. The tag says how.</p>
                        <ul class="space-y-1">
                          <For each={dependents(e(), all())}>
                            {(d) => (
                              <li class="flex items-center gap-2 text-sm">
                                <A href={`/extensions/${d.entry.catalogId}`} class="text-primary-400 hover:text-primary-300" title={rawPackageName(d.entry)}>{displayTitle(d.entry)}</A>
                                <Badge variant={d.relation === 'requires' ? 'warning' : d.relation === 'bundled-in' ? 'primary' : 'muted'} title={d.relation === 'bundled-in' ? `${e().name} is bundled in ${d.entry.name}` : undefined}>{dependentLabel(d.relation)}</Badge>
                                <Show when={d.mutual}>
                                  <Badge variant="muted" title="This package also depends on it, so the two form a cycle">mutual</Badge>
                                </Show>
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                    </Card>

                    <Card class="p-6">
                      <h2 class="text-lg font-semibold text-white mb-4">Details</h2>
                      <dl class="space-y-2 text-sm">
                        <div><dt class="text-slate-500">Author</dt><dd class="text-slate-300">{e().author}</dd></div>
                        <div><dt class="text-slate-500">Updated</dt><dd class="text-slate-300">{new Date(e().lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd></div>
                        <div><dt class="text-slate-500">Stars</dt><dd class="text-slate-300">{e().stars}<Show when={(e().packageCount ?? 0) > 1}> <span class="text-slate-500">(whole repository)</span></Show></dd></div>
                        <Show when={(e().packageCount ?? 0) > 1}>
                          <div><dt class="text-slate-500">Repository</dt><dd class="text-slate-300"><a href={e().repository} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300">{e().repositoryOwner}/{e().repositoryName}</a> <span class="text-slate-500">({e().packageCount} packages; package directory <code class="font-mono">{e().modulePath}</code>)</span></dd></div>
                        </Show>
                        <div>
                          <dt class="text-slate-500">Layer</dt>
                          <dd class="text-slate-300">
                            {e().layers?.length ? e().layers!.map(layerLabel).join(', ') : 'Unclassified'}
                            <Show when={e().layerSource}>{' '}<span class="text-slate-500">({e().layerSource})</span></Show>
                          </dd>
                        </div>
                        <Show when={(e().conflicts?.length ?? 0) > 0}>
                          <div><dt class="text-slate-500">Conflicts</dt><dd class="text-slate-300">{e().conflicts.join(', ')}</dd></div>
                        </Show>
                        <Show when={(e().partials?.provide?.length ?? 0) > 0}>
                          <div><dt class="text-slate-500">Partials</dt><dd class="text-slate-300">{e().partials!.provide!.join(', ')}</dd></div>
                        </Show>
                      </dl>
                      <Show when={e().tags.length > 0}>
                        <div class="mt-4 flex flex-wrap gap-1">
                          <For each={e().tags}>{(t) => <Badge>{t}</Badge>}</For>
                        </div>
                      </Show>
                    </Card>
                  </div>

                  <Card class="p-6 mt-6">
                    <div class="flex items-center justify-between mb-3">
                      <h2 class="text-lg font-semibold text-white">Install</h2>
                      <button type="button" onClick={() => copy(formatInstallSnippet(e()))} class={buttonVariants({ variant: 'soft', size: 'sm' })}>
                        {copied() ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <For each={installGuidance(e())}>{(s) => <p class="text-sm text-slate-300 mb-2 max-w-3xl">{inline(s)}</p>}</For>
                    <pre tabIndex={0} aria-label="Install snippet" class="p-3 bg-code border border-code-border text-code-foreground rounded-lg text-xs overflow-x-auto font-mono whitespace-pre">{formatInstallSnippet(e())}</pre>
                    <a href={INSTALL_GUIDE_URL} target="_blank" rel="noopener noreferrer" class="inline-block mt-3 text-sm font-medium text-primary-400 hover:text-primary-300 hover:underline underline-offset-2">
                      Full installation guide
                    </a>
                  </Card>
                </>
              )}
            </Show>
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
