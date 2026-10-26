import { useLocation } from '@solidjs/router';
import { createEffect, ErrorBoundary, on, onMount, type ParentProps } from 'solid-js';
import { isChunkLoadError, shouldHardReload } from '~/lib/chunk-error';

function safeSession(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function RouteError(props: { error: unknown; reset: () => void }) {
  const location = useLocation();
  // Reset whenever the route changes (links, Back, Forward), so the error never sticks to other pages.
  createEffect(on(() => location.pathname + location.search, () => props.reset(), { defer: true }));
  onMount(() => {
    if (isChunkLoadError(props.error) && shouldHardReload(window.location.href, safeSession())) {
      window.location.reload();
    }
  });
  return (
    <div role="alert" class="max-w-xl mx-auto px-4 py-24 text-center">
      <h1 class="text-2xl font-bold text-white mb-3">Something went wrong</h1>
      <p class="text-slate-400 mb-6">This page hit an error. Reloading usually fixes it.</p>
      <button type="button" class="rounded-md bg-brand text-brand-foreground px-4 py-2 font-medium" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

/** App-wide error boundary keyed to the location: it resets on navigation and recovers from stale-deploy chunks. */
export default function RouteErrorBoundary(props: ParentProps) {
  return <ErrorBoundary fallback={(err, reset) => <RouteError error={err} reset={reset} />}>{props.children}</ErrorBoundary>;
}
