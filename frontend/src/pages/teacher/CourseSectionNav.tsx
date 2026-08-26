import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  CalendarCheck,
  ClipboardList,
  HelpCircle,
  MessageSquare,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface CourseSectionNavProps {
  courseId: string;
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-hover hover:text-fg',
  );

const subNavItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-control py-1.5 pl-8 pr-3 text-sm font-medium transition-colors',
    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-hover hover:text-fg',
  );

export const CourseSectionNav = ({ courseId }: CourseSectionNavProps) => {
  const base = `/teacher/courses/${courseId}`;

  return (
    <nav className="flex flex-col gap-0.5">
      <NavLink to={`${base}/overview`} end className={navItemClass}>
        <BarChart3 className="size-4.5 shrink-0" aria-hidden />
        Overview
      </NavLink>
      <NavLink to={`${base}/content`} end className={navItemClass}>
        <BookOpen className="size-4.5 shrink-0" aria-hidden />
        Content
      </NavLink>
      <NavLink to={`${base}/assignments`} end className={navItemClass}>
        <ClipboardList className="size-4.5 shrink-0" aria-hidden />
        Assignments
      </NavLink>
      <NavLink to={`${base}/quizzes`} end className={navItemClass}>
        <HelpCircle className="size-4.5 shrink-0" aria-hidden />
        Quizzes
      </NavLink>
      <NavLink to={`${base}/gradebook`} end className={navItemClass}>
        <BarChart3 className="size-4.5 shrink-0" aria-hidden />
        Gradebook
      </NavLink>
      <NavLink to={`${base}/attendance`} end className={navItemClass}>
        <CalendarCheck className="size-4.5 shrink-0" aria-hidden />
        Attendance
      </NavLink>
      <NavLink to={`${base}/study-aids`} end className={navItemClass}>
        <Sparkles className="size-4.5 shrink-0" aria-hidden />
        Study aids
      </NavLink>
      <NavLink to={`${base}/intelligence`} end className={navItemClass}>
        <Brain className="size-4.5 shrink-0" aria-hidden />
        Intelligence
      </NavLink>
      <NavLink to={`${base}/intelligence/weekly`} className={subNavItemClass}>
        <Calendar className="size-3.5 shrink-0" aria-hidden />
        Weekly
      </NavLink>
      <NavLink to={`${base}/intelligence/copilot`} className={subNavItemClass}>
        <MessageSquare className="size-3.5 shrink-0" aria-hidden />
        AI Copilot
      </NavLink>
      <NavLink to={`${base}/intelligence/interventions`} className={subNavItemClass}>
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        Interventions
      </NavLink>
      <NavLink to={`${base}/intelligence/lesson-planner`} className={subNavItemClass}>
        <BookOpen className="size-3.5 shrink-0" aria-hidden />
        Lesson Planner
      </NavLink>
    </nav>
  );
};
