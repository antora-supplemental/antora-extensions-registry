import { previewFallback } from '~/lib/preview-fallback';
import { Dialog } from '@kobalte/core/dialog';
import { createSignal, For, Show } from 'solid-js';
import type { PreviewImage } from '~/types/ui-module';

const SOURCE_LABEL: Record<PreviewImage['source'], string> = {
  manifest: 'From the repository manifest',
  readme: 'From the README',
  upload: 'Added by a registry admin',
  curated: 'Added by the registry',
};

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5F00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]';
const NAV_BUTTON = `rounded-md border border-white/40 bg-[#111111] px-3 py-2 text-white hover:border-[#FF5F00] hover:text-[#FF5F00] ${FOCUS}`;
const SWIPE_MIN_PX = 50;

/** Detail-page gallery: a large image with a thumbnail strip. Clicking the image opens an in-page lightbox. */
export default function PreviewGallery(props: { previews: PreviewImage[]; name: string }) {
  const [index, setIndex] = createSignal(0);
  const [open, setOpen] = createSignal(false);
  const count = () => props.previews.length;
  const current = () => props.previews[Math.min(index(), count() - 1)];
  const label = (p: PreviewImage) => p.caption ?? `${props.name} preview`;
  const step = (delta: number) => setIndex((i) => (i + delta + count()) % count());
  let touchX: number | null = null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (count() < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <figure>
      <Dialog open={open()} onOpenChange={setOpen}>
        <Dialog.Trigger
          class={`block w-full rounded-lg border border-slate-700 bg-slate-900 overflow-hidden cursor-zoom-in ${FOCUS}`}
          aria-label={`Open ${label(current())} in a larger view`}
        >
          <img src={current().url} onError={previewFallback(current())} alt={label(current())} class="w-full max-h-[28rem] object-contain bg-white dark:bg-[#111111]" loading="lazy" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-50 bg-[#111111]/95" />
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <Dialog.Content
              class="relative flex max-h-full w-full max-w-6xl flex-col text-white outline-none"
              onKeyDown={onKeyDown}
            >
              <div class="mb-3 flex items-center justify-between gap-4">
                <Dialog.Title class="text-sm font-medium text-white">
                  {props.name} preview <span aria-live="polite">{index() + 1} / {count()}</span>
                </Dialog.Title>
                <Dialog.CloseButton class={NAV_BUTTON} aria-label="Close preview">
                  <span aria-hidden="true">&times;</span>
                </Dialog.CloseButton>
              </div>
              <div
                class="flex min-h-0 flex-1 items-center justify-center gap-3"
                onTouchStart={(e) => (touchX = e.touches[0]?.clientX ?? null)}
                onTouchEnd={(e) => {
                  const end = e.changedTouches[0]?.clientX;
                  if (touchX !== null && end !== undefined && count() > 1 && Math.abs(end - touchX) >= SWIPE_MIN_PX) step(end < touchX ? 1 : -1);
                  touchX = null;
                }}
              >
                <Show when={count() > 1}>
                  <button type="button" class={NAV_BUTTON} aria-label="Previous image" onClick={() => step(-1)}>
                    <span aria-hidden="true">&larr;</span>
                  </button>
                </Show>
                <img src={current().url} onError={previewFallback(current())} alt={label(current())} class="max-h-[75vh] min-w-0 max-w-full rounded-md bg-white object-contain dark:bg-[#111111]" />
                <Show when={count() > 1}>
                  <button type="button" class={NAV_BUTTON} aria-label="Next image" onClick={() => step(1)}>
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </Show>
              </div>
              <Dialog.Description class="mt-3 text-center text-sm text-white/90">
                {label(current())} <span class="text-white/70">· {SOURCE_LABEL[current().source]}</span>
              </Dialog.Description>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
      <figcaption class="mt-2 text-sm text-slate-400">
        {label(current())} <span class="text-slate-500">· {SOURCE_LABEL[current().source]}</span>
      </figcaption>
      <Show when={count() > 1}>
        <ul class="mt-3 flex gap-2 overflow-x-auto" aria-label="Preview images">
          <For each={props.previews}>
            {(p, i) => (
              <li>
                <button
                  type="button"
                  onClick={() => setIndex(i())}
                  aria-label={`Show preview ${i() + 1}: ${p.caption ?? props.name}`}
                  aria-current={i() === index() ? 'true' : undefined}
                  class={`block h-16 w-28 rounded-md overflow-hidden border-2 bg-white dark:bg-[#111111] ${FOCUS} ${i() === index() ? 'border-primary-600' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <img src={p.url} onError={previewFallback(p)} alt="" class="h-full w-full object-cover" loading="lazy" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </figure>
  );
}
