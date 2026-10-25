import type { AdminReport } from '~/lib/server/reports';
import { A, createAsync, revalidate } from '@solidjs/router';
import { createSignal, For, Show, Suspense } from 'solid-js';
import SiteLayout from '~/components/SiteLayout';
import { buttonVariants } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { getSessionData } from '~/app';
import { ANTORA_TOPICS } from '~/data/github-topics';
import { addCatalogPreview, addTrusted, loadAdminData, removeCatalogPreview, removeTrusted, reviewQueueItem, setCatalogOverride, setFeatured, type AdminData, type AdminQueueItem } from '~/lib/server/admin';
import { loadExtensionCatalog } from '~/lib/server/catalog';
import { LAYERS, layerLabel } from '~/lib/layers';
import { closeReport } from '~/lib/server/reports';
import { REPORT_REASONS } from '~/lib/report-reasons';

const endpoints = [
  { method: 'GET', path: '/api/extensions/catalog', note: 'Full extension catalog (add ?topics=false to skip topic discovery)' },
  { method: 'GET', path: '/api/extensions/topics', note: 'Topic schema and tagging rules' },
  { method: 'GET', path: '/api/extensions/discover?repoUrl=https://github.com/antora-supplemental/valentus-theme', note: 'Read the manifests of one repository' },
  { method: 'POST', path: '/api/extensions/submit', note: 'Submit an extension repository (sign-in required)' },
  { method: 'POST', path: '/api/themes/validate', note: 'Check a theme repository' },
  { method: 'POST', path: '/api/themes/submit', note: 'Submit a theme (sign-in required)' },
  { method: 'POST', path: '/api/admin/discover', note: 'Run GitHub topic discovery now and import repos that pass (admin only)' },
];

interface DiscoveryResult {
  ranAt: string;
  imported: number;
  results: Array<{ kind: string; owner: string; repo: string; repoUrl: string; outcome: string; approvedVia?: string; failures: string[] }>;
  error?: string;
}

const field = 'px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm';
const refresh = () => revalidate([loadAdminData.key, loadExtensionCatalog.key]);
const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;

function QueueRow(props: { item: AdminQueueItem }) {
  const [reason, setReason] = createSignal('');
  const [rejecting, setRejecting] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [result, setResult] = createSignal<{ ok: boolean; message: string } | null>(null);
  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const r = await reviewQueueItem({ kind: props.item.kind, id: props.item.id, decision, reason: reason() });
      setResult(r);
      if (r.ok) setTimeout(refresh, 1500);
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'Failed' });
    }
    setBusy(false);
  };
  return (
    <li class="py-3 space-y-2">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="text-xs uppercase tracking-wide text-slate-500 w-20">{props.item.kind}</span>
        <a href={props.item.repoUrl} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 font-medium">{props.item.name}</a>
        <span class="text-slate-400">{props.item.detail}</span>
        <span class="text-slate-500 ml-auto">{fmt(props.item.submittedAt)}</span>
      </div>
      <Show
        when={!result()?.ok}
        fallback={<p role="status" class="text-sm text-emerald-400">{result()!.message}</p>}
      >
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy()} onClick={() => decide('approve')} class={buttonVariants({ size: 'sm' })}>Approve</button>
          <Show
            when={rejecting()}
            fallback={<button type="button" disabled={busy()} onClick={() => setRejecting(true)} class={buttonVariants({ variant: 'outline', size: 'sm' })}>Reject…</button>}
          >
            <input aria-label="Reason for rejecting (optional)" placeholder="Reason (optional)" maxLength={500} value={reason()} onInput={(e) => setReason(e.currentTarget.value)} class={`${field} flex-1 min-w-48`} />
            <button type="button" disabled={busy()} onClick={() => decide('reject')} class={buttonVariants({ variant: 'outline', size: 'sm' })}>Confirm reject</button>
            <button type="button" onClick={() => setRejecting(false)} class={buttonVariants({ variant: 'ghost', size: 'sm' })}>Cancel</button>
          </Show>
        </div>
        <Show when={result() && !result()!.ok}>
          <p role="alert" class="text-sm text-red-400">{result()!.message}</p>
        </Show>
      </Show>
    </li>
  );
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'never';

