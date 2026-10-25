import type { Component, ComponentProps } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '~/lib/utils';

export const Card: Component<ComponentProps<'article'>> = (props) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <article
      class={cn(
        'bg-card/50 text-card-foreground rounded-xl overflow-hidden border border-border/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10',
        local.class,
      )}
      {...others}
    />
  );
};

export const CardContent: Component<ComponentProps<'div'>> = (props) => {
  const [local, others] = splitProps(props, ['class']);
  return <div class={cn('p-6', local.class)} {...others} />;
};
