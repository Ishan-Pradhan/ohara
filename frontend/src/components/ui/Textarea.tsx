import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/cn.js';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        'w-full rounded-control border bg-surface px-3.5 py-2.5 text-sm text-fg',
        'placeholder:text-subtle transition-shadow duration-150',
        'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
        invalid
          ? 'border-danger focus:ring-danger/20 focus:border-danger'
          : 'border-border hover:border-border-strong',
        className,
      )}
      {...rest}
    />
  ),
);

Textarea.displayName = 'Textarea';
