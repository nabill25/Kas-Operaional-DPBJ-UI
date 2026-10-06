import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Menu({
  pemicu,
  children,
  align = 'end',
  lebar = 'w-56',
}: {
  pemicu: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  lebar?: string;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{pemicu}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn('glass-strong anim-pop z-50 rounded-2xl p-1.5 shadow-2xl', lebar)}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  children,
  ikon,
  onSelect,
  bahaya,
  disabled,
}: {
  children: ReactNode;
  ikon?: ReactNode;
  onSelect?: () => void;
  bahaya?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        bahaya
          ? 'text-red-600 data-[highlighted]:bg-red-500/10 dark:text-red-400'
          : 'text-fg data-[highlighted]:bg-fg/[0.06]',
      )}
    >
      {ikon && <span className="text-fg-muted [&>svg]:size-4">{ikon}</span>}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-3 pt-2 pb-1.5">{children}</DropdownMenu.Label>;
}

export function MenuPemisah() {
  return <DropdownMenu.Separator className="my-1.5 h-px bg-line" />;
}
