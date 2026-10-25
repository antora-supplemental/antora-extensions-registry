import type { Component, ComponentProps } from 'solid-js';
import { splitProps } from 'solid-js';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '~/lib/utils';

export const badgeVariants = cva('inline-flex items-center rounded-md px-2 text-xs', {
  variants: {
    variant: {
      tag: 'py-1 glass-rim glass-tint text-slate-300',
      primary: 'py-0.5 bg-primary/20 text-primary-300 font-medium',
      muted: 'py-0.5 glass-rim glass-tint text-slate-300',
      warning: 'py-0.5 bg-amber-500/10 text-amber-300',
      success: 'py-0.5 bg-emerald-500/10 text-emerald-300 font-mono',
    },
  },
  defaultVariants: { variant: 'tag' },
});

export const Badge: Component<ComponentProps<'span'> & VariantProps<typeof badgeVariants>> = (props) => {
  const [local, others] = splitProps(props, ['class', 'variant']);
  return <span class={cn(badgeVariants({ variant: local.variant }), local.class)} {...others} />;
};
