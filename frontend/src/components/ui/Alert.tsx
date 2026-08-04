import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface AlertProps {
  children: ReactNode;
  variant?: 'danger' | 'success' | 'warning' | 'info';
  /** Overrides the variant's default icon — e.g. a mail glyph for "check your inbox". */
  icon?: LucideIcon;
}

const variants = {
  danger: {
    classes: 'bg-danger-soft border-danger/30 text-danger',
    Icon: AlertTriangle,
  },
  success: {
    classes: 'bg-success-soft border-success/30 text-success',
    Icon: CheckCircle2,
  },
  warning: {
    classes: 'bg-warning-soft border-warning/40 text-accent-fg',
    Icon: AlertTriangle,
  },
  info: {
    classes: 'bg-primary-soft border-primary/25 text-primary',
    Icon: Info,
  },
} as const;

export const Alert = ({ children, variant = 'danger', icon }: AlertProps) => {
  const { classes, Icon: DefaultIcon } = variants[variant];
  const Icon = icon ?? DefaultIcon;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm',
        classes,
      )}
    >
      <Icon className="size-4.5 mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
};
