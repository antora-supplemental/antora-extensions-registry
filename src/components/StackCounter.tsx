import { A, useLocation } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import { stackPicks } from '~/lib/stack-store';

/** Floating basket counter; links to /stack. */
export default function StackCounter() {
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));
  const loc = useLocation();
  const n = () => (ready() ? stackPicks().length : 0);
  return (
    <Show when={n() > 0 && loc.pathname !== '/stack'}>
      <A
        href="/stack"
        data-stack-counter
        class="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/30 hover:bg-primary-500"
      >
        Your stack
        <span class="rounded-full bg-white/25 px-2 py-0.5 text-xs tabular-nums">{n()}</span>
      </A>
    </Show>
  );
}
