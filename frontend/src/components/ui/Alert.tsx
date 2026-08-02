import type { ReactNode } from 'react';

export const Alert = ({ children }: { children: ReactNode }) => (
  <div
    role="alert"
    className="rounded-control bg-danger-soft border border-danger px-3 py-2.5 text-sm text-danger"
  >
    {children}
  </div>
);
