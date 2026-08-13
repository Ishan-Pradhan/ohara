import type { AccessibleCourse } from '../features/courses/useAccessibleCourses.js';
import { cn } from '../lib/cn.js';

interface CourseSwitcherProps<T extends AccessibleCourse> {
  courses: T[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
  /** Optional second line under the title (e.g. "Engineering · Semester 3")
   * — used by teacher views where the same title/code can appear under more
   * than one program. Omitted (or returning null) keeps the original
   * single-line pill, unchanged for every other caller. */
  getSubtitle?: (course: T) => string | null;
}

/** A horizontally-scrollable pill row (same visual language as Tabs)
 * instead of a plain dropdown — which course you're looking at should be
 * visible at a glance, not hidden behind a click. Shared by
 * Gradebook/Attendance/Transcripts/At-Risk's teacher & student views. */
export const CourseSwitcher = <T extends AccessibleCourse>({
  courses,
  selectedCourseId,
  onSelect,
  getSubtitle,
}: CourseSwitcherProps<T>) => (
  <div
    role="tablist"
    className="inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-surface-hover p-1 scrollbar-none"
  >
    {courses.map((course) => {
      const active = course.id === selectedCourseId;
      const subtitle = getSubtitle?.(course) ?? null;
      return (
        <button
          key={course.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(course.id)}
          className={cn(
            'inline-flex shrink-0 flex-col items-start whitespace-nowrap rounded-[0.4rem] px-3.5 py-1.5 text-left text-sm font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            active ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {course.title}
            <span className={cn('font-mono text-xs', active ? 'text-subtle' : 'text-muted/70')}>
              {course.code}
            </span>
          </span>
          {subtitle ? (
            <span className={cn('text-[0.6875rem] leading-tight', active ? 'text-subtle' : 'text-muted/70')}>
              {subtitle}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);
