import { cn } from '../../lib/cn.js';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-8 border-[3px]',
} as const;

export const Spinner = ({ size = 'md', className }: SpinnerProps) => (
  <div
    role="status"
    aria-label="Loading"
    className={cn(
      'animate-spin rounded-full border-border border-t-primary',
      sizes[size],
      className,
    )}
  />
);
