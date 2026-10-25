import { A } from '@solidjs/router';
import { Dynamic } from 'solid-js/web';
import { Show, type JSX } from 'solid-js';
import ProviderIcon from '~/components/icons/ProviderIcon';
import { ownerHost, ownerPath } from '~/lib/owner-paths';
import { displayTitle } from '~/lib/package-title';
import type { ExtensionCatalogEntry } from '~/types/ui-module';

interface PackageTitleProps {
  entry: ExtensionCatalogEntry;
  /** Heading level for the name; the byline is never a heading. */
  as?: 'h1' | 'h2' | 'h3' | 'span';
  titleClass?: string;
  /** Default: name first, owner byline below. 'owner-first' puts the byline above. */
  order?: 'name-first' | 'owner-first';
  /** Link the name to the package page (default true). */
  link?: boolean;
  extra?: JSX.Element;
}

/**
 * Package name at title size plus a small muted byline: [16px avatar] owner. The owner links to the registry's
 * owner page; the forge icon links to the owner's GitHub/GitLab profile. Accessible name of the title link is
 * "owner/repo"; only the name is a heading.
 */
export default function PackageTitle(props: PackageTitleProps) {
  const host = () => ownerHost(props.entry);
  const owner = () => props.entry.owner;
  const login = () => owner()?.login ?? props.entry.repositoryOwner;
  const provider = () => (host() === 'github.com' ? 'github' : 'gitlab');
  const forge = () => (host() === 'github.com' ? 'GitHub' : host() === 'gitlab.com' ? 'GitLab' : `GitLab (${host()})`);
  const a11yName = () => `${props.entry.repositoryOwner}/${props.entry.repositoryName}`;

  const name = () => (
    <Dynamic component={props.as ?? 'h3'} class={props.titleClass ?? 'font-semibold text-lg text-white'}>
      <Show when={props.link !== false} fallback={<span><span class="sr-only">{props.entry.repositoryOwner}/</span>{displayTitle(props.entry)}</span>}>
        <A href={`/extensions/${props.entry.catalogId}`} aria-label={a11yName()} class="hover:text-primary-400 transition-colors focus-visible:outline-none focus-visible:underline break-words">
          {displayTitle(props.entry)}
        </A>
      </Show>
    </Dynamic>
  );
  const byline = () => (
    <p class="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
      <Show when={owner()?.avatar}>
        <img src={owner()!.avatar} alt="" aria-hidden="true" width="16" height="16" loading="lazy" class="h-4 w-4 shrink-0 rounded-full bg-slate-700" />
      </Show>
      <A href={ownerPath(host(), login())} class="truncate hover:text-slate-200 focus-visible:outline-none focus-visible:underline" title={owner()?.displayName ?? login()}>
        {login()}
      </A>
      <a
        href={owner()?.profileUrl ?? `https://${host()}/${login()}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${login()} on ${forge()} (opens in a new tab)`}
        title={`${login()} on ${forge()}`}
        class="shrink-0 text-slate-500 hover:text-slate-200"
      >
        <ProviderIcon provider={provider()} class="h-3.5 w-3.5" />
      </a>
      {props.extra}
    </p>
  );
  return (
    <div class="min-w-0">
      <Show when={props.order === 'owner-first'} fallback={<>{name()}{byline()}</>}>
        {byline()}
        {name()}
      </Show>
    </div>
  );
}