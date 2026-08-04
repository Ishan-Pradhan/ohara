import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'accent';
}

const variants = {
  neutral: 'bg-surface-hover text-muted border-border',
  primary: 'bg-primary-soft text-primary border-primary/20',
  success: 'bg-success-soft text-success border-success/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  warning: 'bg-warning-soft text-accent-fg border-warning/30',
  accent: 'bg-accent-soft text-accent-fg border-accent/30',
} as const;

export const Badge = ({ children, variant = 'neutral', className, ...rest }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-medium',
      variants[variant],
      className,
    )}
    {...rest}
  >
    {children}
  </span>
);
