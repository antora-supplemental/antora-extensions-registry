import { useSearchParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import SiteLayout from "~/components/SiteLayout";
import ProviderIcon from "~/components/icons/ProviderIcon";
import { authClient, signInWithProvider as startProviderSignIn } from "~/lib/auth-client";
import { PASSWORD_MIN, passwordProblem } from "~/lib/password-policy";

type ProviderId = "github" | "gitlab" | "google" | "microsoft" | "apple";
type Mode = "signin" | "signup" | "forgot" | "magic";

const socialProviders: { id: ProviderId; name: string }[] = [
    { id: "github", name: "GitHub" },
    { id: "gitlab", name: "GitLab" },
    { id: "google", name: "Google" },
    { id: "microsoft", name: "Microsoft" },
    { id: "apple", name: "Apple" },
];

interface Features {
    providers: string[];
    password?: boolean;
    magicLink?: boolean;
    emailVerification?: boolean;
    passwordReset?: boolean;
}

/** Only same-site paths are allowed as a post-sign-in destination. */
function safeRedirect(value: unknown): string {
    return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** One message for every credential failure, so responses never reveal whether an account exists. */
function friendly(err: { status?: number; message?: string; code?: string } | null | undefined, fallback: string): string {
    if (!err) return fallback;
    if (err.status === 429) return "Too many attempts. Try again in a few minutes.";
    if (err.code === "PASSWORD_COMPROMISED") return "Choose a different password: this one appears in known data breaches.";
    if (err.code === "PASSWORD_TOO_SHORT") return `Use at least ${PASSWORD_MIN} characters.`;
    if (err.code === "EMAIL_NOT_VERIFIED") return "Confirm your email first: check your inbox for the link.";
    return fallback;
}

const input =
    "w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand";
const primary =
    "w-full px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-brand-foreground font-medium disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const link = "text-sm text-slate-400 hover:text-brand underline-offset-2 hover:underline";

export default function SignIn() {
    const [params] = useSearchParams();
    const returnTo = () => safeRedirect(params.redirect);
    const [mode, setMode] = createSignal<Mode>(params.mode === "signup" ? "signup" : "signin");
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");
    const [name, setName] = createSignal("");
    const [notice, setNotice] = createSignal<string | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal<ProviderId | "email" | null>(null);
    // Only offer methods configured on the server (e.g. GitLab appears once GITLAB_ID/SECRET are set).
    const [features, setFeatures] = createSignal<Features | null>(null);
    onMount(async () => {
        try {
            const res = await fetch("/api/account/providers");
            if (res.ok) setFeatures((await res.json()) as Features);
        } catch {
            setFeatures(null);
        }
    });
    const visibleProviders = () => {
        const ids = features()?.providers;
        return ids ? socialProviders.filter((p) => ids.includes(p.id)) : socialProviders.filter((p) => p.id === "github");
    };
    const switchTo = (m: Mode) => {
        setMode(m);
        setError(null);
        setNotice(null);
    };

    const signInWithProvider = async (provider: ProviderId) => {
        setError(null);
        setLoading(provider);
        try {
            await startProviderSignIn(provider, returnTo());
        } catch {
            setError("Sign-in failed. Try again.");
        } finally {
            setLoading(null);
        }
    };

    const run = async (fn: () => Promise<void>) => {
        setError(null);
        setNotice(null);
        setLoading("email");
        try {
            await fn();
        } finally {
            setLoading(null);
        }
    };

    const submitSignIn = (event: Event) => {
        event.preventDefault();
        void run(async () => {
            const { error: err } = await authClient.signIn.email({ email: email().trim().toLowerCase(), password: password() });
            if (err) return void setError(friendly(err, "Email or password is incorrect."));
            location.assign(returnTo());
        });
    };

    const submitSignUp = (event: Event) => {
        event.preventDefault();
        const problem = passwordProblem(password());
        if (problem) return void setError(problem);
        void run(async () => {
            const addr = email().trim().toLowerCase();
            const { error: err } = await authClient.signUp.email({
                email: addr,
                password: password(),
                name: name().trim() || addr.split("@")[0],
                callbackURL: returnTo(),
            });
            if (err) return void setError(friendly(err, "Could not create the account. Check the details and try again."));
            if (features()?.emailVerification) {
                setPassword("");
                return void setNotice("Check your inbox to confirm your email, then sign in.");
            }
            const signedIn = await authClient.signIn.email({ email: addr, password: password() });
            if (signedIn.error) {
                return void setError("Could not create the account. If you already have one, sign in instead.");
            }
            location.assign(returnTo());
        });
    };

    const submitForgot = (event: Event) => {
        event.preventDefault();
        void run(async () => {
            const { error: err } = await authClient.requestPasswordReset({
                email: email().trim().toLowerCase(),
                redirectTo: "/auth/reset-password",
            });
            if (err?.status === 429) return void setError(friendly(err, ""));
            setNotice("If an account uses that email, a reset link is on its way.");
        });
    };

    const submitMagic = (event: Event) => {
        event.preventDefault();
        void run(async () => {
            const { error: err } = await authClient.signIn.magicLink({ email: email().trim().toLowerCase(), callbackURL: returnTo() });
            if (err) return void setError(friendly(err, "Could not send the link. Try again later."));
            setNotice("Check your inbox for a sign-in link.");
        });
    };

    const title = () => ({ signin: "Sign in", signup: "Create account", forgot: "Reset password", magic: "Email me a link" })[mode()];

    return (
        <SiteLayout title={title()}>
            <div class="min-h-[70vh] flex items-center justify-center p-6">
                <div class="relative w-full max-w-sm space-y-8">
                    <div class="text-center space-y-4">
                        <h1 class="text-3xl font-black text-white tracking-tight">{title()}</h1>
                        <p class="text-sm text-slate-400 font-medium">
                            {mode() === "signup" ? "Use a provider or an email and password" : "Choose a provider or use your email"}
                        </p>
                    </div>

                    <Show when={mode() === "signin" || mode() === "signup"}>
                        <div class="grid gap-3">
                            <For each={visibleProviders()}>
                                {(provider) => (
                                    <button
                                        type="button"
                                        disabled={loading() !== null}
                                        onClick={() => signInWithProvider(provider.id)}
                                        class="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/50 transition-all border border-slate-700/50 group disabled:opacity-60"
                                    >
                                        <div class="flex items-center gap-4">
                                            <ProviderIcon provider={provider.id} class="text-slate-200" />
                                            <span class="font-bold text-sm text-white/90 group-hover:text-white transition-colors">
                                                {provider.name}
                                            </span>
                                        </div>
                                    </button>
                                )}
                            </For>
                        </div>
                        <div class="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500" aria-hidden="true">
                            <span class="h-px flex-1 bg-slate-700/50" />
                            or
                            <span class="h-px flex-1 bg-slate-700/50" />
                        </div>
                    </Show>

                    <form
                        class="space-y-3"
                        data-auth-form={mode()}
                        onSubmit={(e) => ({ signin: submitSignIn, signup: submitSignUp, forgot: submitForgot, magic: submitMagic })[mode()](e)}
                    >
                        <Show when={mode() === "signup"}>
                            <label class="block text-sm text-slate-400" for="name">Name <span class="text-slate-500">(optional)</span></label>
                            <input id="name" type="text" autocomplete="name" maxlength="100" value={name()} onInput={(e) => setName(e.currentTarget.value)} class={input} />
                        </Show>
                        <label class="block text-sm text-slate-400" for="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            required
                            autocomplete="email"
                            value={email()}
                            onInput={(e) => setEmail(e.currentTarget.value)}
                            placeholder="you@example.com"
                            class={input}
                        />
                        <Show when={mode() === "signin" || mode() === "signup"}>
                            <div class="flex items-baseline justify-between">
                                <label class="block text-sm text-slate-400" for="password">Password</label>
                                <Show when={mode() === "signin" && features()?.passwordReset}>
                                    <button type="button" class={link} onClick={() => switchTo("forgot")}>Forgot password?</button>
                                </Show>
                            </div>
                            <input
                                id="password"
                                type="password"
                                required
                                minlength={mode() === "signup" ? PASSWORD_MIN : undefined}
                                maxlength="256"
                                autocomplete={mode() === "signup" ? "new-password" : "current-password"}
                                value={password()}
                                onInput={(e) => setPassword(e.currentTarget.value)}
                                class={input}
                            />
                            <Show when={mode() === "signup"}>
                                <p class="text-xs text-slate-500">At least {PASSWORD_MIN} characters. A passphrase works well.</p>
                            </Show>
                        </Show>

                        <Show when={error()}>
                            <p class="text-sm text-red-400" role="alert">{error()}</p>
                        </Show>
                        <Show when={notice()}>
                            <p class="text-sm text-green-400" role="status">{notice()}</p>
                        </Show>

                        <button type="submit" disabled={loading() !== null} class={primary}>
                            {loading() === "email"
                                ? "Working..."
                                : ({ signin: "Sign in", signup: "Create account", forgot: "Send reset link", magic: "Send magic link" })[mode()]}
                        </button>
                    </form>

                    <div class="flex flex-col items-center gap-2">
                        <Show when={mode() === "signin"}>
                            <button type="button" class={link} onClick={() => switchTo("signup")}>New here? Create an account</button>
                        </Show>
                        <Show when={mode() !== "signin"}>
                            <button type="button" class={link} onClick={() => switchTo("signin")}>Already have an account? Sign in</button>
                        </Show>
                        <Show when={mode() === "signin" && features()?.magicLink}>
                            <button type="button" class={link} onClick={() => switchTo("magic")}>Email me a sign-in link instead</button>
                        </Show>
                    </div>
                </div>
            </div>
        </SiteLayout>
    );
}
