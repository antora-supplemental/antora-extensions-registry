import { previewFallback } from '~/lib/preview-fallback';
import { A } from '@solidjs/router';
import { Show } from 'solid-js';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import BundleContents from './BundleContents';
import LayerBadges from './LayerBadges';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

/** The home page's featured slot (admin-configurable; see /admin). */
export default function FeaturedExtension(props: { entry: ExtensionCatalogEntry; all: ExtensionCatalogEntry[] }) {
  const thumb = () => props.entry.previews?.[0];
  return (
    <Card class="overflow-hidden">
      <div class={thumb() ? 'grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : ''}>
        <Show when={thumb()}>
          <A href={`/extensions/${props.entry.catalogId}`} tabIndex={-1} aria-hidden="true" class="block bg-white dark:bg-[#111111] border-b md:border-b-0 md:border-r border-slate-700/50">
            <img src={thumb()!.url} onError={previewFallback(thumb()!)} alt="" class="h-full max-h-80 w-full object-cover object-top" loading="lazy" />
          </A>
        </Show>
        <div class="p-6 lg:p-8">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="primary">Featured</Badge>
            <Show when={props.entry.bundle}><Badge variant="muted">Bundle · {props.entry.bundle!.members.length} packages</Badge></Show>
          </div>
          <h3 class="text-2xl font-bold text-white mb-2">{props.entry.name}</h3>
          <p class="text-slate-300 mb-4 max-w-2xl">{props.entry.description}</p>
          <LayerBadges entry={props.entry} class="mb-4" />
          <Show when={props.entry.bundle}>
            <div class="mb-6"><BundleContents entry={props.entry} all={props.all} limit={10} /></div>
          </Show>
          <div class="flex flex-wrap gap-3">
            <A href={`/extensions/${props.entry.catalogId}`} class={buttonVariants({ variant: 'default' })}>View {props.entry.bundle ? 'bundle' : 'extension'}</A>
            <Show when={props.entry.homepage}>
              <a href={props.entry.homepage} target="_blank" rel="noopener noreferrer" class={buttonVariants({ variant: 'secondary' })}>Live demo</a>
            </Show>
          </div>
        </div>
      </div>
    </Card>
  );
}
