import { A, Navigate, createAsync, useParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { createMemo, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import NewBadge from '~/components/catalog/NewBadge';
import ReportButton from '~/components/catalog/ReportButton';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { THEME_APPEARANCE_LABELS } from '~/lib/appearance-filter';
import { loadExtensionCatalog, loadThemes } from '~/lib/server/catalog';
import { themeRepoPath } from '~/lib/theme-href';

/** Theme detail page. When the theme's repo is also a catalog package, the package page is the detail page. */
export default function ThemeDetailPage() {
  const params = useParams();
  const key = () => `${params.owner}/${params.repo}`.toLowerCase();
  const themes = createAsync(() => loadThemes());
  const catalog = createAsync(() => loadExtensionCatalog());
  const pkg = createMemo(() => {
    const c = catalog();
    if (!c) return undefined;
    return [...c.modules, ...c.recipes].find((e) => `${e.repositoryOwner}/${e.repositoryName}`.toLowerCase() === key());
  });
  const theme = createMemo(() => themes()?.find((t) => themeRepoPath(t)?.toLowerCase() === key()));

  return (
    <SiteLayout title="Themes">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <A href="/themes" class="text-sm text-primary-400 hover:text-primary-300">&larr; All themes</A>
        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading theme…</div>}>
          <Show when={themes() && catalog()}>
            <Show when={pkg()} fallback={
              <Show when={theme()} fallback={
                <div class="py-16 text-center">
                  <h1 class="text-2xl font-bold text-white mb-2">Theme not found</h1>
                  <p class="text-slate-400">No theme is listed for <code class="font-mono">{key()}</code>.</p>
                </div>
              }>
                {(t) => (
                  <article class="mt-6">
                    <Title>{`${t().name} · Antora theme`}</Title>
                    <h1 class="text-3xl font-bold text-white capitalize mb-2">
                      {t().name} <NewBadge firstListedAt={t().firstListedAt} class="ml-2 align-middle normal-case" />
                    </h1>
                    <p class="text-slate-400 mb-4">by {t().author} · ★ {t().stars}</p>
                    <img src={t().previewImage} alt={`Preview of ${t().name}`} class="w-full rounded-xl border border-slate-700/50 mb-6" />
                    <p class="text-slate-300 mb-4">{t().description}</p>
                    <Show when={t().appearance}>{(a) => <p class="text-sm text-slate-400 mb-4">{THEME_APPEARANCE_LABELS[a()]}</p>}</Show>
                    <div class="flex flex-wrap gap-2 mb-6">{t().tags.filter((x) => x !== 'theme').map((x) => <Badge>{x}</Badge>)}</div>
                    <div class="flex gap-3 items-center">
                      <a href={t().demoUrl} target="_blank" rel="noopener noreferrer" class={cn(buttonVariants())}>Live Demo</a>
                      <a href={t().repoUrl} target="_blank" rel="noopener noreferrer" class={buttonVariants({ variant: 'secondary' })}>Repository</a>
                      <ReportButton itemKind="theme" itemId={t().id} itemName={t().name} />
                    </div>
                  </article>
                )}
              </Show>
            }>
              {(e) => <Navigate href={`/extensions/${e().catalogId}`} />}
            </Show>
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}
