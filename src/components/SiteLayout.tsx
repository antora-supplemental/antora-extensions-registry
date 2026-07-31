import { A, createAsync } from '@solidjs/router';
import { Show, Suspense, type ParentProps } from 'solid-js';
import { getSessionData } from '~/app';
import { authClient } from '~/lib/auth-client';

interface SiteLayoutProps extends ParentProps {
  title?: string;
  description?: string;
}

export default function SiteLayout(props: SiteLayoutProps) {
  const session = createAsync(() => getSessionData());

  return (
    <div class="site-shell min-h-screen text-slate-100 antialiased">
      <nav class="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <A href="/" class="flex items-center gap-3 group">
              <div class="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/25">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="font-semibold text-lg group-hover:text-primary-400 transition-colors">
                Antora Registry
              </span>
            </A>
            <div class="flex items-center gap-4">
              <A href="/extensions" class="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                Extensions
              </A>
              <A href="/themes" class="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                Themes
              </A>
              <A href="/registry" class="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                Registry
              </A>
              <Suspense fallback={null}>
                <Show
                  when={session()?.user}
                  fallback={
                    <A
                      href="/auth/signin"
                      class="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Sign in
                    </A>
                  }
                >
                  {(user) => (
                    <div class="flex items-center gap-3">
                      <A
                        href="/themes/submit"
                        class="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
          </div>
        </div>
      </nav>

      <main>{props.children}</main>

      <footer class="border-t border-slate-700/50 bg-slate-900/50 mt-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="flex flex-col md:flex-row justify-between items-center gap-4">
            <p class="text-slate-400 text-sm">
              registry.antora-supplemental.org — extensions, themes, and packages for the Antora community
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
