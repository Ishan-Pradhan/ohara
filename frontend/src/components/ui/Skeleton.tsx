import { cn } from '../../lib/cn.js';

interface SkeletonProps {
  className?: string;
}

/** A shimmering placeholder block. Compose with utility classes for shape:
 * `<Skeleton className="h-4 w-32 rounded" />`, `<Skeleton className="size-9 rounded-full" />`. */
export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    aria-hidden
    className={cn(
      'animate-pulse rounded-control bg-skeleton',
      className,
    )}
  />
);
