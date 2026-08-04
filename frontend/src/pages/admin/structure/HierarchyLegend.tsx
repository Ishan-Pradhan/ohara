import { useState } from 'react';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';

import { Card } from '../../../components/ui/Card.js';

const STORAGE_KEY = 'ohara:structure-legend-collapsed';

export const HierarchyLegend = () => {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  );

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <Card padding="sm" className="mb-6">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Network className="size-4 text-primary" aria-hidden />
          How this fits together
        </span>
        {collapsed ? (
          <ChevronRight className="size-4 text-subtle" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-subtle" aria-hidden />
        )}
      </button>
      {collapsed ? null : (
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-fg">Bachelor of Computer Science</span> (Program)
          {' → '}
          <span className="font-medium text-fg">Year 1</span> (Class)
          {' → '}
          <span className="font-medium text-fg">Section A, 2025/26</span> (Section)
          {' → '}
          <span className="font-medium text-fg">Physics</span> (Course)
        </p>
      )}
    </Card>
  );
};
