import type { PreviewImage } from '~/types/ui-module';

/** onError for preview <img>: if the cached copy fails to load, fall back once to the original source URL. */
export function previewFallback(p: PreviewImage) {
  return (ev: Event) => {
    const img = ev.currentTarget as HTMLImageElement;
    if (p.sourceUrl && img.dataset.fallback !== '1') {
      img.dataset.fallback = '1';
      img.src = p.sourceUrl;
    }
  };
}