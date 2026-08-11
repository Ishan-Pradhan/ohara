import type { AccessibleCourse } from '../features/courses/useAccessibleCourses.js';
import { cn } from '../lib/cn.js';

interface CourseSwitcherProps {
  courses: AccessibleCourse[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
}

/** A horizontally-scrollable pill row (same visual language as Tabs)
 * instead of a plain dropdown — which course you're looking at should be
 * visible at a glance, not hidden behind a click. Shared by
 * Gradebook/Attendance/Transcripts/At-Risk's teacher & student views. */
export const CourseSwitcher = ({ courses, selectedCourseId, onSelect }: CourseSwitcherProps) => (
  <div
    role="tablist"
    className="inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-surface-hover p-1 scrollbar-none"
  >
    {courses.map((course) => {
      const active = course.id === selectedCourseId;
      return (
        <button
          key={course.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(course.id)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[0.4rem] px-3.5 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            active ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {course.title}
          <span className={cn('font-mono text-xs', active ? 'text-subtle' : 'text-muted/70')}>
            {course.code}
          </span>
        </button>
      );
    })}
  </div>
);
