import { For, Show } from 'solid-js';
import { antoraLineLabel, antoraMajorsOf, groupByAntora, type ReleaseInfo } from '~/lib/antora-compat';
import type { ColorScheme } from '~/lib/color-schemes';

/** "Antora 3" / "Antora 4" badges for the lines an entry's releases (or repo default) target. */
export function AntoraBadges(props: { entry: { releases?: ReleaseInfo[]; antora?: number[] }; class?: string }) {
  return (
    <For each={antoraMajorsOf(props.entry)}>
      {(m) => (
        <span
          class={`inline-flex items-center rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300 ${props.class ?? ''}`}
          title={`Has releases for ${antoraLineLabel(m)}`}
          data-antora-badge={m}
        >
          Antora {m}
        </span>
      )}
    </For>
  );
}

/** One chip per declared color scheme, with its swatch colors. */
export function SchemeSwatches(props: { schemes?: ColorScheme[]; max?: number; showLabels?: boolean }) {
  const list = () => (props.schemes ?? []).slice(0, props.max ?? 99);
  return (
    <Show when={list().length}>
      <ul class="flex flex-wrap gap-1.5" aria-label="Color schemes">
        <For each={list()}>
          {(s) => (
            <li class="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/40 px-1 py-0.5" title={`${s.label} (${s.mode})`}>
              <span class="inline-flex overflow-hidden rounded-sm" aria-hidden="true">
                <For each={s.swatches}>{(c) => <span class="block h-3.5 w-2.5" style={{ background: c }} />}</For>
              </span>
              <Show when={props.showLabels} fallback={<span class="sr-only">{s.label}</span>}>
                <span class="text-xs text-slate-300">{s.label}</span>
              </Show>
            </li>
          )}
        </For>
        <Show when={(props.schemes?.length ?? 0) > list().length}>
          <li class="text-xs text-slate-400 self-center">+{props.schemes!.length - list().length}</li>
        </Show>
      </ul>
    </Show>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  'build-metadata': 'tag +antora.N',
  engines: 'engines.antora',
  'peer-dependencies': '@antora peer dependency',
  'repo-default': 'antoraRegistry.antora',
};

/** Releases grouped by Antora line, newest line first; the latest stable release per line is highlighted. */
export function ReleasesTable(props: { releases: ReleaseInfo[] }) {
  return (
    <div class="space-y-6" data-releases>
      <For each={groupByAntora(props.releases)}>
        {(g) => (
          <section>
            <h3 class="text-lg font-semibold text-white mb-1">{g.major === null ? 'Antora version not declared' : antoraLineLabel(g.major)}</h3>
            <Show when={g.latest}>
              {(l) => (
                <p class="text-sm text-slate-400 mb-2">
                  Latest: <code class="font-mono text-slate-200">{l().tag}</code> · install <code class="font-mono text-slate-200">pnpm add {l().installSpec}</code>
                  <Show when={l().assets[0]}>{(a) => <> · <a class="text-primary-400 hover:text-primary-300" href={a().url}>{a().name}</a></>}</Show>
                </p>
              )}
            </Show>
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="text-slate-400">
                  <tr><th class="py-1 pr-4">Release</th><th class="py-1 pr-4">Published</th><th class="py-1 pr-4">Install</th><th class="py-1 pr-4">Bundles</th><th class="py-1">Declared by</th></tr>
                </thead>
                <tbody>
                  <For each={g.releases}>
                    {(r) => (
                      <tr class="border-t border-slate-700/50 align-top">
                        <td class="py-1.5 pr-4 font-mono text-slate-200 whitespace-nowrap">
                          <Show when={r.htmlUrl} fallback={r.tag}><a class="hover:text-primary-300" href={r.htmlUrl}>{r.tag}</a></Show>
                          <Show when={r === g.latest}> <span class="ml-1 rounded bg-emerald-500/15 px-1 text-[11px] text-emerald-300">latest</span></Show>
                          <Show when={r.rolling}> <span class="ml-1 rounded bg-slate-700 px-1 text-[11px] text-slate-300" title={r.label}>rolling</span></Show>
                          <Show when={r.prerelease}> <span class="ml-1 rounded bg-amber-500/15 px-1 text-[11px] text-amber-300">pre</span></Show>
                        </td>
                        <td class="py-1.5 pr-4 text-slate-400 whitespace-nowrap">{r.publishedAt ? r.publishedAt.slice(0, 10) : '—'}</td>
                        <td class="py-1.5 pr-4"><code class="font-mono text-xs text-slate-300">{r.installSpec}</code></td>
                        <td class="py-1.5 pr-4">
                          <For each={r.assets} fallback={<span class="text-slate-500">—</span>}>
                            {(a) => <a class="mr-2 text-primary-400 hover:text-primary-300 whitespace-nowrap" href={a.url}>{a.name}</a>}
                          </For>
                        </td>
                        <td class="py-1.5 text-slate-400 text-xs">{r.antoraSource ? SOURCE_LABEL[r.antoraSource] : 'not declared'}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </For>
    </div>
  );
}
