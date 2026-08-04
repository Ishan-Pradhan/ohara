import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** An icon button rendered inside the field, right-aligned — e.g. a
   * password visibility toggle. Adds room on the right so it never overlaps
   * typed text. */
  trailingAction?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, trailingAction, className, ...rest }, ref) => {
    const input = (
      <input
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          'w-full rounded-control border bg-surface px-3.5 py-2.5 text-sm text-fg',
          'placeholder:text-subtle transition-shadow duration-150',
          'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
          invalid
            ? 'border-danger focus:ring-danger/20 focus:border-danger'
            : 'border-border hover:border-border-strong',
          trailingAction ? 'pr-10' : '',
          className,
        )}
        {...rest}
      />
    );

    if (!trailingAction) return input;

    return (
      <div className="relative">
        {input}
        <div className="absolute inset-y-0 right-1.5 flex items-center">{trailingAction}</div>
      </div>
    );
  },
);

Input.displayName = 'Input';
