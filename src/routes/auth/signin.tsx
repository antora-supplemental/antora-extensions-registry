import { Component, createSignal, For, Show } from "solid-js";
import SiteLayout from "~/components/SiteLayout";
import { authClient } from "~/lib/auth-client";

type ProviderId = "github" | "gitlab" | "google" | "microsoft" | "apple";

const socialProviders: { id: ProviderId; name: string }[] = [
    { id: "github", name: "GitHub" },
    { id: "gitlab", name: "GitLab" },
    { id: "google", name: "Google" },
    { id: "microsoft", name: "Microsoft" },
    { id: "apple", name: "Apple" },
];

export default function SignIn() {
    const [email, setEmail] = createSignal("");
    const [emailSent, setEmailSent] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal<ProviderId | "email" | null>(null);

    const signInWithProvider = async (provider: ProviderId) => {
        setError(null);
        setLoading(provider);
        try {
            await authClient.signIn.social({
                provider,
                callbackURL: "/",
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign-in failed");
        } finally {
            setLoading(null);
        }
    };

    const signInWithEmail = async (event: Event) => {
        event.preventDefault();
        setError(null);
        setLoading("email");

        try {
            await authClient.signIn.magicLink({
                email: email(),
                callbackURL: "/",
            });
            setEmailSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send magic link");
        } finally {
            setLoading(null);
        }
    };

    return (
        <SiteLayout>
            <div class="min-h-[70vh] flex items-center justify-center p-6">
                <div class="relative w-full max-w-sm space-y-10">
                    <div class="text-center space-y-4">
                        <h1 class="text-3xl font-black text-white tracking-tight">Sign in</h1>
                        <p class="text-sm text-slate-400 font-medium">Choose a provider to continue</p>
                    </div>

                    <Show when={error()}>
                        <p class="text-sm text-red-400 text-center">{error()}</p>
                    </Show>

                    <div class="grid gap-3">
                        <For each={socialProviders}>
                            {(provider) => (
                                <button
                                    type="button"
                                    disabled={loading() !== null}
                                    onClick={() => signInWithProvider(provider.id)}
                                    class="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/50 transition-all border border-slate-700/50 group disabled:opacity-60"
                                >
                                    <div class="flex items-center gap-4">
                                        <ProviderIcon type={provider.id} />
                                        <span class="font-bold text-sm text-white/90 group-hover:text-white transition-colors">
                                            {provider.name}
                                        </span>
                                    </div>
                                </button>
                            )}
                        </For>
                    </div>

                    <form class="space-y-3" onSubmit={signInWithEmail}>
                        <label class="block text-sm text-slate-400" for="email">
                            Or sign in with email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email()}
                            onInput={(event) => setEmail(event.currentTarget.value)}
                            placeholder="you@example.com"
                            class="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-500"
                        />
                        <button
                            type="submit"
                            disabled={loading() !== null}
                            class="w-full px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium disabled:opacity-60"
                        >
                            {loading() === "email" ? "Sending..." : "Send magic link"}
                        </button>
                        <Show when={emailSent()}>
                            <p class="text-sm text-green-400 text-center">
                                Check your inbox for a sign-in link.
                            </p>
                        </Show>
                    </form>
                </div>
            </div>
        </SiteLayout>
    );
}

const ProviderIcon: Component<{ type: string }> = (props) => {
    return (
        <div class="w-5 h-5 flex items-center justify-center text-slate-300">
            <span class="text-xs font-bold uppercase">{props.type.slice(0, 2)}</span>
        </div>
    );
};
