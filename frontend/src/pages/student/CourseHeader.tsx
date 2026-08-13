import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.js';
import { Avatar } from '../../components/ui/Avatar.js';

interface CourseHeaderProps {
  title: string;
  code: string;
  isPublished: boolean;
  teachers: { id: string; name: string }[];
  isPastCourse?: boolean;
  batchName?: string | null;
}

export const CourseHeader = ({
  title,
  code,
  isPublished,
  teachers,
  isPastCourse,
  batchName,
}: CourseHeaderProps) => (
  <div className="mb-6">
    <Link
      to="/student/courses"
      className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      My Courses
    </Link>

    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <BookOpen className="size-5 text-primary" aria-hidden />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            <span className="rounded-control bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-subtle">
              {code}
            </span>
          </div>
          {teachers.length > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {teachers.slice(0, 4).map((t) => (
                  <Avatar key={t.id} name={t.name} size="sm" className="ring-2 ring-surface" />
                ))}
              </div>
              <span className="text-sm text-muted">{teachers.map((t) => t.name).join(', ')}</span>
            </div>
          ) : null}
        </div>
      </div>
      {isPastCourse ? (
        <Badge variant="neutral">{batchName ? `Completed — ${batchName}` : 'Completed'}</Badge>
      ) : !isPublished ? (
        <Badge variant="warning">Not published yet</Badge>
      ) : null}
    </div>
  </div>
);
