import { A, createAsync, useSearchParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import { buttonVariants } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { loadExtensionCatalog } from '~/lib/server/catalog';
import { analyzeStack, decodeStack, encodeStack, stackPlaybook, type StackIssue } from '~/lib/stack';
import { addToStack, clearStack, removeFromStack, replaceStack, stackPicks } from '~/lib/stack-store';
import type { ExtensionCatalogEntry } from '~/types/ui-module';
import type { StackCoverage } from '~/lib/pkg-compat';

const STATUS: Record<StackCoverage['status'], { label: string; cls: string; text: string }> = {
  guaranteed: { label: 'Guaranteed', cls: 'border-sky-500/40 bg-sky-500/15 text-sky-300', text: 'The picks together provide every contract they use, at satisfied versions.' },
  declared: { label: 'Declared', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300', text: 'Declared relations tie the picks together, but contract coverage is incomplete.' },
  likely: { label: 'Likely (inferred)', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', text: 'Some contracts are covered; others are missing.' },
  none: { label: 'Incomplete', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300', text: 'No contract coverage or relations tie these picks together.' },
};

const ISSUE: Record<StackIssue['kind'], { label: string; cls: string }> = {
  conflict: { label: 'Conflict', cls: 'border-red-500/40 bg-red-500/10 text-red-300' },
  missing: { label: 'Missing requirement', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  contract: { label: 'Missing contract', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  antora: { label: 'Antora version', cls: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  alternative: { label: 'Alternatives', cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
};

export const route = { preload: () => loadExtensionCatalog() };

export default function StackPage() {
  const data = createAsync(() => loadExtensionCatalog());
  const [params] = useSearchParams();
  const [ready, setReady] = createSignal(false);
  const [copied, setCopied] = createSignal<'' | 'yaml' | 'link'>('');
  onMount(() => setReady(true));

  const shared = () => decodeStack(typeof params.s === 'string' ? params.s : undefined);
  const viewingShared = () => shared().length > 0;
  const ids = () => (viewingShared() ? shared() : ready() ? stackPicks() : []);
  const all = createMemo<ExtensionCatalogEntry[]>(() => [...(data()?.modules ?? []), ...(data()?.recipes ?? [])]);
  const picks = createMemo(() => {
    const byId = new Map(all().map((e) => [e.catalogId, e]));
    return ids().map((id) => byId.get(id)).filter((e): e is ExtensionCatalogEntry => !!e);
  });
  const unknown = () => ids().filter((id) => !all().some((e) => e.catalogId === id));
  const result = createMemo(() => analyzeStack(picks(), all()));
  const yaml = createMemo(() => stackPlaybook(picks()));
  const shareUrl = () => (typeof window === 'undefined' ? '' : `${window.location.origin}/stack?s=${encodeStack(ids())}`);

  const copy = async (what: 'yaml' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'yaml' ? yaml() : shareUrl());
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <SiteLayout>
      <Title>Your stack | Antora Registry</Title>
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-stack-page>
        <h1 class="text-3xl font-bold text-white mb-2">{viewingShared() ? 'Shared stack' : 'Your stack'}</h1>
        <p class="text-slate-400 mb-8 max-w-3xl">Pick extensions with <strong class="text-slate-300">Add to stack</strong>; the registry checks them against each other and writes the playbook. Your picks stay in this browser.</p>

        <Show when={viewingShared()}>
          <div class="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-slate-300">
            Someone shared this stack with you.
            <button type="button" class={buttonVariants({ variant: 'default', size: 'sm' })} onClick={() => replaceStack(typeof params.s === 'string' ? params.s : '')}>Use as my stack</button>
            <button type="button" class={buttonVariants({ variant: 'soft', size: 'sm' })} onClick={() => addToStack(shared())}>Add to my stack</button>
          </div>
        </Show>

        <Show
          when={ids().length}
          fallback={
            <div class="rounded-xl border border-slate-700/60 bg-slate-800/30 p-8 text-center">
              <p class="text-slate-300 mb-4">Your stack is empty.</p>
              <A href="/browse" class={buttonVariants({ variant: 'default', size: 'sm' })}>Browse extensions</A>
            </div>
          }
        >
          <section class="mb-8" aria-labelledby="picks-h">
            <div class="flex items-center justify-between mb-3">
              <h2 id="picks-h" class="text-lg font-semibold text-white">Picks <span class="text-slate-500 font-normal">({picks().length})</span></h2>
              <div class="flex gap-2">
                <button type="button" data-stack-share class={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => copy('link')}>{copied() === 'link' ? 'Link copied' : 'Copy share link'}</button>
                <Show when={!viewingShared()}>
                  <button type="button" class={buttonVariants({ variant: 'soft', size: 'sm' })} onClick={() => clearStack()}>Clear</button>
                </Show>
              </div>
            </div>
            <ul class="divide-y divide-slate-700/50 rounded-xl border border-slate-700/60 bg-slate-800/30">
              <For each={picks()}>
                {(e) => (
                  <li class="flex flex-wrap items-center gap-3 px-4 py-3" data-stack-pick={e.catalogId}>
                    <A href={`/extensions/${e.catalogId}`} class="font-medium text-primary-400 hover:text-primary-300">{e.title ?? e.name}</A>
                    <Badge variant="muted">{e.type}</Badge>
                    <span class="text-slate-500 text-xs font-mono">v{e.version}</span>
                    <span class="text-slate-400 text-sm truncate flex-1 min-w-[12rem]">{e.description}</span>
                    <Show when={!viewingShared()}>
                      <button type="button" class="text-xs text-slate-400 hover:text-red-300" onClick={() => removeFromStack(e.catalogId)} aria-label={`Remove ${e.title ?? e.name}`}>Remove</button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
            <Show when={data() && unknown().length}>
              <p class="mt-2 text-xs text-slate-500">No longer listed: {unknown().join(', ')}</p>
            </Show>
          </section>

          <section class="mb-8" aria-labelledby="check-h" data-stack-check>
            <h2 id="check-h" class="text-lg font-semibold text-white mb-1">Compatibility</h2>
            <p class="text-sm text-slate-400 mb-3">
              Every pair checked with the same engine as <em>Works with</em> on each page.
              <Show when={result().antora?.length}> Fits Antora {result().antora!.join(', ')}.</Show>
            </p>
            <div class="mb-3 flex flex-wrap items-center gap-2 text-sm" data-stack-status={result().coverage.status}>
              <span class={`rounded border px-1.5 py-0.5 text-xs ${STATUS[result().coverage.status].cls}`} title={result().coverage.covered.length ? `Contracts: ${result().coverage.covered.join(', ')}` : undefined}>Stack: {STATUS[result().coverage.status].label}</span>
              <span class="text-slate-400">{STATUS[result().coverage.status].text}</span>
              <Show when={result().coverage.missing.length}>
                <span class="w-full text-xs text-amber-300" data-stack-missing>Missing: {result().coverage.missing.join('; ')}</span>
              </Show>
            </div>
            <Show when={result().issues.length} fallback={<p class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300" data-stack-ok>No conflicts, missing requirements or Antora mismatches found.</p>}>
              <ul class="space-y-2">
                <For each={result().issues}>
                  {(i) => (
                    <li class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/30 p-3 text-sm" data-stack-issue={i.kind}>
                      <span class={`rounded border px-1.5 py-0.5 text-xs ${ISSUE[i.kind].cls}`}>{ISSUE[i.kind].label}</span>
                      <span class="text-slate-300 flex-1 min-w-[12rem]">{i.message}</span>
                      <Show when={(i.kind === 'missing' || i.kind === 'contract') && i.suggest && !viewingShared()}>
                        <button type="button" class={buttonVariants({ variant: 'soft', size: 'sm' })} onClick={() => addToStack([i.suggest!.catalogId])}>Add {i.suggest!.title ?? i.suggest!.name}</button>
                      </Show>
                      <Show when={(i.kind === 'missing' || i.kind === 'contract') && !i.suggest}>
                        <span class="text-xs text-slate-500">not in the registry; install it yourself</span>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>

          <section aria-labelledby="yaml-h">
            <div class="flex items-center justify-between mb-2">
              <h2 id="yaml-h" class="text-lg font-semibold text-white">antora-playbook.yml</h2>
              <button type="button" class={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => copy('yaml')}>{copied() === 'yaml' ? 'Copied' : 'Copy'}</button>
            </div>
            <p class="text-sm text-slate-400 mb-2">Merge into your playbook; keep your own <code class="font-mono">site</code> and <code class="font-mono">content</code> keys.</p>
            <pre tabIndex={0} aria-label="Playbook snippet" class="p-4 bg-code border border-code-border text-code-foreground rounded-lg text-sm overflow-x-auto font-mono whitespace-pre" data-stack-yaml>{yaml()}</pre>
          </section>
        </Show>
      </div>
    </SiteLayout>
  );
}
