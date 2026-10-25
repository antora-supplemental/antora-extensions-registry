import { A } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { Badge } from '~/components/ui/badge';
import { publishedName } from '~/lib/fork-groups';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

/** "N versions available" notice for an upstream and its listed forks. */
export default function ForkVersions(props: { current: ExtensionCatalogEntry; variants: ExtensionCatalogEntry[] }) {
  const date = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '\u2014');
  return (
    <Show when={props.variants.length > 1}>
      <details class="mt-4 rounded-lg border border-primary-500/40 bg-primary-500/5 p-3" open={!!props.current.forkOf}>
        <summary class="cursor-pointer text-sm font-semibold text-primary-300">
          {props.variants.length} versions available
        </summary>
        <ul class="mt-3 space-y-2 text-sm">
          <For each={props.variants}>
            {(v) => (
              <li class="flex flex-wrap items-center gap-2">
                <Show when={v.catalogId !== props.current.catalogId} fallback={<span class="font-mono text-white">{v.repositoryOwner}</span>}>
                  <A href={`/extensions/${v.catalogId}`} class="font-mono text-primary-400 hover:text-primary-300">{v.repositoryOwner}</A>
                </Show>
                <Badge variant={v.forkOf ? 'muted' : 'primary'}>{v.forkOf ? 'fork' : 'upstream'}</Badge>
                <span class="text-slate-400">last commit {date(v.pushedAt ?? v.lastUpdated)}</span>
                <span class="text-slate-400">{'\u2605'} {v.stars ?? 0}</span>
                <Show when={publishedName(v) && publishedName(v) !== publishedName(props.variants[0])}>
                  <span class="font-mono text-slate-400">npm: {publishedName(v)}</span>
                </Show>
                <Show when={v.forkOf && typeof v.forkOf.aheadBy === 'number'}>
                  <a href={v.forkOf!.compareUrl ?? '#'} target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-slate-200">
                    {v.forkOf!.aheadBy} ahead, {v.forkOf!.behindBy ?? 0} behind {v.forkOf!.source}
                  </a>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </details>
    </Show>
  );
}