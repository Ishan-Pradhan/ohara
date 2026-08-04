import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatusPageProps {
  icon: LucideIcon;
  code?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Full-page state for 403/404/500-shaped situations — distinct from
 * AuthLayout, since these can be reached from inside the authenticated app,
 * not just the sign-in flow. */
export const StatusPage = ({ icon: Icon, code, title, description, action }: StatusPageProps) => (
  <main className="grid min-h-dvh place-items-center px-6 py-12">
    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft">
        <Icon className="size-7 text-primary" aria-hidden />
      </div>
      {code ? <span className="font-display text-sm italic text-subtle">{code}</span> : null}
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="text-sm text-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  </main>
);
