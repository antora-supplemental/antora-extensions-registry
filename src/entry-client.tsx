import { mount, StartClient } from "@solidjs/start/client";
import { isChunkLoadError, shouldHardReload } from "~/lib/chunk-error";

// A tab from the previous deploy asks for route chunks that no longer exist. The router's lazy load rejects before the
// URL changes (an uncaught "Failed to fetch dynamically imported module"), so remember where the user was going and
// load that page fresh instead, once per URL.
let pendingHref: string | null = null;
document.addEventListener(
  "click",
  (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (a && a.origin === window.location.origin) pendingHref = a.href;
  },
  true,
);
window.addEventListener("popstate", () => (pendingHref = window.location.href));

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function recover(err: unknown, event: Event) {
  if (!isChunkLoadError(err)) return;
  const target = pendingHref ?? window.location.href;
  if (!shouldHardReload(target, session())) return;
  event.preventDefault();
  window.location.assign(target);
}

window.addEventListener("vite:preloadError", (e) => recover((e as Event & { payload?: unknown }).payload ?? "Unable to preload CSS", e));
window.addEventListener("unhandledrejection", (e) => recover(e.reason, e));
window.addEventListener("error", (e) => recover(e.error ?? e.message, e));

mount(() => <StartClient />, document.getElementById("app")!);
