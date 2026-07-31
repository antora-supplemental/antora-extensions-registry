import { createSignal, Show } from 'solid-js';
import { parseGitHubUrl, type ThemeValidationResult } from '~/lib/github';
import type { Theme } from '~/types/theme';

interface SubmitThemeFormProps {
  userName?: string;
  onSuccess?: (theme: Theme) => void;
}

export default function SubmitThemeForm(props: SubmitThemeFormProps) {
  const [repoUrl, setRepoUrl] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [validatedTheme, setValidatedTheme] = createSignal<Theme | null>(null);
  const [validationMeta, setValidationMeta] = createSignal<Pick<ThemeValidationResult, 'hasUiModuleCatalog' | 'moduleCount' | 'recipeCount'> | null>(null);
  const [submitted, setSubmitted] = createSignal(false);

  const handleValidate = async (e: Event) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setValidatedTheme(null);
    setValidationMeta(null);

    const url = repoUrl().trim();
    if (!url) {
      setError('Please enter a repository URL');
      setIsLoading(false);
      return;
    }

    const response = await fetch('/api/themes/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: url }),
    });
    const result = (await response.json()) as ThemeValidationResult;

    if (result.valid && result.theme) {
      setValidatedTheme(result.theme);
      setValidationMeta({
        hasUiModuleCatalog: result.hasUiModuleCatalog,
        moduleCount: result.moduleCount,
        recipeCount: result.recipeCount,
      });
    } else {
      setError(result.error || 'Validation failed');
    }

    setIsLoading(false);
  };

  const handleSubmit = async () => {
    const theme = validatedTheme();
    if (!theme) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/themes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: theme.repoUrl,
          name: theme.name,
          description: theme.description,
          demoUrl: theme.demoUrl,
          previewImage: theme.previewImage,
          tags: theme.tags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Submission failed');
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
      props.onSuccess?.(theme);
    } catch {
      setError('Failed to submit theme. Please try again.');
    }

    setIsSubmitting(false);
  };

  const parsed = () => parseGitHubUrl(repoUrl());

  return (
    <div class="max-w-2xl mx-auto">
      <Show when={submitted()}>
        <div class="p-6 bg-green-500/10 border border-green-500/50 rounded-xl text-center">
          <h3 class="text-xl font-semibold text-green-400 mb-2">Theme Submitted!</h3>
          <p class="text-green-300/80">
            Your theme has been submitted for review. It will appear in the gallery once approved.
          </p>
          <a
            href="/themes"
            class="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors"
          >
            Browse Themes
          </a>
        </div>
      </Show>

      <Show when={!submitted()}>
        <form onSubmit={handleValidate} class="space-y-6">
          <div>
            <label for="repo-url" class="block text-sm font-medium text-slate-300 mb-2">
              GitHub Repository URL
            </label>
            <input
              id="repo-url"
              type="text"
              value={repoUrl()}
              onInput={(e) => setRepoUrl(e.currentTarget.value)}
              placeholder="https://github.com/username/antora-theme"
              disabled={!!validatedTheme()}
              class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all disabled:opacity-50"
            />
            <Show when={parsed() && !validatedTheme()}>
              <p class="mt-2 text-sm text-slate-400">
                Repository: <span class="text-primary-400">{parsed()!.owner}/{parsed()!.repo}</span>
              </p>
            </Show>
          </div>

          <Show when={error()}>
            <div class="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-300 text-sm">
              {error()}
            </div>
          </Show>

          <Show when={validatedTheme()}>
            <div class="p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-sm">
              <p class="text-green-400 font-medium">Theme Validated!</p>
              <p class="text-green-300/80 mt-1">
                <strong>{validatedTheme()!.name}</strong> by {validatedTheme()!.author}
              </p>
              <Show when={validationMeta()?.hasUiModuleCatalog}>
                <p class="text-emerald-300/90 mt-3">
                  UI module catalog detected: {validationMeta()!.moduleCount} modules, {validationMeta()!.recipeCount} recipes.
                </p>
              </Show>
              <button
                type="button"
                onClick={() => { setValidatedTheme(null); setValidationMeta(null); setRepoUrl(''); }}
                class="mt-4 text-slate-400 hover:text-white text-sm"
              >
                Use different URL
              </button>
            </div>
          </Show>

          <Show when={!validatedTheme()}>
            <button
              type="submit"
              disabled={isLoading()}
              class="w-full py-3 px-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {isLoading() ? 'Validating...' : 'Validate Theme'}
            </button>
          </Show>

          <Show when={validatedTheme()}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting()}
              class="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {isSubmitting() ? 'Submitting...' : 'Submit Theme for Review'}
            </button>
          </Show>
        </form>
      </Show>
    </div>
  );
}
