import { createAsync } from "@solidjs/router";
import { createSignal, For, onMount, Show, Suspense } from "solid-js";
import { Navigate } from "@solidjs/router";
import SiteLayout from "~/components/SiteLayout";
import { getSessionData } from "~/app";
import { authClient } from "~/lib/auth-client";

type ProviderId = "github" | "gitlab" | "google" | "microsoft" | "apple";

const linkableProviders: { id: ProviderId; name: string }[] = [
  { id: "github", name: "GitHub" },
  { id: "gitlab", name: "GitLab" },
  { id: "google", name: "Google" },
  { id: "microsoft", name: "Microsoft" },
  { id: "apple", name: "Apple" },
];

interface LinkedAccount {
  providerId: string;
  accountId: string;
}

export default function AccountPage() {
  const session = createAsync(() => getSessionData());
  const [accounts, setAccounts] = createSignal<LinkedAccount[]>([]);
  const [loading, setLoading] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const linked = await authClient.listAccounts();
      if (linked.data) {
        setAccounts(linked.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load linked accounts");
    }
  });

  const isLinked = (providerId: string) =>
    accounts().some((account) => account.providerId === providerId);

  const linkProvider = async (provider: ProviderId) => {
    setError(null);
    setLoading(provider);
    try {
      await authClient.linkSocial({
        provider,
        callbackURL: "/auth/account",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link provider");
    } finally {
      setLoading(null);
    }
  };

  const unlinkProvider = async (providerId: string, accountId: string) => {
    setError(null);
    setLoading(providerId);
    try {
      await authClient.unlinkAccount({ providerId, accountId });
      setAccounts((current) => current.filter((account) => account.accountId !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink provider");
    } finally {
      setLoading(null);
    }
  };

  return (
    <SiteLayout title="Account">
      <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading account…</div>}>
        <Show when={session() !== undefined}>
          <Show when={session()?.user} fallback={<Navigate href="/auth/signin" />}>
            {(user) => (
              <section class="py-16 lg:py-24">
                <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                  <div>
                    <h1 class="text-3xl font-bold text-white mb-2">Account</h1>
                    <p class="text-slate-400">
                      Signed in as <span class="text-primary-400">{user().email ?? user().name}</span>
                    </p>
                  </div>

                  <div class="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 space-y-4">
                    <h2 class="text-lg font-semibold text-white">Linked sign-in methods</h2>
                    <p class="text-sm text-slate-400">
                      Link GitHub, GitLab, Google, Microsoft, Apple, or email so you can sign in with any of them on this account.
                      Providers may use different email addresses.
                    </p>

                    <Show when={error()}>
                      <p class="text-sm text-red-400">{error()}</p>
                    </Show>

                    <div class="grid gap-3">
                      <For each={linkableProviders}>
                        {(provider) => (
                          <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/40">
                            <span class="font-medium text-white">{provider.name}</span>
                            <Show
                              when={isLinked(provider.id)}
                              fallback={
                                <button
                                  type="button"
                                  disabled={loading() !== null}
                                  onClick={() => linkProvider(provider.id)}
                                  class="text-sm px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-60"
                                >
                                  {loading() === provider.id ? "Linking…" : "Link"}
                                </button>
                              }
                            >
                              <button
                                type="button"
                                disabled={loading() !== null}
                                onClick={() => {
                                  const account = accounts().find((entry) => entry.providerId === provider.id);
                                  if (account) unlinkProvider(provider.id, account.accountId);
                                }}
                                class="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white disabled:opacity-60"
                              >
                                {loading() === provider.id ? "Unlinking…" : "Unlink"}
                              </button>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>

                    <Show when={user().email}>
                      <p class="text-sm text-slate-500">
                        Email on this account: {user().email}
                      </p>
                    </Show>
                  </div>

                  <div class="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-6 space-y-3">
                    <h2 class="text-lg font-semibold text-amber-200">Duplicate accounts</h2>
                    <p class="text-sm text-slate-300">
                      Better Auth supports linking providers to one account after sign-in, but it does not yet provide a
                      self-service “merge two user records” flow when you accidentally created separate accounts with different emails.
                    </p>
                    <p class="text-sm text-slate-400">
                      If that happens, sign in to the account you want to keep, link the other providers here, then contact a site
                      administrator to retire the duplicate user record. A custom merge tool may be added to this registry later; it
                      is not part of Better Auth today.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </Show>
      </Suspense>
    </SiteLayout>
  );
}
