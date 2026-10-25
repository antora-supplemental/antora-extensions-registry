import { For } from 'solid-js';
import { Card } from '~/components/ui/card';

/** Splits `code` spans out of a plain-text paragraph. */
export function inline(text: string) {
  return text.split(/(`[^`]+`)/g).map((part) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code class="font-mono text-[0.9em] px-1 py-0.5 rounded bg-slate-800/80 text-slate-200">{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  );
}

/** "Full description" card: antoraRegistry.longDescription, else the README intro. Never the whole README. */
export default function FullDescription(props: { text: string; repository: string }) {
  const paragraphs = () => props.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <Card class="p-6 mb-6">
      <section aria-labelledby="full-description-heading">
        <h2 id="full-description-heading" class="text-lg font-semibold text-white mb-3">Full description</h2>
        <div class="space-y-3 text-slate-300 leading-relaxed max-w-3xl">
          <For each={paragraphs()}>{(p) => <p>{inline(p)}</p>}</For>
        </div>
        <a
          href={`${props.repository}#readme`}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block mt-4 text-sm font-medium text-primary-400 hover:text-primary-300 underline-offset-2 hover:underline"
        >
          Read the full README
        </a>
      </section>
    </Card>
  );
}