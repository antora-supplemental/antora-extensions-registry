import { useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import SiteLayout from "~/components/SiteLayout";
import { authClient } from "~/lib/auth-client";
import { PASSWORD_MIN, passwordProblem } from "~/lib/password-policy";

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = () => (typeof params.token === "string" ? params.token : "");
    const setting = () => params.set === "1";
    const [password, setPassword] = createSignal("");
    const [error, setError] = createSignal<string | null>(null);
    const [done, setDone] = createSignal(false);
    const [loading, setLoading] = createSignal(false);

    const submit = async (event: Event) => {
        event.preventDefault();
        const problem = passwordProblem(password());
        if (problem) return setError(problem);
        setLoading(true);
        setError(null);
        const { error: err } = await authClient.resetPassword({ newPassword: password(), token: token() });
        setLoading(false);
        if (err) {
            return setError(
                err.code === "PASSWORD_COMPROMISED"
                    ? "Choose a different password: this one appears in known data breaches."
                    : "This link is invalid or has expired. Request a new one.",
            );
        }
        setDone(true);
        setTimeout(() => navigate("/auth/signin"), 1500);
    };

    return (
        <SiteLayout title={setting() ? "Set a password" : "Reset password"}>
            <div class="min-h-[70vh] flex items-center justify-center p-6">
                <form class="w-full max-w-sm space-y-4" onSubmit={submit}>
                    <h1 class="text-3xl font-black text-white tracking-tight text-center">{setting() ? "Set a password" : "Choose a new password"}</h1>
                    <Show when={token()} fallback={<p class="text-sm text-red-400 text-center">This link is missing its token. Request a new one from Sign in.</p>}>
                        <label class="block text-sm text-slate-400" for="password">New password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            minlength={PASSWORD_MIN}
                            maxlength="256"
                            autocomplete="new-password"
                            value={password()}
                            onInput={(e) => setPassword(e.currentTarget.value)}
                            class="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <p class="text-xs text-slate-500">At least {PASSWORD_MIN} characters.</p>
                        <Show when={error()}><p class="text-sm text-red-400" role="alert">{error()}</p></Show>
                        <Show when={done()}><p class="text-sm text-green-400" role="status">Password saved. Taking you to sign in...</p></Show>
                        <button type="submit" disabled={loading() || done()} class="w-full px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-brand-foreground font-medium disabled:opacity-60">
                            {loading() ? "Saving..." : "Save password"}
                        </button>
                    </Show>
                </form>
            </div>
        </SiteLayout>
    );
}
