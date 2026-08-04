import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

export const Card = ({
  children,
  padding = 'lg',
  className,
  ...rest
}: CardProps) => (
  <div
    className={cn(
      'bg-surface border border-border rounded-card shadow-sm shadow-black/[0.02]',
      paddings[padding],
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);
