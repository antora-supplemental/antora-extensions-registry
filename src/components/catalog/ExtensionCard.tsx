import { createSignal, Show } from 'solid-js';
import type { ExtensionCatalogEntry } from '~/types/ui-module';
import { formatInstallSnippet } from '~/lib/ui-modules';

interface ExtensionCardProps {
  entry: ExtensionCatalogEntry;
}

export default function ExtensionCard(props: ExtensionCardProps) {
  const [showInstall, setShowInstall] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(formatInstallSnippet(props.entry));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const typeLabel = () => {
    if (props.entry.type === 'ui-recipe') return 'Recipe';
    if (props.entry.tags.includes('fragment')) return 'Fragment';
    return 'Module';
  };

  return (
    <article class="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10">
      <div class="p-5">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 bg-primary-600/20 text-primary-300 text-xs rounded-md font-medium">
                {typeLabel()}
              </span>
              <span class="text-slate-500 text-xs font-mono">v{props.entry.version}</span>
            </div>
            <h3 class="font-semibold text-lg text-white group-hover:text-primary-400 transition-colors">
              {props.entry.name}
            </h3>
            <p class="text-slate-500 text-xs font-mono mt-1 truncate">{props.entry.catalogId}</p>
          </div>
        </div>

        <p class="text-slate-400 text-sm mb-4 line-clamp-3">{props.entry.description}</p>

        <Show when={(props.entry.requires?.length ?? 0) > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-500 mb-1">Requires</p>
            <div class="flex flex-wrap gap-1">
              {props.entry.requires.map((dep) => (
                <span class="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-xs rounded-md">{dep}</span>
              ))}
            </div>
          </div>
        </Show>

        <Show when={(props.entry.recommends?.length ?? 0) > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-500 mb-1">Recommends</p>
            <div class="flex flex-wrap gap-1">
              {props.entry.recommends.map((dep) => (
                <span class="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-xs rounded-md">{dep}</span>
              ))}
            </div>
          </div>
        </Show>

        <Show when={(props.entry.partials?.provide?.length ?? 0) > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-500 mb-1">Partials</p>
            <div class="flex flex-wrap gap-1">
              {props.entry.partials!.provide!.map((partial) => (
                <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 text-xs rounded-md font-mono">
                  {partial}
                </span>
              ))}
            </div>
          </div>
        </Show>

        <div class="flex flex-wrap gap-2 mb-4">
          {props.entry.tags.slice(0, 5).map((tag) => (
            <span class="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-md">{tag}</span>
          ))}
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setShowInstall(!showInstall())}
            class="px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 text-sm rounded-lg transition-colors"
          >
            {showInstall() ? 'Hide install' : 'Install snippet'}
          </button>
          <a
            href={props.entry.repository}
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            Repository
          </a>
        </div>

        <Show when={showInstall()}>
          <div class="relative mb-4">
            <pre class="p-3 bg-slate-900/80 border border-slate-700/50 rounded-lg text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre">
              {formatInstallSnippet(props.entry)}
            </pre>
            <button
              type="button"
              onClick={copyInstall}
              class="absolute top-2 right-2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
            >
              {copied() ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </Show>

        <div class="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-700/50">
          <span>
            by <span class="text-slate-400">{props.entry.author}</span>
          </span>
          <span>Updated {formatDate(props.entry.lastUpdated)}</span>
        </div>
      </div>
    </article>
  );
}
