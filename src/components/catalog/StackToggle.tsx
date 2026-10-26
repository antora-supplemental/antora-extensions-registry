import { createSignal, onMount } from 'solid-js';
import { buttonVariants } from '~/components/ui/button';
import { inStack, toggleStack } from '~/lib/stack-store';

/** "Add to stack" toggle for cards and detail pages. */
export default function StackToggle(props: { id: string; class?: string }) {
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));
  const on = () => ready() && inStack(props.id);
  return (
    <button
      type="button"
      data-stack-toggle
      aria-pressed={on()}
      onClick={() => toggleStack(props.id)}
      title={on() ? 'Remove from your stack' : 'Add to your stack and check compatibility'}
      class={`${buttonVariants({ variant: on() ? 'default' : 'soft', size: 'sm' })} ${props.class ?? ''}`}
    >
      {on() ? '✓ In stack' : '+ Add to stack'}
    </button>
  );
}
