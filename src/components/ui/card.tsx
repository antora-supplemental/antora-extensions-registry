import type { Component, ComponentProps } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '~/lib/utils';

export const Card: Component<ComponentProps<'article'>> = (props) => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <article
      class={cn(
        'bg-card/50 text-card-foreground rounded-xl overflow-hidden glass-rim',
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
