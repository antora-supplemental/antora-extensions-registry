import { A } from '@solidjs/router';
import { For, Show } from 'solid-js';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

/** Members of a bundle; indexed members link to their registry pages. */
export default function BundleContents(props: { entry: ExtensionCatalogEntry; all: ExtensionCatalogEntry[]; limit?: number }) {
  const members = () => {
    const byName = new Map(props.all.map((e) => [e.name.toLowerCase(), e]));
    const list = (props.entry.bundle?.members ?? []).map((m) => ({ name: m, entry: byName.get(m.toLowerCase()) }));
    // Indexed members first so the useful links are on top.
    return list.sort((a, b) => Number(Boolean(b.entry)) - Number(Boolean(a.entry)) || a.name.localeCompare(b.name));
  };
  const shown = () => (props.limit ? members().slice(0, props.limit) : members());
  return (
    <Show when={props.entry.bundle}>
      <ul class="flex flex-wrap gap-1.5" aria-label="Bundle contents">
        <For each={shown()}>
          {(m) => (
            <li>
              <Show
                when={m.entry}
                fallback={<span class="inline-block rounded-md border border-slate-700 px-2 py-0.5 text-xs font-mono text-slate-400">{m.name}</span>}
              >
                <A href={`/extensions/${m.entry!.catalogId}`} class="inline-block rounded-md border border-slate-700 px-2 py-0.5 text-xs font-mono text-primary-400 hover:text-primary-300 hover:border-primary-600">
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
