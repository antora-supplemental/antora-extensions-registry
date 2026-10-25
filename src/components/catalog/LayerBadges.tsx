import { For, Show } from 'solid-js';
import { Badge } from '~/components/ui/badge';
import { layerLabel } from '~/lib/layers';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

const SOURCE_TITLE: Record<string, string> = {
  declared: 'Declared by the repository',
  inferred: 'Guessed by the registry; the repository does not declare a layer',
  admin: 'Set by a registry admin',
};

/** Layer badges; inferred layers say so. */
export default function LayerBadges(props: { entry: Pick<ExtensionCatalogEntry, 'layers' | 'layerSource'>; class?: string }) {
  return (
    <Show when={props.entry.layers?.length}>
      <span class={`inline-flex flex-wrap items-center gap-1 ${props.class ?? ''}`} title={SOURCE_TITLE[props.entry.layerSource ?? 'inferred']}>
        <For each={props.entry.layers}>{(l) => <Badge variant="muted">{layerLabel(l)}</Badge>}</For>
        <Show when={props.entry.layerSource === 'inferred'}>
          <span class="text-xs italic text-slate-400">inferred</span>
        </Show>
      </span>
    </Show>
  );
}
