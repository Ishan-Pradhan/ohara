import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}

export const Field = ({ label, htmlFor, error, hint, children }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
      {label}
    </label>
    {children}
    {error ? (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    ) : hint ? (
      <p className="text-sm text-subtle">{hint}</p>
    ) : null}
  </div>
);
