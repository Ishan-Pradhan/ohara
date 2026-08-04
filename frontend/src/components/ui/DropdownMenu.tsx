import type { ReactNode } from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';

import { cn } from '../../lib/cn.js';

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

interface DropdownMenuContentProps {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export const DropdownMenuContent = ({
  children,
  align = 'end',
}: DropdownMenuContentProps) => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      align={align}
      sideOffset={8}
      className={cn(
        'z-50 min-w-48 rounded-card border border-border bg-surface p-1.5 shadow-lg shadow-black/5',
        'data-[state=open]:[animation:slide-in-from-top_150ms_var(--ease-out)]',
        'data-[state=closed]:[animation:slide-out-to-top_120ms_var(--ease-out)]',
      )}
    >
      {children}
    </RadixDropdown.Content>
  </RadixDropdown.Portal>
);

interface DropdownMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export const DropdownMenuItem = ({
  children,
  onSelect,
  destructive = false,
  disabled = false,
}: DropdownMenuItemProps) => (
  <RadixDropdown.Item
    onSelect={onSelect}
    disabled={disabled}
    className={cn(
      'flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-2 text-sm outline-none transition-colors',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      destructive
        ? 'text-danger data-[highlighted]:bg-danger-soft'
        : 'text-fg data-[highlighted]:bg-surface-hover',
    )}
  >
    {children}
  </RadixDropdown.Item>
);

export const DropdownMenuSeparator = () => (
  <RadixDropdown.Separator className="my-1.5 h-px bg-border" />
);

export const DropdownMenuLabel = ({ children }: { children: ReactNode }) => (
  <RadixDropdown.Label className="px-2.5 py-1.5 text-xs font-medium text-subtle">
    {children}
  </RadixDropdown.Label>
);
