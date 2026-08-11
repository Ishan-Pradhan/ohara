import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

import type { PerformanceCourse } from '../../features/dashboard/dashboard.schema.js';
import type { StudentPlacement } from '../../features/placement/placement.schema.js';
import { Card } from '../../components/ui/Card.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';

interface CourseCardsGridProps {
  courses: StudentPlacement['courses'];
  performanceCourses: PerformanceCourse[];
}

export const CourseCardsGrid = ({ courses, performanceCourses }: CourseCardsGridProps) => {
  if (courses.length === 0) return null;

  const perfByCourse = new Map(performanceCourses.map((p) => [p.courseId, p]));

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-fg">My Courses</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const perf = perfByCourse.get(course.id);
          const avg = perf?.averageGrade;
          const attendance = perf?.attendancePercentage;

          return (
            <Link key={course.id} to={`/student/courses/${course.id}`}>
              <Card className="group cursor-pointer transition-colors hover:border-primary/40">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <BookOpen className="size-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="font-mono text-xs text-subtle">{course.code}</p>
                    {course.teachers.length > 0 ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {course.teachers.map((t) => t.name).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  {avg !== null && avg !== undefined ? (
                    <ProgressRing
                      value={avg}
                      size={40}
                      strokeWidth={4}
                      className="shrink-0"
                    />
                  ) : null}
                </div>

                {perf ? (
                  <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs text-muted">
                    {avg !== null && avg !== undefined ? (
                      <span>
                        Avg <span className="font-medium text-fg">{avg.toFixed(0)}%</span>
                      </span>
                    ) : (
                      <span>No grades</span>
                    )}
                    {attendance !== null && attendance !== undefined ? (
                      <span>
                        Att <span className="font-medium text-fg">{attendance.toFixed(0)}%</span>
                      </span>
                    ) : null}
                    {perf.missingSubmissions > 0 ? (
                      <span className="text-danger">
                        {perf.missingSubmissions} missing
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
