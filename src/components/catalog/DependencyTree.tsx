import { A } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { Badge } from '~/components/ui/badge';
import type { DependencyNode } from '~/lib/extension-deps';

function NodeRow(props: { node: DependencyNode }) {
  return (
    <li>
      <div class="flex flex-wrap items-center gap-2 py-1.5">
        <Show when={props.node.relation !== 'root'}>
          <Badge variant={props.node.relation === 'requires' ? 'warning' : 'muted'}>{props.node.relation}</Badge>
        </Show>
        <Show
          when={props.node.entry}
          fallback={<span class="font-mono text-sm text-slate-400">{props.node.id} <span class="text-xs">(not in catalog)</span></span>}
        >
          {(entry) => (
            <Show when={props.node.relation !== 'root'} fallback={<span class="font-semibold text-white">{entry().name}</span>}>
              <A href={`/extensions/${entry().catalogId}`} class="font-medium text-primary-400 hover:text-primary-300">
                {entry().name}
              </A>
            </Show>
          )}
        </Show>
        <Show when={props.node.entry}>
          {(entry) => <span class="font-mono text-xs text-slate-500">v{entry().version}</span>}
        </Show>
        <Show when={props.node.cycle}>
          <span class="text-xs text-amber-400">(cycle)</span>
        </Show>
      </div>
      <Show when={props.node.children.length > 0}>
        <ul class="ml-4 border-l border-slate-700/50 pl-4">
          <For each={props.node.children}>{(child) => <NodeRow node={child} />}</For>
        </ul>
      </Show>
    </li>
  );
}

export default function DependencyTree(props: { tree: DependencyNode }) {
  return (
    <ul aria-label="Dependency tree">
      <NodeRow node={props.tree} />
    </ul>
  );
}
