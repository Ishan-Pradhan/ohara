import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { PaginationMeta } from '../../schemas/pagination.schema.js';
import { cn } from '../../lib/cn.js';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

/** Truncated page-number range: first, last, current ±1, with '…' gaps —
 * e.g. current=6, total=20 -> [1, '…', 5, 6, 7, '…', 20]. */
const pageRange = (current: number, total: number): (number | '…')[] => {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const withGaps: (number | '…')[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - (sorted[i - 1] as number) > 1) withGaps.push('…');
    withGaps.push(page);
  });
  return withGaps;
};

/** Page-number pagination driven by a backend PaginationMeta — renders
 * nothing when there's only one page. Used identically across every
 * paginated list (Students, Staff, Notifications, …). */
export const Pagination = ({ meta, onPageChange }: PaginationProps) => {
  const { currentPage, totalPages } = meta;
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
        className="flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      {pageRange(currentPage, totalPages).map((page, i) =>
        page === '…' ? (
          <span key={`gap-${i}`} className="flex size-8 items-center justify-center text-sm text-subtle">
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={cn(
              'flex size-8 items-center justify-center rounded-control text-sm font-medium transition-colors',
              page === currentPage
                ? 'bg-primary-soft text-primary'
                : 'text-muted hover:bg-surface-hover hover:text-fg',
            )}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
        className="flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
};
