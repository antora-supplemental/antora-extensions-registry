import { Show } from 'solid-js';
import { cn } from '~/lib/utils';
import { isNewListing, NEW_WINDOW_DAYS } from '~/lib/new-items';

/** "New" for items first listed within NEW_WINDOW_DAYS. Renders nothing otherwise. */
export default function NewBadge(props: { firstListedAt?: string | null; class?: string }) {
  return (
    <Show when={isNewListing(props.firstListedAt)}>
      <span
        class={cn('new-badge inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold leading-none', props.class)}
        title={`Added to the registry in the last ${NEW_WINDOW_DAYS} days`}
      >
        New
      </span>
    </Show>
  );
}
