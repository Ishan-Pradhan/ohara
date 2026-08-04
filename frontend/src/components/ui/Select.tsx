import type { ReactNode } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
  id?: string;
}

export const Select = ({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  invalid = false,
  id,
}: SelectProps) => (
  <RadixSelect.Root value={value} onValueChange={onValueChange}>
    <RadixSelect.Trigger
      id={id}
      aria-invalid={invalid}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-control border bg-surface px-3.5 py-2.5 text-sm text-fg',
        'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
        'data-[placeholder]:text-subtle',
        invalid ? 'border-danger' : 'border-border hover:border-border-strong',
      )}
    >
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon>
        <ChevronDown className="size-4 text-subtle" aria-hidden />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content
        position="popper"
        sideOffset={6}
        className={cn(
          'z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card border border-border bg-surface p-1.5 shadow-lg shadow-black/5',
          'data-[state=open]:[animation:slide-in-from-top_150ms_var(--ease-out)]',
        )}
      >
        <RadixSelect.Viewport>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
);

const SelectItem = ({
  value,
  children,
  disabled,
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) => (
  <RadixSelect.Item
    value={value}
    disabled={disabled}
    className={cn(
      'flex cursor-pointer select-none items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm outline-none transition-colors',
      'text-fg data-[highlighted]:bg-surface-hover',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    )}
  >
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    <RadixSelect.ItemIndicator>
      <Check className="size-4 text-primary" aria-hidden />
    </RadixSelect.ItemIndicator>
  </RadixSelect.Item>
);
