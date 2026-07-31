import { createSignal, Show, onMount } from 'solid-js';
import type { Theme } from '~/types/theme';

interface ThemeCardProps {
  theme: Theme;
}

export default function ThemeCard(props: ThemeCardProps) {
  const [imageError, setImageError] = createSignal(false);
  let imgRef: HTMLImageElement | undefined;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  onMount(() => {
    if (imgRef && imgRef.complete && imgRef.naturalWidth === 0) {
      setImageError(true);
    }
  });

  return (
    <article class="group bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10">
      <div class="relative aspect-video overflow-hidden bg-slate-900">
        <Show
          when={!imageError()}
          fallback={
            <div class="w-full h-full flex flex-col items-center justify-center bg-slate-800">
              <svg class="w-16 h-16 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-slate-500 text-sm">No Preview Available</span>
            </div>
          }
        >
          <img
            ref={imgRef}
            src={props.theme.previewImage}
            alt={`Preview of ${props.theme.name} theme`}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        </Show>
        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div class="absolute bottom-3 left-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
          <a
            href={props.theme.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            Live Demo
          </a>
          <a
            href={props.theme.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>

      <div class="p-5">
        <div class="flex items-start justify-between gap-4 mb-3">
          <h3 class="font-semibold text-lg text-white capitalize group-hover:text-primary-400 transition-colors">
            {props.theme.name}
          </h3>
          <div class="flex items-center gap-1 text-yellow-400 shrink-0">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span class="text-sm font-medium">{props.theme.stars}</span>
          </div>
        </div>

        <p class="text-slate-400 text-sm mb-4 line-clamp-2">{props.theme.description}</p>

        <div class="flex flex-wrap gap-2 mb-4">
          {props.theme.tags.slice(0, 3).map((tag) => (
            <span class="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-md">{tag}</span>
          ))}
        </div>

        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>by <span class="text-slate-400">{props.theme.author}</span></span>
          <span>Updated {formatDate(props.theme.lastUpdated)}</span>
        </div>
      </div>
    </article>
  );
}
