import { A } from '@solidjs/router';
import type { JSX } from 'solid-js';

/**
 * Card thumbnail that opens the item's detail page. Shared by ExtensionCard and ThemeCard so the home page,
 * browse pages and search never drift apart. It is a real link (middle-click and open-in-new-tab work) but is
 * kept out of the tab order and the accessibility tree: the card title is the keyboard/screen-reader link to the
 * same page. Overlay actions, when a card has them, sit above this link (see .thumb-actions in app.css).
 */
export default function CardPreviewLink(props: { href: string; class?: string; children: JSX.Element }) {
  return (
    <A href={props.href} tabIndex={-1} aria-hidden="true" class={props.class ?? 'block'} data-card-preview-link="">
      {props.children}
    </A>
  );
}
