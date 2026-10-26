import { AntoraBadges, SchemeSwatches } from './AntoraCompat';
import { antoraMajorsOf } from '~/lib/antora-compat';
import CardPreviewLink from './CardPreviewLink';
import { previewFallback } from '~/lib/preview-fallback';
import { createSignal, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import { ColorModeIcons, splitModeTags } from './ColorModeIcons';
import NewBadge from './NewBadge';
import LayerBadges from './LayerBadges';
import PackageTitle from './PackageTitle';
import { isBundle, isThemePackage } from '~/lib/layers';
import type { ExtensionCatalogEntry } from '~/types/ui-module';
import { formatInstallSnippet } from '~/lib/ui-modules';

interface ExtensionCardProps {
  entry: ExtensionCatalogEntry;
  /** Other listed versions (forks) of this package, collapsed into this card. */
  forkCount?: number;
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
    if (props.entry.bundle) return 'Bundle';
    if (props.entry.type === 'ui-recipe') return 'Recipe';
    if (props.entry.type === 'antora-extension') return 'Extension';
    if (props.entry.tags.includes('fragment')) return 'Fragment';
    return 'Module';
  };

  const members = () => props.entry.bundle?.members ?? props.entry.modules ?? [];
  const shortName = (n: string) => n.replace(/^@[^/]+\//, '');
  const thumb = () => props.entry.previews?.[0];

  return (
    <Card class="overflow-hidden">
      <Show when={thumb()}>
        <CardPreviewLink href={`/extensions/${props.entry.catalogId}`} class="block border-b border-slate-700/50 bg-white dark:bg-[#111111]">
          <img src={thumb()!.url} onError={previewFallback(thumb()!)} alt="" loading="lazy" class="h-36 w-full object-cover object-top" />
        </CardPreviewLink>
      </Show>
      <div class="p-5">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <Badge variant="primary">
                {typeLabel()}
              </Badge>
              <span class="text-slate-500 text-xs font-mono">v{props.entry.version}</span>
              <NewBadge firstListedAt={props.entry.firstListedAt} />
              <Show when={(props.forkCount ?? 0) > 0}>
                <Badge variant="tag" title="Other versions of this package are listed; see the package page">+{props.forkCount} {props.forkCount === 1 ? 'fork' : 'forks'}</Badge>
              </Show>
            </div>
            <PackageTitle entry={props.entry} />
          </div>
        </div>

        <p class="text-slate-400 text-sm mb-4 line-clamp-3">{props.entry.description}</p>

        <LayerBadges entry={props.entry} class="mb-3" />

        <Show when={isBundle(props.entry) && members().length > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-400 mb-1">
              Contains {members().length} {members().length === 1 ? 'item' : 'items'}
              <Show when={props.entry.bundle?.source === 'inferred'}> <span class="italic">(detected)</span></Show>
            </p>
            <p class="text-xs font-mono text-slate-300 line-clamp-2">{members().map(shortName).join(', ')}</p>
          </div>
        </Show>

        <Show when={(props.entry.requires?.length ?? 0) > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-500 mb-1">Requires</p>
            <div class="flex flex-wrap gap-1">
              {props.entry.requires.map((dep) => (
                <Badge variant="warning">{dep}</Badge>
              ))}
            </div>
          </div>
        </Show>

        <Show when={(props.entry.recommends?.length ?? 0) > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-500 mb-1">Recommends</p>
            <div class="flex flex-wrap gap-1">
              {props.entry.recommends.map((dep) => (
                <Badge variant="muted">{dep}</Badge>
              ))}
            </div>
          </div>
        </Show>

        <Show when={(props.entry.partials?.provide?.length ?? 0) > 0}>
          <div class="mb-3">
            <p class="text-xs text-slate-500 mb-1">Partials</p>
            <div class="flex flex-wrap gap-1">
              {props.entry.partials!.provide!.map((partial) => (
                <Badge variant="success">
                  {partial}
                </Badge>
              ))}
            </div>
          </div>
        </Show>

        <Show when={antoraMajorsOf(props.entry).length || props.entry.colorSchemes?.length}>
          <div class="flex flex-wrap items-center gap-1.5 mb-2">
            <AntoraBadges entry={props.entry} />
            <SchemeSwatches schemes={props.entry.colorSchemes} max={8} />
          </div>
        </Show>
        <Show when={isThemePackage(props.entry) && splitModeTags(props.entry.tags).modes.length > 0}>
          <div class="flex items-center gap-1.5 mb-2" aria-label="Color modes">
            <ColorModeIcons modes={splitModeTags(props.entry.tags).modes} />
          </div>
        </Show>
        <div class="flex flex-wrap gap-2 mb-4">
          {splitModeTags(props.entry.tags).rest.slice(0, 5).map((tag) => (
            <Badge>{tag}</Badge>
          ))}
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setShowInstall(!showInstall())}
            class={buttonVariants({ variant: 'soft', size: 'sm' })}
          >
            {showInstall() ? 'Hide install' : 'Install snippet'}
          </button>
          <a
            href={props.entry.repository}
            target="_blank"
            rel="noopener noreferrer"
            class={buttonVariants({ variant: 'secondary', size: 'sm' })}
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
    </Card>
  );
}
