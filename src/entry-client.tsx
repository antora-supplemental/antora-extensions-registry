import { mount, StartClient } from "@solidjs/start/client";
import { shouldHardReload } from "~/lib/chunk-error";

// A tab from the previous deploy asks for chunks that no longer exist: load the page fresh instead of crashing.
window.addEventListener("vite:preloadError", (event) => {
  let store: Storage | null = null;
  try { store = window.sessionStorage; } catch { /* blocked */ }
  if (shouldHardReload(window.location.href, store)) {
    event.preventDefault();
    window.location.reload();
  }
});

mount(() => <StartClient />, document.getElementById("app")!);
