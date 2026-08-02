import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className = '', ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid}
      className={
        'w-full rounded-control border bg-surface px-3 py-2.5 text-sm ' +
        'text-fg placeholder:text-muted transition-colors ' +
        'focus:outline-2 focus:outline-offset-0 focus:outline-primary ' +
        (invalid ? 'border-danger ' : 'border-border ') +
        className
      }
      {...rest}
    />
  ),
);

Input.displayName = 'Input';
