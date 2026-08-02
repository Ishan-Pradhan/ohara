import type { ReactNode } from 'react';

export const Card = ({ children }: { children: ReactNode }) => (
  <div className="bg-surface border border-border rounded-card p-8">
    {children}
  </div>
);
