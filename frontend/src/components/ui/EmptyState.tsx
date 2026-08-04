import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** An empty screen is an invitation to act, not a dead end — always pair with
 * a next step via `action` where one exists. */
export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
      <Icon className="size-6 text-primary" aria-hidden />
    </div>
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
    </div>
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);
