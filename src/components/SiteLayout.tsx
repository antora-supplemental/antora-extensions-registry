import { A, createAsync, useLocation } from '@solidjs/router';
import { buttonVariants } from '~/components/ui/button';
import { createEffect, createSignal, For, on, Show, Suspense, type ParentProps } from 'solid-js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '~/components/ui/sheet';
import { getSessionData } from '~/app';
import { authClient } from '~/lib/auth-client';
import ThemeToggle from '~/components/ThemeToggle';

interface SiteLayoutProps extends ParentProps {
  title?: string;
  description?: string;
}

export default function SiteLayout(props: SiteLayoutProps) {
  const session = createAsync(() => getSessionData());
  const location = useLocation();
  const [menuOpen, setMenuOpen] = createSignal(false);
  // Close the mobile menu whenever the route changes.
  createEffect(on(() => location.pathname, () => setMenuOpen(false), { defer: true }));
  const navLinks = [
    { href: '/extensions', label: 'Extensions' },
    { href: '/themes', label: 'Themes' },
  ];
  const mobileLink = 'block rounded-lg px-3 py-2 text-base font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div class="site-shell min-h-screen text-slate-100 antialiased">
      <nav class="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <A href="/" aria-label="Antora Registry home" class="flex items-center gap-3 group">
              <div class="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/25">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="hidden sm:inline font-semibold text-lg group-hover:text-primary-400 transition-colors">
                Antora Registry
              </span>
            </A>
            <div class="hidden md:flex items-center gap-4">
              <A href="/extensions" class="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                Extensions
              </A>
              <A href="/themes" class="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                Themes
              </A>
              <ThemeToggle />
              <Suspense fallback={null}>
                <Show
                  when={session()?.user}
                  fallback={
                    <A
                      href="/auth/signin"
                      class={buttonVariants()}
                    >
                      Sign in
                    </A>
                  }
                >
                  {(user) => (
                    <div class="flex items-center gap-3">
                      <A
                        href="/themes/submit"
                        class={buttonVariants()}
                      >
                        Submit Theme
                      </A>
                      <Show when={user().image}>
                        <img src={user().image!} alt={user().name ?? ''} class="w-8 h-8 rounded-full" />
                      </Show>
                      <A
                        href="/auth/account"
                        class="text-slate-300 hover:text-white text-sm font-medium"
                      >
                        Account
                      </A>
                      <button
                        type="button"
                        onClick={() => authClient.signOut()}
                        class="text-slate-300 hover:text-white text-sm"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </Show>
              </Suspense>
            </div>
            <Sheet open={menuOpen()} onOpenChange={setMenuOpen}>
              <SheetTrigger
                aria-label="Open navigation menu"
                class="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg class="size-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </SheetTrigger>
              <SheetContent position="right" class="flex flex-col">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" class="flex flex-col gap-1">
                  <A href="/" end class={mobileLink} onClick={() => setMenuOpen(false)}>Home</A>
                  <For each={navLinks}>
                    {(link) => (
                      <A href={link.href} class={mobileLink} onClick={() => setMenuOpen(false)}>
                        {link.label}
                      </A>
                    )}
                  </For>
                  <ThemeToggle showLabel class="w-full px-3 py-2" />
                  <div class="my-2 border-t border-slate-700/50" />
                  <Suspense fallback={null}>
                    <Show
                      when={session()?.user}
                      fallback={<A href="/auth/signin" class={mobileLink} onClick={() => setMenuOpen(false)}>Sign in</A>}
                    >
                      <A href="/themes/submit" class={mobileLink} onClick={() => setMenuOpen(false)}>Submit Theme</A>
                      <A href="/auth/account" class={mobileLink} onClick={() => setMenuOpen(false)}>Account</A>
                      <button type="button" class={`${mobileLink} text-left`} onClick={() => { setMenuOpen(false); void authClient.signOut(); }}>
                        Sign out
                      </button>
                    </Show>
                  </Suspense>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      <main>{props.children}</main>

      <footer class="border-t border-slate-700/50 bg-slate-900/50 mt-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="flex flex-col md:flex-row justify-between items-center gap-4">
            <p class="text-slate-400 text-sm">
              registry.antora-supplemental.org — extensions, themes, and packages for the Antora community
              <span id="disclaimer" class="block mt-1 text-xs text-slate-500">* Not affiliated with or endorsed by the Antora project.</span>
            </p>
            <div class="flex items-center gap-6">
              <a href="https://antora-supplemental.org" target="_blank" rel="noopener" class="text-slate-400 hover:text-white transition-colors text-sm">
                Org home
              </a>
              <a href="https://docs.antora-supplemental.org" target="_blank" rel="noopener" class="text-slate-400 hover:text-white transition-colors text-sm">
                Docs
              </a>
              <a href="https://antora.org" target="_blank" rel="noopener" class="text-slate-400 hover:text-white transition-colors text-sm">
                Antora
              </a>
              <a href="https://github.com/antora-supplemental/antora-extensions-registry" target="_blank" rel="noopener" class="text-slate-400 hover:text-white transition-colors text-sm">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
