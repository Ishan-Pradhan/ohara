import type { ReactNode } from 'react';

import { Card } from './ui/Card.js';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export const AuthLayout = ({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) => (
  <main className="min-h-dvh grid place-items-center px-6 py-12">
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-3xl mb-1">Ohara</h1>
        <p className="text-muted text-sm">{subtitle}</p>
      </div>
      <Card>
        <h2 className="text-lg mb-6">{title}</h2>
        {children}
      </Card>
      <p className="mt-6 text-center text-sm text-muted">{footer}</p>
    </div>
  </main>
);
