import { For, Show } from 'solid-js';
import type { CompatLink, StackCoverage } from '~/lib/pkg-compat';
import { encodeStack } from '~/lib/stack';

const BADGE: Record<string, { label: string; cls: string }> = {
  declared: { label: 'Declared', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  curated: { label: 'Curated', cls: 'bg-teal-500/15 text-teal-300 border-teal-500/40' },
  guaranteed: { label: 'Guaranteed', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
  likely: { label: 'Likely (inferred)', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
};

function tip(l: CompatLink): string {
  return [l.why, l.path?.length ? `Chain: ${l.path.join(' -> ')}` : '', l.contracts?.length ? `Contracts: ${l.contracts.join(', ')}` : ''].filter(Boolean).join('\n');
}

function Target(props: { l: CompatLink }) {
  return (
    <Show when={props.l.indexed} fallback={<span class="font-mono text-slate-300">{props.l.targetName}</span>}>
      <a class="text-sky-300 hover:underline" href={`/extensions/${props.l.target}`}>{props.l.targetName}</a>
    </Show>
  );
}

/** "Works with" (declared, then guaranteed, then likely), a smaller "Conflicts with", and an Antora overlap warning. */
const STACK_BADGE: Record<StackCoverage['status'], { label: string; cls: string }> = {
  guaranteed: BADGE.guaranteed,
  declared: BADGE.declared,
  likely: BADGE.likely,
  none: { label: 'Incomplete', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
};

/** The smallest stack whose combined provides cover every contract (or the best partial one), with a /stack share link. */
export function StackGuarantee(props: { stack: StackCoverage }) {
  const ok = () => props.stack.status === 'guaranteed';
  return (
    <div class="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm" data-testid="stack-guarantee" data-stack-status={props.stack.status}>
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold text-white">{ok() ? 'Guaranteed as a stack' : 'Best stack found'}</span>
        <span class={`rounded border px-1.5 py-0.5 text-xs ${STACK_BADGE[props.stack.status].cls}`} title={[props.stack.why, props.stack.covered.length ? `Contracts: ${props.stack.covered.join(', ')}` : ''].filter(Boolean).join('\n')}>{STACK_BADGE[props.stack.status].label}</span>
        <a class="text-xs text-sky-300 hover:underline" href={`/stack?s=${encodeStack(props.stack.members)}`} data-testid="stack-guarantee-link">Open this stack</a>
      </div>
      <p class="mt-1 text-slate-300">
        <For each={props.stack.members}>{(id, i) => <>{i() > 0 ? ' + ' : ''}<a class="text-sky-300 hover:underline" href={`/extensions/${id}`}>{props.stack.memberNames[i()] ?? id}</a></>}</For>
      </p>
      <Show when={props.stack.missing.length}>
        <p class="mt-1 text-xs text-amber-300" data-testid="stack-missing">Missing: {props.stack.missing.join('; ')}</p>
      </Show>
    </div>
  );
}

export function PackageCompat(props: { links?: CompatLink[]; stack?: StackCoverage }) {
  const works = () => (props.links ?? []).filter((l) => l.relation === 'works-with');
  const conflicts = () => (props.links ?? []).filter((l) => l.relation === 'conflicts');
  const mismatch = () => (props.links ?? []).filter((l) => l.relation === 'antora-mismatch');
  const alts = () => (props.links ?? []).filter((l) => l.relation === 'alternative');
  return (
    <Show when={(props.links?.length ?? 0) > 0 || props.stack}>
      <section class="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6" aria-label="Works with" data-testid="works-with">
        <h2 class="text-lg font-semibold text-white mb-1">Works with</h2>
        <p class="text-sm text-slate-400 mb-4">Declared relations first, then contract-guaranteed chains, then inferred ones. Hover a badge for the reasoning.</p>
        <Show when={props.stack}>{(s) => <StackGuarantee stack={s()} />}</Show>
        <Show when={works().length} fallback={<p class="text-sm text-slate-500">No compatible packages declared or inferred yet.</p>}>
          <ul class="space-y-2">
            <For each={works()}>
              {(l) => (
                <li class="flex flex-wrap items-center gap-2 text-sm">
                  <Target l={l} />
                  <span class={`rounded border px-1.5 py-0.5 text-xs ${BADGE[l.confidence].cls}`} title={tip(l)}>{BADGE[l.confidence].label}</span>
                  <span class="text-slate-500 text-xs">{l.why}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={mismatch().length}>
          <div class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" role="note" data-testid="antora-overlap-warning">
            <strong>Antora version warning:</strong> these are related but share no Antora version:{' '}
            <For each={mismatch()}>{(l, i) => <><span title={tip(l)}><Target l={l} /></span>{i() < mismatch().length - 1 ? ', ' : ''}</>}</For>.
          </div>
        </Show>
        <Show when={alts().length}>
          <p class="mt-4 text-xs text-slate-500">
            Alternatives (same layer, use one):{' '}
            <For each={alts().slice(0, 12)}>{(l, i) => <><span title={tip(l)}><Target l={l} /></span>{i() < Math.min(alts().length, 12) - 1 ? ', ' : ''}</>}</For>
            {alts().length > 12 ? ` and ${alts().length - 12} more` : ''}
          </p>
        </Show>
      </section>
      <Show when={conflicts().length}>
        <section class="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4" aria-label="Conflicts with" data-testid="conflicts-with">
          <h3 class="text-sm font-semibold text-rose-200 mb-2">Conflicts with</h3>
          <ul class="space-y-1 text-sm">
            <For each={conflicts()}>{(l) => <li title={tip(l)}><Target l={l} /> <span class="text-xs text-slate-500">{l.why}</span></li>}</For>
          </ul>
        </section>
      </Show>
    </Show>
  );
}
