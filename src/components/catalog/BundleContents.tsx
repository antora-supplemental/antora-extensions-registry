import { A } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { bundleMembers } from '~/lib/bundle-members';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

const chip = 'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-mono';

/** Members of a bundle; indexed members link to their registry pages, others link out (npm or repository) marked "not in registry". */
export default function BundleContents(props: { entry: ExtensionCatalogEntry; all: ExtensionCatalogEntry[]; limit?: number }) {
  const members = () =>
    // Indexed members first so the registry links are on top.
    bundleMembers(props.entry, props.all).sort((a, b) => Number(Boolean(b.entry)) - Number(Boolean(a.entry)) || a.name.localeCompare(b.name));
  const shown = () => (props.limit ? members().slice(0, props.limit) : members());
  return (
    <Show when={props.entry.bundle}>
      <ul class="flex flex-wrap gap-1.5" aria-label="Bundle contents">
        <For each={shown()}>
          {(m) => (
            <li>
              <Show
                when={m.entry}
                fallback={
                  <a
                    href={m.external!.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class={`${chip} border-dashed border-slate-700 text-slate-300 hover:text-white hover:border-slate-500`}
                    title={`Not in this registry. Opens ${m.external!.kind === 'npm' ? 'npm' : m.external!.kind === 'repo' ? 'the repository' : 'a GitHub search'} in a new tab.`}
                  >
                    {m.name}
                    <span class="font-sans text-[10px] text-slate-500">not in registry {m.external!.kind === 'npm' ? '\u00b7 npm' : '\u00b7 GitHub'} {'\u2197'}</span>
                  </a>
                }
              >
                <A href={`/extensions/${m.entry!.catalogId}`} class={`${chip} border-slate-700 text-primary-400 hover:text-primary-300 hover:border-primary-600`}>
                  {m.name}
                </A>
              </Show>
            </li>
          )}
        </For>
        <Show when={props.limit && members().length > props.limit}>
          <li class="text-xs text-slate-400 self-center">+{members().length - props.limit!} more</li>
        </Show>
      </ul>
    </Show>
  );
}