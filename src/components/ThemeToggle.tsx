import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { cn } from '~/lib/utils';
import { COLOR_SCHEME_EVENT, currentColorScheme, setColorScheme, type ColorScheme } from '~/lib/color-scheme';

/** Two-state Light/Dark toggle. Follows the OS/browser scheme until clicked; a later system change wins again. */
export default function ThemeToggle(props: { showLabel?: boolean; class?: string }) {
  const [scheme, setScheme] = createSignal<ColorScheme>('dark');

  onMount(() => {
    setScheme(currentColorScheme());
    const sync = (e: Event) => setScheme((e as CustomEvent<ColorScheme>).detail);
    window.addEventListener(COLOR_SCHEME_EVENT, sync);
    onCleanup(() => window.removeEventListener(COLOR_SCHEME_EVENT, sync));
  });

  const isDark = () => scheme() === 'dark';

  return (
    <button
      type="button"
      onClick={() => setColorScheme(isDark() ? 'light' : 'dark')}
      aria-label={isDark() ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark()}
      title={isDark() ? 'Switch to light theme' : 'Switch to dark theme'}
      class={cn('inline-flex items-center gap-2 rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-none', props.class)}
    >
      <svg class="size-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <Show
          when={isDark()}
          fallback={<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />}
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
        </Show>
      </svg>
      <Show when={props.showLabel}>
        <span class="text-base font-medium">{isDark() ? 'Dark theme' : 'Light theme'}</span>
      </Show>
    </button>
  );
}