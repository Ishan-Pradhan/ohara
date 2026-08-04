import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export const Checkbox = ({ checked, onCheckedChange, id, disabled }: CheckboxProps) => (
  <RadixCheckbox.Root
    id={id}
    checked={checked}
    onCheckedChange={(state) => onCheckedChange(state === true)}
    disabled={disabled}
    className={cn(
      'flex size-4.5 items-center justify-center rounded-[0.3rem] border transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
      'data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-surface',
    )}
  >
    <RadixCheckbox.Indicator>
      <Check className="size-3.5 text-primary-fg" strokeWidth={3} aria-hidden />
    </RadixCheckbox.Indicator>
  </RadixCheckbox.Root>
);
