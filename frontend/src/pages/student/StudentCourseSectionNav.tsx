import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface StudentCourseSectionNavProps {
  courseId: string;
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-hover hover:text-fg',
  );

export const StudentCourseSectionNav = ({ courseId }: StudentCourseSectionNavProps) => {
  const base = `/student/courses/${courseId}`;

  return (
    <nav className="flex flex-col gap-0.5">
      <NavLink to={`${base}/content`} end className={navItemClass}>
        <BookOpen className="size-4.5 shrink-0" aria-hidden />
        Content
      </NavLink>
      <NavLink to={`${base}/tutor`} end className={navItemClass}>
        <Sparkles className="size-4.5 shrink-0" aria-hidden />
        AI Tutor
      </NavLink>
      <NavLink to={`${base}/study-tools`} end className={navItemClass}>
        <GraduationCap className="size-4.5 shrink-0" aria-hidden />
        Study Tools
      </NavLink>
      <NavLink to={`${base}/assignments`} end className={navItemClass}>
        <ClipboardList className="size-4.5 shrink-0" aria-hidden />
        Assignments
      </NavLink>
      <NavLink to={`${base}/quizzes`} end className={navItemClass}>
        <HelpCircle className="size-4.5 shrink-0" aria-hidden />
        Quizzes
      </NavLink>
      <NavLink to={`${base}/grades`} end className={navItemClass}>
        <BarChart3 className="size-4.5 shrink-0" aria-hidden />
        Grades
      </NavLink>
      <NavLink to={`${base}/attendance`} end className={navItemClass}>
        <CalendarCheck className="size-4.5 shrink-0" aria-hidden />
        Attendance
      </NavLink>
    </nav>
  );
};
