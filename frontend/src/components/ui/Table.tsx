import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '../../lib/cn.js';

export const Table = ({ children, className, ...rest }: HTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto rounded-card border border-border">
    <table className={cn('w-full text-left text-sm', className)} {...rest}>
      {children}
    </table>
  </div>
);

export const TableHead = ({ children }: { children: ReactNode }) => (
  <thead className="border-b border-border bg-surface-hover">{children}</thead>
);

export const TableBody = ({ children }: { children: ReactNode }) => (
  <tbody className="divide-y divide-border">{children}</tbody>
);

export const TableRow = ({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('transition-colors hover:bg-surface-hover/60', className)} {...rest}>
    {children}
  </tr>
);

export const TableHeadCell = ({
  children,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-subtle', className)}
    {...rest}
  >
    {children}
  </th>
);

export const TableCell = ({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3.5 text-fg', className)} {...rest}>
    {children}
  </td>
);
