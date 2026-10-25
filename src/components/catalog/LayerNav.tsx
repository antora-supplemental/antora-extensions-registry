import { createSignal, For, Show } from 'solid-js';
import type { LayerBoxId } from '~/lib/layers';

export interface LayerGroup {
  id: LayerBoxId;
  label: string;
  items: Array<{ catalogId: string; name: string }>;
}

function Box(props: { group: LayerGroup; onPick: (catalogId: string) => void }) {
  const headingId = () => `layer-box-${props.group.id}`;
  return (
    <section aria-labelledby={headingId()} class="rounded-xl border border-slate-700 bg-slate-800/50">
      <h3 id={headingId()} class="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b border-slate-700">
        <span>{props.group.label}</span>
        <span class="text-xs font-medium text-slate-400" aria-label={`${props.group.items.length} results`}>{props.group.items.length}</span>
      </h3>
      <ul class="max-h-44 overflow-y-auto py-1">
        <For each={props.group.items}>
          {(item) => (
            <li>
              <button
                type="button"
                onClick={() => props.onPick(item.catalogId)}
                title={item.name}
                class="block w-full truncate px-3 py-1 text-left text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                {item.name}
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

/** Desktop: a column of per-layer boxes. */
export function LayerColumn(props: { groups: LayerGroup[]; onPick: (catalogId: string) => void }) {
  return (
    <nav aria-label="Results by layer" class="hidden lg:flex flex-col gap-3 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
      <For each={props.groups}>{(g) => <Box group={g} onPick={props.onPick} />}</For>
    </nav>
  );
}

/** Mobile: layers with counts; tap to expand the names. */
export function LayerList(props: { groups: LayerGroup[]; onPick: (catalogId: string) => void }) {
  const [open, setOpen] = createSignal<string | null>(null);
  return (
    <nav aria-label="Results by layer" class="lg:hidden mb-6 rounded-xl border border-slate-700 bg-slate-800/50">
      <For each={props.groups}>
        {(g) => (
          <div class="border-t border-slate-700 first:border-t-0">
            <button
              type="button"
              aria-expanded={open() === g.id}
              aria-controls={`layer-list-${g.id}`}
              onClick={() => setOpen(open() === g.id ? null : g.id)}
              class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white"
            >
              <span>{g.label}</span>
              <span class="flex items-center gap-2 text-slate-400 font-medium">
                {g.items.length}
                <span aria-hidden="true" class={`transition-transform ${open() === g.id ? 'rotate-90' : ''}`}>›</span>
              </span>
            </button>
            <Show when={open() === g.id}>
              <ul id={`layer-list-${g.id}`} class="pb-2">
                <For each={g.items}>
                  {(item) => (
                    <li>
                      <button type="button" onClick={() => props.onPick(item.catalogId)} class="block w-full truncate px-6 py-2 text-left text-sm text-slate-300 hover:text-white">
                        {item.name}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        )}
      </For>
    </nav>
  );
}
