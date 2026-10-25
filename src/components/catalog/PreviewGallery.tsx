import { createSignal, For, Show } from 'solid-js';
import type { PreviewImage } from '~/types/ui-module';

const SOURCE_LABEL: Record<PreviewImage['source'], string> = {
  manifest: 'From the repository manifest',
  readme: 'From the README',
  upload: 'Added by a registry admin',
  curated: 'Added by the registry',
};

/** Detail-page gallery: a large image with a thumbnail strip. */
export default function PreviewGallery(props: { previews: PreviewImage[]; name: string }) {
  const [index, setIndex] = createSignal(0);
  const current = () => props.previews[Math.min(index(), props.previews.length - 1)];
  return (
    <figure>
      <a href={current().url} target="_blank" rel="noopener noreferrer" class="block rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
        <img src={current().url} alt={current().caption ?? `${props.name} preview`} class="w-full max-h-[28rem] object-contain bg-white dark:bg-[#111111]" loading="lazy" />
      </a>
      <figcaption class="mt-2 text-sm text-slate-400">
        {current().caption ?? `${props.name} preview`} <span class="text-slate-500">· {SOURCE_LABEL[current().source]}</span>
      </figcaption>
      <Show when={props.previews.length > 1}>
        <ul class="mt-3 flex gap-2 overflow-x-auto" aria-label="Preview images">
          <For each={props.previews}>
            {(p, i) => (
              <li>
                <button
                  type="button"
                  onClick={() => setIndex(i())}
                  aria-label={`Show preview ${i() + 1}: ${p.caption ?? props.name}`}
                  aria-current={i() === index() ? 'true' : undefined}
                  class={`block h-16 w-28 rounded-md overflow-hidden border-2 bg-white dark:bg-[#111111] ${i() === index() ? 'border-primary-600' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <img src={p.url} alt="" class="h-full w-full object-cover" loading="lazy" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </figure>
  );
}
