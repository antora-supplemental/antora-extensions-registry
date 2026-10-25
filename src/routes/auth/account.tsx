import { createAsync, Navigate, useSearchParams } from "@solidjs/router";
import { createSignal, For, onMount, Show, Suspense } from "solid-js";
import SiteLayout from "~/components/SiteLayout";
import { getSessionData } from "~/app";
import { authClient } from "~/lib/auth-client";

type ProviderId = "github" | "gitlab" | "google" | "microsoft" | "apple";

const allProviders: { id: ProviderId; name: string }[] = [
  { id: "github", name: "GitHub" },
  { id: "gitlab", name: "GitLab" },
  { id: "google", name: "Google" },
  { id: "microsoft", name: "Microsoft" },
  { id: "apple", name: "Apple" },
];

const mergeMessages: Record<string, string> = {
  done: "Accounts merged. Sign-ins and registry submissions from the other account now belong to this one.",
  same: "That sign-in already belongs to this account, so there was nothing to merge.",
  expired: "The merge request expired. Start again from this page.",
  reauth: "Both sign-ins must be recent (within 10 minutes). Start the merge again.",
  failed: "The merge failed and nothing was changed. Try again or contact a site administrator.",
};

interface LinkedAccount {
  providerId: string;
  accountId: string;
}

export default function AccountPage() {
  const session = createAsync(() => getSessionData());
  const [params] = useSearchParams();
  const [configured, setConfigured] = createSignal<string[]>([]);
  const [accounts, setAccounts] = createSignal<LinkedAccount[]>([]);
  const [loading, setLoading] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [mergeProvider, setMergeProvider] = createSignal<ProviderId | null>(null);

  const providers = () => allProviders.filter((p) => configured().includes(p.id));

  onMount(async () => {
    try {
      const res = await fetch("/api/account/providers");
      if (res.ok) setConfigured(((await res.json()) as { providers: string[] }).providers);
      const linked = await authClient.listAccounts();
      if (linked.data) setAccounts(linked.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load linked accounts");
    }
  });

  const isLinked = (providerId: string) => accounts().some((a) => a.providerId === providerId);

  const linkProvider = async (provider: ProviderId) => {
    setError(null);
    setLoading(provider);
    try {
      const res = await authClient.linkSocial({ provider, callbackURL: "/auth/account" });
      if (res?.error) setError(res.error.message ?? "Could not link provider");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link provider");
    } finally {
      setLoading(null);
    }
  };

  const unlinkProvider = async (providerId: string, accountId: string) => {
    setError(null);
    if (accounts().length <= 1) {
      setError("You can't unlink your only sign-in method. Link another one first.");
      return;
    }
    setLoading(providerId);
    try {
      const res = await authClient.unlinkAccount({ providerId, accountId });
      if (res?.error) throw new Error(res.error.message ?? "Could not unlink provider");
      setAccounts((current) => current.filter((a) => a.accountId !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink provider");
    } finally {
      setLoading(null);
    }
  };

  const startMerge = async () => {
    const provider = mergeProvider();
    if (!provider) return;
    setError(null);
    setLoading("merge");
    try {
      const res = await fetch("/api/account/merge/start", { method: "POST" });
      if (res.status === 403) {
        // Fresh sign-in required for the account you keep: sign in again, then come back.
        await authClient.signOut();
        window.location.href = "/auth/signin";
        return;
      }
      if (!res.ok) throw new Error("Could not start the merge");
      // Prove ownership of the other account; the callback merges it into this one.
      await authClient.signIn.social({ provider, callbackURL: "/api/account/merge/complete" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the merge");
      setLoading(null);
    }
  };

  return (
    <SiteLayout title="Account">
      <Suspense fallback={<div class="text-center py-16 text-slate-400">Loading account...</div>}>
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

                  <Show when={typeof params.merge === "string" && mergeMessages[params.merge as string]}>
                    <p class="text-sm rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 text-slate-200">
                      {mergeMessages[params.merge as string]}
                    </p>
                  </Show>

                  <div class="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 space-y-4">
                    <h2 class="text-lg font-semibold text-white">Linked sign-ins</h2>
                    <p class="text-sm text-slate-400">
                      Link more providers so you can sign in to this same account with any of them. Signing in with GitHub or
                      GitLab links automatically when that provider reports the same verified email.
                    </p>

                    <Show when={error()}>
                      <p class="text-sm text-red-400">{error()}</p>
                    </Show>

                    <div class="grid gap-3">
                      <For each={providers()}>
                        {(provider) => (
                          <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/40">
                            <span class="font-medium text-white">
                              {provider.name}
                              <Show when={isLinked(provider.id)}>
                                <span class="ml-2 text-xs text-emerald-400">linked</span>
                              </Show>
                            </span>
                            <Show
                              when={isLinked(provider.id)}
                              fallback={
                                <button
                                  type="button"
                                  disabled={loading() !== null}
                                  onClick={() => linkProvider(provider.id)}
                                  class="text-sm px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-60"
                                >
                                  {loading() === provider.id ? "Linking..." : "Link"}
                                </button>
                              }
                            >
                              <button
                                type="button"
                                disabled={loading() !== null || accounts().length <= 1}
                                title={accounts().length <= 1 ? "This is your only sign-in method" : undefined}
                                onClick={() => {
                                  const account = accounts().find((a) => a.providerId === provider.id);
                                  if (account) unlinkProvider(provider.id, account.accountId);
                                }}
                                class="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white disabled:opacity-60"
                              >
                                {loading() === provider.id ? "Unlinking..." : "Unlink"}
                              </button>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  <div class="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-6 space-y-4">
                    <h2 class="text-lg font-semibold text-amber-200">Merge another account</h2>
                    <p class="text-sm text-slate-300">
                      Accidentally created a second account? Sign in to it below to prove you own it. Its sign-ins and registry
                      submissions move into this account (your profile here is kept) and the other account is deleted.
                    </p>
                    <p class="text-xs text-slate-500">
                      For safety, both sign-ins must be from the last 10 minutes. If this one is older you'll be asked to sign in again first.
                    </p>
                    <div class="flex flex-wrap items-center gap-3">
                      <select
                        class="rounded-lg bg-slate-900 border border-slate-700 text-white text-sm px-3 py-1.5"
                        onChange={(e) => setMergeProvider((e.currentTarget.value || null) as ProviderId | null)}
                      >
                        <option value="">Other account signs in with...</option>
                        <For each={providers()}>{(p) => <option value={p.id}>{p.name}</option>}</For>
                      </select>
                      <button
                        type="button"
                        disabled={!mergeProvider() || loading() !== null}
                        onClick={startMerge}
                        class="text-sm px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-60"
                      >
                        {loading() === "merge" ? "Redirecting..." : "Merge another account"}
                      </button>
                    </div>
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
