import { cn } from '../../lib/cn.js';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
} as const;

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

/** A palette of on-brand tints, picked deterministically from the name so a
 * given person always renders the same color across the app. */
const tints = [
  'bg-primary-soft text-primary',
  'bg-accent-soft text-accent-fg',
  'bg-success-soft text-success',
] as const;

const tintOf = (name: string): string => {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tints[sum % tints.length]!;
};

export const Avatar = ({ name, src, size = 'md', className }: AvatarProps) => {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        'flex items-center justify-center rounded-full font-semibold',
        sizes[size],
        tintOf(name),
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  );
};
