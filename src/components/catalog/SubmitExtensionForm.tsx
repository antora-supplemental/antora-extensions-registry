import { createSignal, Show } from 'solid-js';
import { parseGitHubUrl } from '~/lib/github';

export default function SubmitExtensionForm() {
  const [repoUrl, setRepoUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const parsed = () => parseGitHubUrl(repoUrl());

  const submit = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!parsed()) {
      setError('Enter a GitHub repository URL.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/extensions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl().trim() }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) setError(data.error ?? 'Something went wrong. Try again.');
      else setMessage(data.message ?? "It'll be listed once reviewed.");
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="max-w-2xl mx-auto">
      <Show
        when={!message()}
        fallback={
          <div class="p-6 bg-green-500/10 border border-green-500/50 rounded-xl text-center">
            <h3 class="text-xl font-semibold text-green-400 mb-2">Submitted for review</h3>
            <p class="text-green-300/80">{message()}</p>
            <a href="/extensions" class="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors">
              Browse extensions
            </a>
          </div>
        }
      >
        <form onSubmit={submit} class="space-y-6">
          <div>
            <label for="repo-url" class="block text-sm font-medium text-slate-300 mb-2">GitHub repository URL</label>
            <input
              id="repo-url"
              type="text"
              value={repoUrl()}
              onInput={(e) => setRepoUrl(e.currentTarget.value)}
              placeholder="https://github.com/username/antora-extension"
              class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
            />
            <Show when={parsed()}>
              <p class="mt-2 text-sm text-slate-400">
                Repository: <span class="text-primary-400">{parsed()!.owner}/{parsed()!.repo}</span>
              </p>
            </Show>
          </div>
          <Show when={error()}>
            <div class="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-300 text-sm">{error()}</div>
          </Show>
          <button
            type="submit"
            disabled={busy()}
            class="w-full py-3 px-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-brand-foreground font-medium rounded-xl transition-colors"
          >
            {busy() ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      </Show>
    </div>
  );
}
