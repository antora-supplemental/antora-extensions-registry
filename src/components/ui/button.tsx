import type { JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as ButtonPrimitive from '@kobalte/core/button';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '~/lib/utils';

// solid-ui Button, variants tuned to the registry's existing look.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-500',
        secondary: 'bg-secondary text-white hover:bg-slate-600',
        soft: 'bg-primary/20 text-primary-300 hover:bg-primary/30',
        outline: 'border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm rounded-lg',
        default: 'px-4 py-2 text-sm rounded-lg',
        lg: 'px-6 py-3 rounded-xl',
        xl: 'px-8 py-4 rounded-xl font-semibold',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps<T extends ValidComponent = 'button'> = ButtonPrimitive.ButtonRootProps<T> &
  VariantProps<typeof buttonVariants> & { class?: string | undefined; children?: JSX.Element };

export const Button = <T extends ValidComponent = 'button'>(props: PolymorphicProps<T, ButtonProps<T>>) => {
  const [local, others] = splitProps(props as ButtonProps, ['variant', 'size', 'class']);
  return (
    <ButtonPrimitive.Root
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  );
};
