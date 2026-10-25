import { A, createAsync, useParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { createMemo, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import ExtensionCard from '~/components/catalog/ExtensionCard';
import ProviderIcon from '~/components/icons/ProviderIcon';
import { loadExtensionCatalog } from '~/lib/server/catalog';
import { entriesByOwner } from '~/lib/owner-paths';

/** /owners/<host>/<login>: every extension from one user or organization (GitLab group paths may contain slashes). */
export default function OwnerPage() {
  const params = useParams();
  const catalog = createAsync(() => loadExtensionCatalog());
  const parts = () => String(params.path ?? '').split('/').filter(Boolean);
  const host = () => (parts()[0] ?? 'github.com').toLowerCase();
  const login = () => parts().slice(1).join('/');
  const entries = createMemo(() => {
    const c = catalog();
    return c ? entriesByOwner([...c.modules, ...c.recipes], host(), login()) : [];
  });
  const info = () => entries()[0]?.owner;
  const forge = () => (host() === 'github.com' ? 'GitHub' : 'GitLab');

  return (
    <SiteLayout title="Extensions">
      <Title>{`${login()} - Antora Registry`}</Title>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <A href="/extensions" class="text-sm text-primary-400 hover:text-primary-300">&larr; All extensions</A>
        <Suspense fallback={<div class="py-16 text-center text-slate-400">Loading{'\u2026'}</div>}>
          <header class="mt-6 mb-8 flex items-center gap-4">
            <Show when={info()?.avatar}>
              <img src={info()!.avatar} alt="" width="48" height="48" class="h-12 w-12 rounded-full bg-slate-700" />
            </Show>
            <div class="min-w-0">
              <h1 class="text-2xl font-bold text-white break-words">{info()?.displayName ?? login()}</h1>
              <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span>{login()}</span>
                <span aria-hidden="true">{'\u00b7'}</span>
                <span>{info()?.type === 'org' ? 'Organization' : 'User'}</span>
                <span aria-hidden="true">{'\u00b7'}</span>
                <span>{entries().length} {entries().length === 1 ? 'extension' : 'extensions'}</span>
                <a href={info()?.profileUrl ?? `https://${host()}/${login()}`} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300">
                  <ProviderIcon provider={host() === 'github.com' ? 'github' : 'gitlab'} class="h-4 w-4" />
                  {forge()} profile <span class="sr-only">(opens in a new tab)</span>
                </a>
              </p>
            </div>
          </header>
          <Show when={entries().length} fallback={<p class="py-16 text-center text-slate-400">No extensions from this owner are listed.</p>}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <For each={entries()}>{(e) => <ExtensionCard entry={e} />}</For>
            </div>
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}