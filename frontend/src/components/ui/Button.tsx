import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn.js';
import { Spinner } from './Spinner.js';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'transition-[background-color,color,box-shadow,transform] duration-150 ease-out ' +
  'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const variants = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm shadow-primary/20',
  secondary:
    'bg-surface text-fg border border-border hover:bg-surface-hover hover:border-border-strong',
  ghost: 'text-fg hover:bg-surface-hover',
  destructive: 'bg-danger text-white hover:opacity-90 shadow-sm shadow-danger/20',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      className,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" className="border-current/30 border-t-current" />
      ) : null}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
