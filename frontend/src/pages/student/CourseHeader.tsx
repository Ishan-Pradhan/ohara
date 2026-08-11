import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.js';

interface CourseHeaderProps {
  title: string;
  code: string;
  isPublished: boolean;
  teachers: { id: string; name: string }[];
}

export const CourseHeader = ({ title, code, isPublished, teachers }: CourseHeaderProps) => (
  <div className="mb-6">
    <Link
      to="/student/courses"
      className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      My Courses
    </Link>

    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <span className="font-mono text-xs text-subtle">{code}</span>
          {teachers.length > 0 ? (
            <>
              <span className="text-border">·</span>
              <span>{teachers.map((t) => t.name).join(', ')}</span>
            </>
          ) : null}
        </div>
      </div>
      {!isPublished ? <Badge variant="warning">Not published yet</Badge> : null}
    </div>
  </div>
);
