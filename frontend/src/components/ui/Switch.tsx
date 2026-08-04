import * as RadixSwitch from '@radix-ui/react-switch';

import { cn } from '../../lib/cn.js';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export const Switch = ({ checked, onCheckedChange, id, disabled }: SwitchProps) => (
  <RadixSwitch.Root
    id={id}
    checked={checked}
    onCheckedChange={onCheckedChange}
    disabled={disabled}
    className={cn(
      'relative h-6 w-10 shrink-0 rounded-pill border transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
      'data-[state=unchecked]:bg-surface-hover data-[state=unchecked]:border-border-strong',
    )}
  >
    <RadixSwitch.Thumb
      className={cn(
        'block size-4.5 translate-x-0.5 rounded-full bg-surface shadow-sm transition-transform',
        'data-[state=checked]:translate-x-[1.125rem]',
      )}
    />
  </RadixSwitch.Root>
);
