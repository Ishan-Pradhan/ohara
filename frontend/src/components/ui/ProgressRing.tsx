import { cn } from '../../lib/cn.js';

interface ProgressRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

/**
 * The app's signature data motif: a circular progress ring used everywhere a
 * percentage-of-completion concept appears — attendance rate, grade average,
 * course/quiz completion. Turns "gold" (the achievement accent) at 100%.
 */
export const ProgressRing = ({
  value,
  size = 64,
  strokeWidth = 6,
  label,
  className,
}: ProgressRingProps) => {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const isComplete = clamped >= 100;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out',
            isComplete ? 'stroke-accent' : 'stroke-primary',
          )}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-fg" aria-hidden>
        {Math.round(clamped)}%
      </span>
      {label ? <span className="sr-only">{`${label}: ${Math.round(clamped)}%`}</span> : null}
    </div>
  );
};