export default function AdminPage() {
  const session = createAsync(() => getSessionData());
  const data = createAsync(() => loadAdminData());
  const [running, setRunning] = createSignal(false);
  const [discovery, setDiscovery] = createSignal<DiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = createSignal<string | null>(null);

  const runDiscovery = async () => {
    setRunning(true);
    setDiscoveryError(null);
    try {
      const res = await fetch('/api/admin/discover', { method: 'POST' });
      const body = (await res.json()) as DiscoveryResult;
      if (!res.ok) setDiscoveryError(body.error ?? `Discovery failed (${res.status})`);
      else {
        setDiscovery(body);
        if (body.imported > 0) refresh();
      }
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : 'Discovery failed');
    }
    setRunning(false);
  };

  return (
    <SiteLayout title="Admin">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading…</div>}>
          <Show
            when={data()}
            fallback={
              <div class="py-16 text-center">
                <h1 class="text-2xl font-bold text-white mb-2">Admins only</h1>
                <Show
                  when={session()?.user}
                  fallback={
                    <p class="text-slate-400">
                      <A href="/auth/signin?redirect=/admin" class="text-primary-400 hover:text-primary-300">Sign in</A> with an admin GitHub account to see this page.
                    </p>
                  }
                >
                  <p class="text-slate-400">Your account doesn't have admin access.</p>
                </Show>
              </div>
            }
          >
            {(d) => (
              <div class="space-y-6">
                <h1 class="text-3xl lg:text-4xl font-bold text-white">Admin</h1>

                <Show when={d().loadErrors.length > 0}>
                  <Card class="p-6 border-amber-500/50">
                    <h2 class="text-lg font-semibold text-white mb-3">Load errors</h2>
                    <ul class="space-y-1 text-sm text-amber-300 font-mono break-all">
                      <For each={d().loadErrors}>{(e) => <li>{e}</li>}</For>
                    </ul>
                  </Card>
                </Show>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Review queue ({d().queue.length})</h2>
                  <Show when={d().queue.length > 0} fallback={<p class="text-sm text-slate-400">Nothing waiting for review.</p>}>
                    <ul class="divide-y divide-slate-700/50 text-sm">
                      <For each={d().queue}>{(item) => <QueueRow item={item} />}</For>
                    </ul>
                  </Show>
                </Card>

                <ReportsCard reports={d().reports} />
                <TrustedCard trusted={d().trusted} />
                <MetadataCard rows={d().metadata} previews={d().previews} featured={d().featured} />

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Recent automatic approvals</h2>
                  <Show when={d().recentApprovals.length > 0} fallback={<p class="text-sm text-slate-400">None yet.</p>}>
                    <ul class="divide-y divide-slate-700/50 text-sm">
                      <For each={d().recentApprovals}>
                        {(a) => (
                          <li class="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span class="text-xs uppercase tracking-wide text-slate-500 w-20">{a.kind}</span>
                            <a href={a.repoUrl} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 font-medium">{a.name}</a>
                            <span class="text-slate-400">{a.approvedVia}</span>
                            <span class="text-slate-500 ml-auto">{fmt(a.at)}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </Card>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Catalog sync</h2>
                  <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div><dt class="text-slate-500">Source</dt><dd class="text-slate-300">{d().catalogSource}</dd></div>
                    <div><dt class="text-slate-500">Last sync</dt><dd class="text-slate-300">{fmt(d().syncedAt)}</dd></div>
                    <div><dt class="text-slate-500">Indexed repositories</dt><dd class="text-slate-300">{d().indexedRepos.length}</dd></div>
                  </dl>
                  <p class="text-sm text-slate-400 mt-4">
                    The sync workflow runs once a day (09:00 UTC). UI modules are indexed from{' '}
                    <code class="text-primary-300">ui-modules/registry.json5</code> manifests.
                  </p>
                </Card>

                <Card class="p-6">
                  <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 class="text-lg font-semibold text-white">GitHub topic discovery</h2>
                    <button type="button" onClick={runDiscovery} disabled={running()} class={buttonVariants({ size: 'sm' })}>
                      {running() ? 'Running…' : 'Run discovery'}
                    </button>
                  </div>
                  <p class="text-sm text-slate-400 mb-3">
                    Repos tagged <code class="text-primary-300">{ANTORA_TOPICS.EXTENSION}</code> or{' '}
                    <code class="text-primary-300">{ANTORA_TOPICS.THEME}</code> are discovered automatically.{' '}
                    {d().discoveredRepoCount} {d().discoveredRepoCount === 1 ? 'repository was' : 'repositories were'} found this way beyond the curated list.
                  </p>
                  <Show when={d().discoveredRepos.length > 0}>
                    <ul class="flex flex-wrap gap-2 text-sm mb-3">
                      <For each={d().discoveredRepos}>
                        {(r) => (
                          <li><a href={`https://github.com/${r.owner}/${r.repo}`} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300">{r.owner}/{r.repo}</a></li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={discoveryError()}>
                    <p class="text-sm text-red-400">{discoveryError()}</p>
                  </Show>
                  <Show when={discovery()}>
                    {(r) => (
                      <div class="text-sm text-slate-300 space-y-2 border-t border-slate-700/50 pt-3">
                        <p class="text-slate-400">Ran {fmt(r().ranAt)}: checked {r().results.length} new {r().results.length === 1 ? 'repository' : 'repositories'}, imported {r().imported}.</p>
                        <ul class="space-y-2">
                          <For each={r().results}>
                            {(x) => (
                              <li>
                                <span class="text-xs uppercase text-slate-500 mr-2">{x.kind}</span>
                                <a href={x.repoUrl} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300">{x.owner}/{x.repo}</a>
                                <span class="ml-2 text-slate-400">{x.outcome}</span>
                                <Show when={x.approvedVia}><span class="block text-xs text-emerald-400">{x.approvedVia}</span></Show>
                                <Show when={x.failures.length > 0}><span class="block text-xs text-amber-300">Failed: {x.failures.join('; ')}</span></Show>
                              </li>
                            )}
                          </For>
                        </ul>
                      </div>
                    )}
                  </Show>
                </Card>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">Manifest paths ({d().manifests.length})</h2>
                  <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="text-left text-slate-500"><th class="py-1 pr-4 font-medium">ID</th><th class="py-1 font-medium">Manifest</th></tr>
                      </thead>
                      <tbody>
                        <For each={d().manifests}>
                          {(m) => (
                            <tr class="border-t border-slate-700/30">
                              <td class="py-1 pr-4"><A href={`/extensions/${m.catalogId}`} class="font-mono text-primary-400 hover:text-primary-300">{m.catalogId}</A></td>
                              <td class="py-1 font-mono text-slate-300 break-all">{m.manifestPath}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card class="p-6">
                  <h2 class="text-lg font-semibold text-white mb-3">API endpoints</h2>
                  <ul class="space-y-2 text-sm">
                    <For each={endpoints}>
                      {(ep) => (
                        <li>
                          <span class="font-mono text-xs text-slate-500 mr-2">{ep.method}</span>
                          <Show when={ep.method === 'GET'} fallback={<code class="text-primary-300 break-all">{ep.path}</code>}>
                            <a href={ep.path} class="font-mono text-primary-400 hover:text-primary-300 break-all">{ep.path}</a>
                          </Show>
                          <span class="block text-slate-400">{ep.note}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Card>
              </div>
            )}
          </Show>
        </Suspense>
      </div>
    </SiteLayout>
  );
}

function ReportsCard(props: { reports: AdminReport[] }) {
  const [msg, setMsg] = createSignal<{ ok: boolean; message: string } | null>(null);
  const close = async (id: string, status: 'resolved' | 'dismissed') => {
    const r = await closeReport(id, status).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : 'Failed' }));
    setMsg(r);
    if (r.ok) refresh();
  };
  return (
    <Card class="p-6" id="reports">
      <h2 class="text-lg font-semibold text-white mb-3">Reports ({props.reports.length})</h2>
      <Show when={msg()}>{(m) => <p role="status" class={`text-sm mb-2 ${m().ok ? 'text-emerald-400' : 'text-red-400'}`}>{m().message}</p>}</Show>
      <Show when={props.reports.length > 0} fallback={<p class="text-sm text-slate-400">No open reports.</p>}>
        <ul class="divide-y divide-slate-700/50 text-sm">
          <For each={props.reports}>
            {(r) => (
              <li class="py-3 space-y-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-xs uppercase tracking-wide text-slate-500 w-20">{r.itemKind}</span>
                  <Show when={r.itemKind === 'extension'} fallback={<a href={`https://github.com/${r.itemId}`} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 font-medium">{r.itemName}</a>}>
                    <A href={`/extensions/${r.itemId}`} class="text-primary-400 hover:text-primary-300 font-medium">{r.itemName}</A>
                  </Show>
                  <span class="text-amber-300">{reasonLabel(r.reason)}</span>
                  <span class="text-slate-500 ml-auto">{r.reporter} · {fmt(r.createdAt)}</span>
                </div>
                <Show when={r.message}><p class="text-slate-300 whitespace-pre-wrap break-words">{r.message}</p></Show>
                <div class="flex gap-2 pt-1">
                  <button type="button" onClick={() => close(r.id, 'resolved')} class={buttonVariants({ size: 'sm' })}>Resolve</button>
                  <button type="button" onClick={() => close(r.id, 'dismissed')} class={buttonVariants({ variant: 'outline', size: 'sm' })}>Dismiss</button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Card>
  );
}

const TRUSTED_KIND_LABELS: Record<string, string> = {
  github_org: 'GitHub org',
  github_user: 'GitHub user',
  gitlab_group: 'GitLab group',
  gitlab_user: 'GitLab user',
};

function TrustedCard(props: { trusted: Array<{ id: string; kind: string; name: string; note: string | null; addedBy: string | null }> }) {
  const [kind, setKind] = createSignal('github_org');
  const [name, setName] = createSignal('');
  const [note, setNote] = createSignal('');
  const [msg, setMsg] = createSignal<{ ok: boolean; message: string } | null>(null);
  const act = async (p: Promise<{ ok: boolean; message: string }>) => {
    const r = await p.catch((e) => ({ ok: false, message: e instanceof Error ? e.message : 'Failed' }));
    setMsg(r);
    if (r.ok) refresh();
    return r.ok;
  };
  const add = async (e: Event) => {
    e.preventDefault();
    if (await act(addTrusted({ kind: kind(), name: name(), note: note() }))) {
      setName('');
      setNote('');
    }
  };
  return (
    <Card class="p-6">
      <h2 class="text-lg font-semibold text-white mb-1">Trusted publishers</h2>
      <p class="text-sm text-slate-400 mb-3">Submissions from these owners, or from people who belong to them, skip the review queue.</p>
      <ul class="divide-y divide-slate-700/50 text-sm mb-4">
        <For each={props.trusted} fallback={<li class="py-2 text-slate-400">None.</li>}>
          {(t) => (
            <li class="py-2 flex flex-wrap items-center gap-x-3">
              <span class="text-xs uppercase tracking-wide text-slate-500 w-28">{TRUSTED_KIND_LABELS[t.kind] ?? t.kind}</span>
              <span class="text-white font-medium">{t.name}</span>
              <Show when={t.note}><span class="text-slate-400">{t.note}</span></Show>
              <button type="button" onClick={() => act(removeTrusted(t.id))} class={`${buttonVariants({ variant: 'ghost', size: 'sm' })} ml-auto`}>Remove</button>
            </li>
          )}
        </For>
      </ul>
      <form onSubmit={add} class="flex flex-wrap items-center gap-2">
        <select aria-label="Publisher type" value={kind()} onChange={(e) => setKind(e.currentTarget.value)} class={field}>
          <For each={Object.entries(TRUSTED_KIND_LABELS)}>{([v, l]) => <option value={v}>{l}</option>}</For>
        </select>
        <input aria-label="Name" required placeholder="Name" value={name()} onInput={(e) => setName(e.currentTarget.value)} class={field} />
        <input aria-label="Note (optional)" placeholder="Note (optional)" value={note()} onInput={(e) => setNote(e.currentTarget.value)} class={`${field} flex-1 min-w-40`} />
        <button type="submit" class={buttonVariants({ size: 'sm' })}>Add</button>
      </form>
      <Show when={msg()}>{(m) => <p role="status" class={`text-sm mt-2 ${m().ok ? 'text-emerald-400' : 'text-red-400'}`}>{m().message}</p>}</Show>
    </Card>
  );
}

/** Layer / bundle overrides, preview images, and the home-page featured slot. */
function MetadataCard(props: { rows: AdminData['metadata']; previews: AdminData['previews']; featured: string[] }) {
  const [selected, setSelected] = createSignal('');
  const [layers, setLayers] = createSignal<string[] | null>(null);
  const [bundle, setBundle] = createSignal('');
  const [bundleMode, setBundleMode] = createSignal<'keep' | 'set' | 'none'>('keep');
  const [previewUrl, setPreviewUrl] = createSignal('');
  const [caption, setCaption] = createSignal('');
  const [featured, setFeaturedDraft] = createSignal(props.featured.join('\n'));
  const [msg, setMsg] = createSignal<{ ok: boolean; message: string } | null>(null);
  const row = () => props.rows.find((r) => r.catalogId === selected());
  const act = async (p: Promise<{ ok: boolean; message: string }>) => {
    const r = await p.catch((e) => ({ ok: false, message: e instanceof Error ? e.message : 'Failed' }));
    setMsg(r);
    if (r.ok) refresh();
    return r.ok;
  };
  const pick = (id: string) => {
    setSelected(id);
    const r = props.rows.find((x) => x.catalogId === id);
    setLayers(r?.overridden.layers ? [...r.layers] : null);
    setBundleMode(r?.overridden.bundle ? (r.bundleMembers?.length ? 'set' : 'none') : 'keep');
    setBundle((r?.bundleMembers ?? []).join('\n'));
  };
  const toggleLayer = (id: string) => {
    const cur = layers() ?? [...(row()?.layers ?? [])];
    setLayers(cur.includes(id) ? cur.filter((l) => l !== id) : [...cur, id]);
  };
  const save = (e: Event) => {
    e.preventDefault();
    const members = bundleMode() === 'keep' ? null : bundleMode() === 'none' ? [] : bundle().split(/[\s,]+/).filter(Boolean);
    act(setCatalogOverride({ catalogId: selected(), layers: layers(), bundleMembers: members }));
  };
  const addPreview = async (e: Event) => {
    e.preventDefault();
    if (await act(addCatalogPreview({ catalogId: selected(), url: previewUrl(), caption: caption() }))) {
      setPreviewUrl('');
      setCaption('');
    }
  };
  return (
    <Card class="p-6">
      <h2 class="text-lg font-semibold text-white mb-1">Catalog metadata</h2>
      <p class="text-sm text-slate-400 mb-4">Override an entry's layers or bundle contents, add preview images, and choose what the home page features. Overrides beat what the sync declared or inferred.</p>

      <form onSubmit={(e) => { e.preventDefault(); act(setFeatured(featured().split(/[\s,]+/))); }} class="mb-6">
        <label for="featured-ids" class="block text-sm font-semibold text-white mb-1">Featured on the home page</label>
        <p class="text-xs text-slate-400 mb-2">Up to 3 catalog ids, one per line. Leave empty to use the default (facto-stack).</p>
        <div class="flex flex-wrap gap-2 items-start">
          <textarea id="featured-ids" rows={2} value={featured()} onInput={(e) => setFeaturedDraft(e.currentTarget.value)} class={`${field} flex-1 min-w-64 font-mono`} />
          <button type="submit" class={buttonVariants({ size: 'sm' })}>Save featured</button>
        </div>
      </form>

      <label for="meta-entry" class="block text-sm font-semibold text-white mb-1">Entry</label>
      <select id="meta-entry" value={selected()} onChange={(e) => pick(e.currentTarget.value)} class={`${field} w-full mb-4`}>
        <option value="">Choose an entry…</option>
        <For each={props.rows}>
          {(r) => <option value={r.catalogId}>{r.name} — {r.layers.length ? r.layers.map(layerLabel).join(', ') : 'Unclassified'} ({r.layerSource ?? 'none'}){r.bundleMembers ? ' · bundle' : ''}</option>}
        </For>
      </select>

      <Show when={row()}>
        {(r) => (
          <div class="space-y-5">
            <form onSubmit={save} class="space-y-4">
              <fieldset>
                <legend class="text-sm font-semibold text-white mb-1">Layers <span class="font-normal text-slate-400">(now: {r().layerSource ?? 'none'}{r().overridden.layers ? ', overridden' : ''})</span></legend>
                <div class="flex flex-wrap gap-3">
                  <For each={LAYERS}>
                    {(l) => (
                      <label class="flex items-center gap-1.5 text-sm text-slate-300">
                        <input type="checkbox" checked={(layers() ?? r().layers).includes(l.id)} onChange={() => toggleLayer(l.id)} />
                        {l.label}
                      </label>
                    )}
                  </For>
                  <button type="button" onClick={() => setLayers(null)} class={buttonVariants({ variant: 'ghost', size: 'sm' })} disabled={layers() === null}>Use synced value</button>
                </div>
              </fieldset>
              <fieldset>
                <legend class="text-sm font-semibold text-white mb-1">Bundle <span class="font-normal text-slate-400">(now: {r().bundleMembers ? `${r().bundleMembers!.length} members, ${r().bundleSource}` : 'not a bundle'})</span></legend>
                <div class="flex flex-wrap gap-3 mb-2 text-sm text-slate-300">
                  <label class="flex items-center gap-1.5"><input type="radio" name="bundle-mode" checked={bundleMode() === 'keep'} onChange={() => setBundleMode('keep')} /> Use synced value</label>
                  <label class="flex items-center gap-1.5"><input type="radio" name="bundle-mode" checked={bundleMode() === 'set'} onChange={() => setBundleMode('set')} /> Bundle of…</label>
                  <label class="flex items-center gap-1.5"><input type="radio" name="bundle-mode" checked={bundleMode() === 'none'} onChange={() => setBundleMode('none')} /> Not a bundle</label>
                </div>
                <Show when={bundleMode() === 'set'}>
                  <textarea aria-label="Bundle members, one package name per line" rows={4} value={bundle()} onInput={(e) => setBundle(e.currentTarget.value)} class={`${field} w-full font-mono`} />
                </Show>
              </fieldset>
              <button type="submit" class={buttonVariants({ size: 'sm' })}>Save overrides</button>
            </form>

            <div>
              <h3 class="text-sm font-semibold text-white mb-2">Preview images</h3>
              <ul class="space-y-1 text-sm mb-3">
                <For each={props.previews.filter((p) => p.catalogId === r().catalogId)} fallback={<li class="text-slate-400">No admin-added previews (manifest or README images are used if present).</li>}>
                  {(p) => (
                    <li class="flex items-center gap-2">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 truncate">{p.caption ?? p.url}</a>
                      <button type="button" onClick={() => act(removeCatalogPreview(p.id))} class={`${buttonVariants({ variant: 'ghost', size: 'sm' })} ml-auto`}>Remove</button>
                    </li>
                  )}
                </For>
              </ul>
              <form onSubmit={addPreview} class="flex flex-wrap gap-2">
                <input type="url" required aria-label="Image URL (https)" placeholder="https://…/screenshot.png" value={previewUrl()} onInput={(e) => setPreviewUrl(e.currentTarget.value)} class={`${field} flex-1 min-w-56`} />
                <input aria-label="Caption (optional)" placeholder="Caption (optional)" value={caption()} onInput={(e) => setCaption(e.currentTarget.value)} class={field} />
                <button type="submit" class={buttonVariants({ size: 'sm' })}>Add preview</button>
              </form>
            </div>
          </div>
        )}
      </Show>
      <Show when={msg()}>{(m) => <p role="status" class={`text-sm mt-3 ${m().ok ? 'text-emerald-400' : 'text-red-400'}`}>{m().message}</p>}</Show>
    </Card>
  );
}
