import type { Component, ComponentProps } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '~/lib/utils';

export const inputClass =
  'w-full px-4 py-3 bg-card/50 border border-border/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all disabled:opacity-50';

export const TextFieldInput: Component<ComponentProps<'input'>> = (props) => {
  const [local, others] = splitProps(props, ['class']);
  return <input class={cn(inputClass, local.class)} {...others} />;
};
