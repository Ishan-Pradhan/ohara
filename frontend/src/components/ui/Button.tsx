import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-control px-4 py-2.5 ' +
  'text-sm font-medium transition-colors disabled:opacity-50 ' +
  'disabled:cursor-not-allowed focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-primary';

const variants = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  ghost: 'text-fg border border-border hover:bg-bg',
} as const;

export const Button = ({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) => (
  <button
    className={`${base} ${variants[variant]} ${className}`}
    disabled={disabled || loading}
    aria-busy={loading}
    {...rest}
  >
    {loading ? 'Please wait…' : children}
  </button>
);
