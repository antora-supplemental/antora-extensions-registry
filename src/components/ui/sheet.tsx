import type { Component, ComponentProps, JSX, ValidComponent } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import * as SheetPrimitive from '@kobalte/core/dialog';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '~/lib/utils';

// solid-ui Sheet (Kobalte Dialog), themed to the registry chrome (slate-900 header color in both schemes).
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.CloseButton;

const portalVariants = cva('fixed inset-0 z-[60] flex', {
  variants: {
    position: { top: 'items-start', bottom: 'items-end', left: 'justify-start', right: 'justify-end' },
  },
  defaultVariants: { position: 'right' },
});

type PortalProps = SheetPrimitive.DialogPortalProps & VariantProps<typeof portalVariants>;

const SheetPortal: Component<PortalProps> = (props) => {
  const [local, others] = splitProps(props, ['position', 'children']);
  return (
    <SheetPrimitive.Portal {...others}>
      <div class={portalVariants({ position: local.position })}>{local.children}</div>
    </SheetPrimitive.Portal>
  );
};

type OverlayProps<T extends ValidComponent = 'div'> = SheetPrimitive.DialogOverlayProps<T> & { class?: string };

const SheetOverlay = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, OverlayProps<T>>) => {
  const [local, others] = splitProps(props as OverlayProps, ['class']);
  return (
    <SheetPrimitive.Overlay
      class={cn(
        'fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm data-[expanded=]:animate-in data-[closed=]:animate-out data-[closed=]:fade-out-0 data-[expanded=]:fade-in-0',
        local.class,
      )}
      {...others}
    />
  );
};

const sheetVariants = cva(
  'fixed z-[60] gap-4 border-slate-700/50 bg-slate-900 text-slate-100 p-6 shadow-2xl transition ease-in-out data-[expanded=]:animate-in data-[closed=]:animate-out data-[expanded=]:duration-300 data-[closed=]:duration-200',
  {
    variants: {
      position: {
        top: 'inset-x-0 top-0 border-b data-[closed=]:slide-out-to-top data-[expanded=]:slide-in-from-top',
        bottom: 'inset-x-0 bottom-0 border-t data-[closed=]:slide-out-to-bottom data-[expanded=]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[closed=]:slide-out-to-left data-[expanded=]:slide-in-from-left sm:max-w-sm',
        right: 'inset-y-0 right-0 h-full w-3/4 border-l data-[closed=]:slide-out-to-right data-[expanded=]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: { position: 'right' },
  },
);

type ContentProps<T extends ValidComponent = 'div'> = SheetPrimitive.DialogContentProps<T> &
  VariantProps<typeof sheetVariants> & { class?: string; children?: JSX.Element };

const SheetContent = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, ContentProps<T>>) => {
  const merged = mergeProps({ position: 'right' } as ContentProps, props);
  const [local, others] = splitProps(merged as ContentProps, ['position', 'class', 'children']);
  return (
    <SheetPortal position={local.position}>
      <SheetOverlay />
      <SheetPrimitive.Content class={cn(sheetVariants({ position: local.position }), local.class)} {...others}>
        {local.children}
        <SheetPrimitive.CloseButton
          aria-label="Close menu"
          class="absolute right-4 top-4 rounded-md p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg class="size-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </SheetPrimitive.CloseButton>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
};

const SheetHeader: Component<ComponentProps<'div'>> = (props) => {
  const [local, others] = splitProps(props, ['class']);
  return <div class={cn('flex flex-col space-y-2', local.class)} {...others} />;
};

type TitleProps<T extends ValidComponent = 'h2'> = SheetPrimitive.DialogTitleProps<T> & { class?: string };

const SheetTitle = <T extends ValidComponent = 'h2'>(props: PolymorphicProps<T, TitleProps<T>>) => {
  const [local, others] = splitProps(props as TitleProps, ['class']);
  return <SheetPrimitive.Title class={cn('text-lg font-semibold text-white', local.class)} {...others} />;
};

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle };